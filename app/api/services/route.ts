import { connection } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { serviceCreateSchema } from "@/lib/user-validation";

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(): Promise<Response> {
  await connection();
  try {
    const services = await prisma.service.findMany({
      select: serviceSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ services });
  } catch (error) {
    return handleApiError(error, "List services");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = serviceCreateSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid service data.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const service = await prisma.service.create({
      data: { ...parsed.data, managerId: authorization.user.id },
      select: serviceSelect,
    });
    return Response.json({ service }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Create service");
  }
}
