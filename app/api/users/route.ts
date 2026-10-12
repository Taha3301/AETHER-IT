import { UserRole } from "@prisma/client";
import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCustomer, publicUserSelect } from "@/lib/user-routes";

const pageSize = 50;

export async function GET(request: Request): Promise<Response> {
  await connection();
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (currentUser.role !== UserRole.ADMIN) {
      return Response.json({ error: "Administrator access required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1) {
      return Response.json({ error: "Page must be a positive integer." }, { status: 400 });
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: publicUserSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);

    return Response.json({ users, page, pageSize, total });
  } catch (error) {
    return handleApiError(error, "List users");
  }
}

export async function POST(request: Request): Promise<Response> {
  return createCustomer(request);
}
