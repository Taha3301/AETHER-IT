import bcrypt from "bcryptjs";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { createSessionToken, sessionDurationSeconds } from "@/lib/auth";
import {
  claimGuestProject,
  GuestProjectClaimError,
  verifyGuestProjectToken,
} from "@/lib/guest-project";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/user-validation";

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid login data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const guestProjectId = parsed.data.guestProjectToken
    ? await verifyGuestProjectToken(parsed.data.guestProjectToken)
    : null;
  if (parsed.data.guestProjectToken && !guestProjectId) {
    return Response.json({ error: "Guest project token is invalid or expired." }, { status: 401 });
  }

  try {
    const userWithPassword = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (
      !userWithPassword ||
      !(await bcrypt.compare(parsed.data.password, userWithPassword.password))
    ) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const user = {
      id: userWithPassword.id,
      name: userWithPassword.name,
      email: userWithPassword.email,
      phone: userWithPassword.phone,
      role: userWithPassword.role,
      createdAt: userWithPassword.createdAt,
      updatedAt: userWithPassword.updatedAt,
    };
    const accessToken = await createSessionToken({
      id: userWithPassword.id,
      role: userWithPassword.role,
      sessionVersion: userWithPassword.sessionVersion,
    });

    if (guestProjectId) {
      await prisma.$transaction((transaction) =>
        claimGuestProject(transaction, guestProjectId, userWithPassword.id),
      );
    }

    return Response.json({
      user,
      accessToken,
      tokenType: "Bearer",
      expiresIn: sessionDurationSeconds,
    });
  } catch (error) {
    if (error instanceof GuestProjectClaimError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error, "Log in");
  }
}
