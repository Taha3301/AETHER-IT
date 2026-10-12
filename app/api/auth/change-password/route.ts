import bcrypt from "bcryptjs";
import { getAuthenticatedUser } from "@/lib/auth";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/user-validation";

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid password data.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      select: { password: true },
    });
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
      return Response.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const password = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: authenticatedUser.id },
        data: {
          password,
          sessionVersion: { increment: 1 },
          passwordResetRequestedAt: null,
        },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: authenticatedUser.id },
      }),
    ]);

    return Response.json({
      message: "Password changed successfully. Please log in again with your new password.",
    });
  } catch (error) {
    return handleApiError(error, "Change password");
  }
}
