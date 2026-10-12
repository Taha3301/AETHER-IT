import { Prisma } from "@prisma/client";

export function handleApiError(error: unknown, operation: string): Response {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return Response.json(
        { error: "A record with these unique values already exists." },
        { status: 409 },
      );
    }

    if (error.code === "P2025") {
      return Response.json({ error: "The requested record was not found." }, { status: 404 });
    }
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  console.error(`[${operation}]`, errorCode ?? errorName);

  return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestOrigin = new URL(request.url);
    const suppliedOrigin = new URL(origin);
    if (suppliedOrigin.origin === requestOrigin.origin) return true;

    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      suppliedOrigin.protocol === requestOrigin.protocol &&
      suppliedOrigin.port === requestOrigin.port &&
      loopbackHosts.has(suppliedOrigin.hostname) &&
      loopbackHosts.has(requestOrigin.hostname)
    );
  } catch {
    return false;
  }
}
