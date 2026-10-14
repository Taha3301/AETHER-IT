import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { UserRole } from "@prisma/client";
import { removeProjectAnalysisExport } from "@/lib/document-export";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";
import { updateProjectSchema } from "@/lib/project-validation";

type RouteContext = { params: Promise<{ id: string }> };

const projectDetailSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  customerId: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  isGuest: true,
  createdAt: true,
  updatedAt: true,
  aiAnalysis: true,
  conversations: {
    select: { id: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  },
  documents: {
    select: { id: true, type: true, fileName: true, fileSize: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  },
} as const;

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const project = await prisma.project.findUnique({
      where: { id },
      select: projectDetailSelect,
    });
    return project
      ? Response.json({ project })
      : Response.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return handleApiError(error, "Get project");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    if (parsed.data.status !== undefined && access.user?.role !== UserRole.ADMIN) {
      return Response.json({ error: "Only an administrator can change project status." }, {
        status: 403,
      });
    }
    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
      select: projectDetailSelect,
    });
    return Response.json({ project });
  } catch (error) {
    return handleApiError(error, "Update project");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;

    const documents = await prisma.document.findMany({
      where: { projectId: id },
      select: { filePath: true },
    });
    await prisma.project.delete({ where: { id } });

    const cleanupResults = await Promise.allSettled(
      documents.map((document) => removeProjectAnalysisExport(document.filePath)),
    );
    const cleanupErrors = cleanupResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (cleanupErrors.length > 0) {
      for (const result of cleanupErrors) {
        console.error(
          "[Project deletion file cleanup]",
          result.reason instanceof Error ? result.reason.name : "UnknownError",
        );
      }
      return Response.json({
        deleted: true,
        warning: "Le projet a été supprimé, mais certains fichiers générés n’ont pas pu être effacés.",
      });
    }
    return Response.json({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Delete project");
  }
}
