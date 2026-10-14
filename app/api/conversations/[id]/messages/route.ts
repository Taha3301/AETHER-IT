import { MessageSender } from "@prisma/client";
import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { answerProjectMessage, LlmConfigurationError, LlmRequestError } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";
import { createMessageSchema } from "@/lib/project-validation";

type RouteContext = { params: Promise<{ id: string }> };

async function findConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      project: { select: { id: true, title: true, customerId: true, isGuest: true } },
    },
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const conversation = await findConversation(id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    const access = await requireProjectAccess(request, conversation.projectId, conversation.project);
    if (access.response) return access.response;
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return Response.json({ messages });
  } catch (error) {
    return handleApiError(error, "List conversation messages");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const originError = !hasSameOrigin(request);
  if (originError) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = createMessageSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid message data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const conversation = await findConversation(id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    const access = await requireProjectAccess(request, conversation.projectId, conversation.project);
    if (access.response) return access.response;

    const sender = parsed.data.sender ?? MessageSender.USER;
    if (sender === MessageSender.ADMIN && access.user?.role !== "ADMIN") {
      return Response.json({ error: "Only an administrator can send an admin message." }, {
        status: 403,
      });
    }

    const sentMessage = await prisma.message.create({
      data: { conversationId: id, sender, content: parsed.data.content },
    });
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    const conversationMessages = await prisma.message.findMany({
      where: {
        conversationId: id,
        sender: { in: [MessageSender.USER, MessageSender.ADMIN, MessageSender.AI] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const history = conversationMessages.map((message) => ({
      role: message.sender === MessageSender.AI ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));

    try {
      const content = await answerProjectMessage(
        conversation.project.title,
        history,
        parsed.data.language,
      );
      const aiMessage = await prisma.message.create({
        data: { conversationId: id, sender: MessageSender.AI, content },
      });
      await prisma.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return Response.json(
        {
          ...(sender === MessageSender.ADMIN
            ? { message: sentMessage }
            : { userMessage: sentMessage }),
          aiMessage,
        },
        { status: 201 },
      );
    } catch (error) {
      console.error(
        "[Generate project reply]",
        error instanceof Error ? error.message : "UnknownError",
      );
      return Response.json(
        {
          error: error instanceof LlmConfigurationError
            ? "AI service is not configured."
            : error instanceof LlmRequestError
              ? error.message
              : "AI service could not generate a reply. The message was saved; you can retry.",
          ...(sender === MessageSender.ADMIN
            ? { message: sentMessage }
            : { userMessage: sentMessage }),
        },
        { status: error instanceof LlmConfigurationError ? 503 : 502 },
      );
    }
  } catch (error) {
    return handleApiError(error, "Send conversation message");
  }
}
