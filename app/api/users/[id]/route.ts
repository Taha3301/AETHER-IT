import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-routes";
import { updateUserSchema } from "@/lib/user-validation";
import { z } from "zod";

type UserRouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: UserRouteContext,
): Promise<Response> {
  await connection();
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "User ID must be a valid UUID." }, { status: 400 });
    }
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      return Response.json({ error: "You cannot access this user." }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });
    return Response.json({ user });
  } catch (error) {
    return handleApiError(error, "Read user");
  }
}

export async function PATCH(
  request: Request,
  { params }: UserRouteContext,
): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "User ID must be a valid UUID." }, { status: 400 });
    }
    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (!isAdmin && currentUser.id !== id) {
      return Response.json({ error: "You cannot update this user." }, { status: 403 });
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid user data.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (parsed.data.role && !isAdmin) {
      return Response.json({ error: "Only an administrator can change user roles." }, { status: 403 });
    }
    if (parsed.data.password !== undefined && currentUser.id === id) {
      return Response.json(
        { error: "Use POST /api/auth/change-password to change your own password." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existingUser) return Response.json({ error: "User not found." }, { status: 404 });

    if (
      existingUser.role === UserRole.ADMIN &&
      parsed.data.role === UserRole.CUSTOMER
    ) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        return Response.json({ error: "The last administrator cannot be demoted." }, { status: 409 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.password !== undefined && {
          password: await bcrypt.hash(parsed.data.password, 12),
          sessionVersion: { increment: 1 },
        }),
      },
      select: publicUserSelect,
    });

    return Response.json({ user: updatedUser });
  } catch (error) {
    return handleApiError(error, "Update user");
  }
}

export async function DELETE(
  request: Request,
  { params }: UserRouteContext,
): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "User ID must be a valid UUID." }, { status: 400 });
    }
    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (!isAdmin && currentUser.id !== id) {
      return Response.json({ error: "You cannot delete this user." }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, _count: { select: { projects: true } } },
    });
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    if (user._count.projects > 0) {
      return Response.json(
        { error: "This user owns projects. Transfer or archive them before deleting the account." },
        { status: 409 },
      );
    }

    if (user.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        return Response.json({ error: "The last administrator cannot be deleted." }, { status: 409 });
      }
    }

    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Delete user");
  }
}
