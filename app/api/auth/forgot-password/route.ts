import { randomInt } from "node:crypto";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetCode } from "@/lib/password-reset-code";
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/password-reset-mail";
import { forgotPasswordSchema } from "@/lib/user-validation";

const responseMessage =
  "If an account exists for this email, password reset instructions will be sent.";
const tokenLifetimeMs = 60 * 60 * 1000;
const requestCooldownMs = 60 * 1000;
const resetCodeDigits = 6;

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  if (!isPasswordResetEmailConfigured()) {
    return Response.json(
      { error: "Password reset email is not configured. Set the SMTP environment variables." },
      { status: 503 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (!user) return Response.json({ message: responseMessage });

    const now = new Date();
    const code = randomInt(0, 10 ** resetCodeDigits).toString().padStart(resetCodeDigits, "0");
    const codeHash = hashPasswordResetCode(user.id, code);
    const created = await prisma.$transaction(async (transaction) => {
      const rateLimit = await transaction.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { passwordResetRequestedAt: null },
            { passwordResetRequestedAt: { lt: new Date(now.getTime() - requestCooldownMs) } },
          ],
        },
        data: { passwordResetRequestedAt: now },
      });
      if (rateLimit.count === 0) return false;

      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await transaction.passwordResetToken.create({
        data: {
          codeHash,
          userId: user.id,
          expiresAt: new Date(now.getTime() + tokenLifetimeMs),
        },
      });
      return true;
    });

    if (!created) return Response.json({ message: responseMessage });

    try {
      await sendPasswordResetEmail(parsed.data.email, code);
    } catch (error) {
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { codeHash } }),
        prisma.user.updateMany({
          where: { id: user.id, passwordResetRequestedAt: now },
          data: { passwordResetRequestedAt: null },
        }),
      ]);
      throw error;
    }

    return Response.json({ message: responseMessage });
  } catch (error) {
    return handleApiError(error, "Request password reset");
  }
}
