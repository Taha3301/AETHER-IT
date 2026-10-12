import { MessageSender, ProjectStatus } from "@prisma/client";
import { generateProjectAnalysis, LlmConfigurationError } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

export { LlmConfigurationError };

export class AnalysisWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function generateAndSaveProjectAnalysis(
  projectId: string,
  status: ProjectStatus = ProjectStatus.ANALYSIS_READY,
) {
  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    select: {
      messages: {
        where: {
          sender: { in: [MessageSender.USER, MessageSender.ADMIN, MessageSender.AI] },
        },
        select: { sender: true, content: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const history = conversations.flatMap((conversation) =>
    conversation.messages.map((message) => ({
      role: message.sender === MessageSender.AI ? ("assistant" as const) : ("user" as const),
      content: message.content,
    })),
  );
  if (!history.some((message) => message.role === "user")) {
    throw new AnalysisWorkflowError(
      "At least one user message is required before generating an analysis.",
      409,
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });
  if (!project) throw new AnalysisWorkflowError("Project not found.", 404);

  let analysis;
  try {
    analysis = await generateProjectAnalysis(project.title, history);
  } catch (error) {
    if (error instanceof LlmConfigurationError) throw error;
    throw new AnalysisWorkflowError("AI service could not generate the project analysis.", 502);
  }

  return prisma.$transaction(async (transaction) => {
    const savedAnalysis = await transaction.aIAnalysis.upsert({
      where: { projectId },
      create: { projectId, ...analysis },
      update: analysis,
    });
    await transaction.project.update({
      where: { id: projectId },
      data: { status },
    });
    return savedAnalysis;
  });
}
