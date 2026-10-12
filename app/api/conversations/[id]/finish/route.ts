import { ProjectStatus } from "@prisma/client";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import {
  AnalysisWorkflowError,
  generateAndSaveProjectAnalysis,
  LlmConfigurationError,
} from "@/lib/analysis-workflow";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { projectId: true, project: { select: { id: true, customerId: true, isGuest: true } } },
    });
    if (!conversation) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    const access = await requireProjectAccess(request, conversation.projectId, conversation.project);
    if (access.response) return access.response;
    const analysis = await generateAndSaveProjectAnalysis(
      conversation.projectId,
      ProjectStatus.COMPLETED,
    );
    return Response.json({ analysis });
  } catch (error) {
    if (error instanceof LlmConfigurationError) {
      return Response.json({ error: "AI service is not configured." }, { status: 503 });
    }
    if (error instanceof AnalysisWorkflowError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error, "Finish project conversation");
  }
}
