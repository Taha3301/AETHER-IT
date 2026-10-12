import { UserRole } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/api";

export async function requireAdmin(
  request: Request,
): Promise<{ user: { id: string } } | { response: Response }> {
  if (!hasSameOrigin(request)) {
    return {
      response: Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 }),
    };
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (user.role !== UserRole.ADMIN) {
    return { response: Response.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { user };
}
