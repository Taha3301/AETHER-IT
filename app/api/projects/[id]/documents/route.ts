import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import {
  removeProjectAnalysisExport,
  storeProjectAnalysisExport,
} from "@/lib/document-export";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";
import { exportDocumentSchema } from "@/lib/project-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const documents = await prisma.document.findMany({
      where: { projectId: id },
      select: { id: true, projectId: true, type: true, fileName: true, fileSize: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ documents });
  } catch (error) {
    return handleApiError(error, "List project documents");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = exportDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid document export data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let storedFilePath: string | undefined;
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        aiAnalysis: true,
      },
    });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    if (!project.aiAnalysis) {
      return Response.json({ error: "Generate a project analysis before exporting it." }, {
        status: 409,
      });
    }

    const file = await storeProjectAnalysisExport(
      project.title,
      project.aiAnalysis,
      parsed.data.type,
      parsed.data.documentKind,
    );
    storedFilePath = file.filePath;
    const document = await prisma.document.create({
      data: {
        projectId: id,
        type:
          parsed.data.documentKind === "CAHIER_DES_CHARGES"
            ? `CAHIER_DES_CHARGES_${parsed.data.type}`
            : parsed.data.type,
        fileName: file.fileName,
        filePath: file.filePath,
        fileSize: file.fileSize,
      },
      select: { id: true, projectId: true, type: true, fileName: true, fileSize: true, createdAt: true },
    });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (storedFilePath) {
      try {
        await removeProjectAnalysisExport(storedFilePath);
      } catch (cleanupError) {
        console.error(
          "[Project export cleanup]",
          cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        );
      }
    }
    return handleApiError(error, "Export project analysis");
  }
}
