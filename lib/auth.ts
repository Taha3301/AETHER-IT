import { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const sessionDurationSeconds = 60 * 60 * 48;

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: {
  id: string;
  role: UserRole;
  sessionVersion?: number;
}): Promise<string> {
  return new SignJWT({ role: user.role, sessionVersion: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("aetherit")
    .setAudience("aetherit-web")
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(sessionKey());
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearerToken) return null;

  const key = sessionKey();
  let subject: string | undefined;
  let sessionVersion: number | undefined;
  try {
    const { payload } = await jwtVerify(bearerToken, key, {
      issuer: "aetherit",
      audience: "aetherit-web",
    });
    subject = payload.sub;
    sessionVersion =
      typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0;
  } catch {
    return null;
  }

  if (!subject) return null;
  const user = await prisma.user.findUnique({
    where: { id: subject },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      sessionVersion: true,
    },
  });
  if (!user) return null;
  const { sessionVersion: _sessionVersion, ...publicUser } = user;
  if (_sessionVersion !== sessionVersion) return null;
  return publicUser;
}
