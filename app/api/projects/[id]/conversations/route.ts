import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  await connection();
  try {
    const { id } = await context.params;
    const access = await requireProjectAccess(request, id);
    if (access.response) return access.response;
    const conversations = await prisma.conversation.findMany({
      where: { projectId: id },
      select: {
        id: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ conversations });
  } catch (error) {
    return handleApiError(error, "List project conversations");
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
    const conversation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.conversation.create({
        data: { projectId: id },
        select: { id: true, projectId: true, createdAt: true, updatedAt: true },
      });
      await transaction.project.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
      return created;
    });
    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Start project conversation");
  }
}
