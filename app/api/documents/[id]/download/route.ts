import { connection } from "next/server";
import { handleApiError } from "@/lib/api";
import { readProjectAnalysisExport } from "@/lib/document-export";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, projectId: true, type: true, fileName: true, filePath: true },
    });
    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }
    const access = await requireProjectAccess(request, document.projectId);
    if (access.response) return access.response;
    const bytes = await readProjectAnalysisExport(document.filePath);
    const contentType =
      document.type === "PDF" || document.type.endsWith("_PDF")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const safeFileName = document.fileName.replace(/[\r\n"\\]/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${safeFileName}"`,
        "content-length": String(bytes.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error, "Download project document");
  }
}
