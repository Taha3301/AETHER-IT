import bcrypt from "bcryptjs";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyPasswordResetCode } from "@/lib/password-reset-code";
import { resetPasswordSchema } from "@/lib/user-validation";

const invalidCodeMessage = "The verification code is invalid or expired.";
const maxCodeAttempts = 5;

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

  const parsed = resetPasswordSchema.safeParse(input);
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
    if (!user) return Response.json({ error: invalidCodeMessage }, { status: 400 });

    const resetCode = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      select: { id: true, codeHash: true, attemptsUsed: true, expiresAt: true },
    });
    const now = new Date();
    if (
      !resetCode ||
      resetCode.expiresAt <= now ||
      resetCode.attemptsUsed >= maxCodeAttempts
    ) {
      return Response.json({ error: invalidCodeMessage }, { status: 400 });
    }

    if (!verifyPasswordResetCode(user.id, parsed.data.code, resetCode.codeHash)) {
      await prisma.passwordResetToken.updateMany({
        where: {
          id: resetCode.id,
          expiresAt: { gt: now },
          attemptsUsed: { lt: maxCodeAttempts },
        },
        data: { attemptsUsed: { increment: 1 } },
      });
      return Response.json({ error: invalidCodeMessage }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const consumed = await prisma.$transaction(async (transaction) => {
      const deletion = await transaction.passwordResetToken.deleteMany({
        where: {
          id: resetCode.id,
          userId: user.id,
          expiresAt: { gt: new Date() },
          attemptsUsed: { lt: maxCodeAttempts },
        },
      });
      if (deletion.count !== 1) return false;

      await transaction.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
          sessionVersion: { increment: 1 },
          passwordResetRequestedAt: null,
        },
      });
      await transaction.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return true;
    });

    if (!consumed) {
      return Response.json({ error: invalidCodeMessage }, { status: 400 });
    }

    return Response.json({ message: "Password has been reset successfully." });
  } catch (error) {
    return handleApiError(error, "Reset password");
  }
}
