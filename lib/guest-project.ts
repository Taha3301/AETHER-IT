import { Prisma } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

const guestTokenDuration = "30d";

function guestTokenKey(): Uint8Array {
  const secret = process.env.GUEST_PROJECT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("GUEST_PROJECT_TOKEN_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createGuestProjectToken(projectId: string): Promise<string> {
  return new SignJWT({ purpose: "guest-project-access", projectId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("aetherit")
    .setAudience("aetherit-guest-project")
    .setIssuedAt()
    .setExpirationTime(guestTokenDuration)
    .sign(guestTokenKey());
}

export async function verifyGuestProjectToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, guestTokenKey(), {
      issuer: "aetherit",
      audience: "aetherit-guest-project",
    });
    if (
      payload.purpose !== "guest-project-access" ||
      typeof payload.projectId !== "string"
    ) {
      return null;
    }
    return payload.projectId;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GUEST_PROJECT_TOKEN_SECRET")) {
      throw error;
    }
    return null;
  }
}

export class GuestProjectClaimError extends Error {}

export async function claimGuestProject(
  transaction: Prisma.TransactionClient,
  projectId: string,
  userId: string,
): Promise<void> {
  const result = await transaction.project.updateMany({
    where: { id: projectId, customerId: null, isGuest: true },
    data: { customerId: userId, isGuest: false },
  });

  if (result.count === 1) return;

  const project = await transaction.project.findUnique({
    where: { id: projectId },
    select: { customerId: true, isGuest: true },
  });

  if (project?.customerId === userId && !project.isGuest) return;
  throw new GuestProjectClaimError("The guest project cannot be claimed.");
}
