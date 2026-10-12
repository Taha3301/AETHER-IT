import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import {
  AnalysisWorkflowError,
  generateAndSaveProjectAnalysis,
  LlmConfigurationError,
} from "@/lib/analysis-workflow";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const analysis = await prisma.aIAnalysis.findUnique({ where: { projectId: id } });
    if (!analysis) {
      return Response.json({ error: "Project analysis not found." }, { status: 404 });
    }
    return Response.json({ analysis });
  } catch (error) {
    return handleApiError(error, "Get project analysis");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const analysis = await generateAndSaveProjectAnalysis(id);
    return Response.json({ analysis });
  } catch (error) {
    if (error instanceof LlmConfigurationError) {
      return Response.json({ error: "AI service is not configured." }, { status: 503 });
    }
    if (error instanceof AnalysisWorkflowError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleApiError(error, "Generate project analysis");
  }
}
