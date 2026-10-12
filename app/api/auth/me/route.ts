import { connection } from "next/server";
import { handleApiError } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  await connection();
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
    return Response.json({ user });
  } catch (error) {
    return handleApiError(error, "Read current user");
  }
}
