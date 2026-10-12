import bcrypt from "bcryptjs";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { createSessionToken, sessionDurationSeconds } from "@/lib/auth";
import {
  claimGuestProject,
  GuestProjectClaimError,
  verifyGuestProjectToken,
} from "@/lib/guest-project";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/user-validation";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createCustomer(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid user data.", details: parsed.error.flatten().fieldErrors },
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
    const password = await bcrypt.hash(parsed.data.password, 12);
    const { user, accessToken } = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          password,
          phone: parsed.data.phone || null,
          role: "CUSTOMER",
          sessionVersion: 0,
        },
        select: publicUserSelect,
      });

      if (guestProjectId) {
        await claimGuestProject(transaction, guestProjectId, createdUser.id);
      }

      return {
        user: createdUser,
        accessToken: await createSessionToken({ ...createdUser, sessionVersion: 0 }),
      };
    });

    return Response.json(
      {
        user,
        accessToken,
        tokenType: "Bearer",
        expiresIn: sessionDurationSeconds,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GuestProjectClaimError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error, "Create customer");
  }
}
