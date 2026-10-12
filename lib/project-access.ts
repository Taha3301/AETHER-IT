import { UserRole } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyGuestProjectToken } from "@/lib/guest-project";

type ProjectAccessRecord = {
  id: string;
  customerId: string | null;
  isGuest: boolean;
};

export async function requireProjectAccess(
  request: Request,
  projectId: string,
  project?: ProjectAccessRecord | null,
): Promise<
  | {
      project: ProjectAccessRecord;
      user: { id: string; role: UserRole } | null;
      response?: never;
    }
  | { response: Response; project?: never; user?: never }
> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const user = token ? await getAuthenticatedUser(request) : null;
  let guestProjectId: string | null = null;
  if (!user && token) guestProjectId = await verifyGuestProjectToken(token);

  if (!user && !guestProjectId) {
    return {
      response: Response.json({ error: "Authentication or guest project access is required." }, {
        status: 401,
      }),
    };
  }

  const record =
    project === undefined
      ? await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, customerId: true, isGuest: true },
        })
      : project;
  if (!record) {
    return { response: Response.json({ error: "Project not found." }, { status: 404 }) };
  }

  if (user) {
    if (user.role !== UserRole.ADMIN && record.customerId !== user.id) {
      return { response: Response.json({ error: "Project access is forbidden." }, { status: 403 }) };
    }
    return { project: record, user };
  }

  if (guestProjectId !== projectId || !record.isGuest || record.customerId !== null) {
    return { response: Response.json({ error: "Project access is forbidden." }, { status: 403 }) };
  }
  return { project: record, user: null };
}

export async function requireProjectWriteOrigin(request: Request): Promise<Response | null> {
  if (!hasSameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }
  return null;
}
