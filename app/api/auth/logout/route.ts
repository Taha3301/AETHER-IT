import { getAuthenticatedUser } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/api";

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Valid Bearer token required." }, { status: 401 });

  return Response.json({
    success: true,
    message: "Discard this access token on the client. It remains valid until it expires.",
  });
}
