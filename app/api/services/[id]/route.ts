import { connection } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { serviceUpdateSchema } from "@/lib/user-validation";

type ServiceRouteContext = { params: Promise<{ id: string }> };

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(
  _request: Request,
  { params }: ServiceRouteContext,
): Promise<Response> {
  await connection();
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Service ID must be a valid UUID." }, { status: 400 });
    }
    const service = await prisma.service.findUnique({ where: { id }, select: serviceSelect });
    if (!service) return Response.json({ error: "Service not found." }, { status: 404 });
    return Response.json({ service });
  } catch (error) {
    return handleApiError(error, "Read service");
  }
}

export async function PATCH(
  request: Request,
  { params }: ServiceRouteContext,
): Promise<Response> {
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Service ID must be a valid UUID." }, { status: 400 });
    }
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = serviceUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid service data.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const service = await prisma.service.update({
      where: { id },
      data: { ...parsed.data, managerId: authorization.user.id },
      select: serviceSelect,
    });
    return Response.json({ service });
  } catch (error) {
    return handleApiError(error, "Update service");
  }
}

export async function DELETE(
  request: Request,
  { params }: ServiceRouteContext,
): Promise<Response> {
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Service ID must be a valid UUID." }, { status: 400 });
    }
    await prisma.service.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Delete service");
  }
}
