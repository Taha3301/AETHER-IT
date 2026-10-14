import { randomUUID } from "node:crypto";
import { ProjectStatus, UserRole } from "@prisma/client";
import { connection } from "next/server";
import { handleApiError, hasSameOrigin } from "@/lib/api";
import { getAuthenticatedUser } from "@/lib/auth";
import { createGuestProjectToken, verifyGuestProjectToken } from "@/lib/guest-project";
import { generateProjectTitle, LlmConfigurationError, LlmRequestError } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/project-validation";

const projectSummarySelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  customerId: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  isGuest: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { conversations: true, documents: true } },
  aiAnalysis: { select: { id: true, updatedAt: true } },
} as const;

export async function GET(request: Request): Promise<Response> {
  await connection();
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      return Response.json({ error: "Authentication or guest project access is required." }, {
        status: 401,
      });
    }

    const user = await getAuthenticatedUser(request);
    if (user) {
      const projects = await prisma.project.findMany({
        where: user.role === UserRole.ADMIN ? {} : { customerId: user.id },
        select: projectSummarySelect,
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      return Response.json({ projects });
    }

    const projectId = await verifyGuestProjectToken(token);
    if (!projectId) {
      return Response.json({ error: "Authentication or guest project access is required." }, {
        status: 401,
      });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: projectSummarySelect,
    });
    if (!project || !project.isGuest || project.customerId !== null) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    return Response.json({ projects: [project] });
  } catch (error) {
    return handleApiError(error, "List projects");
  }
}

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
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project data.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (authorization && !token) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const user = token ? await getAuthenticatedUser(request) : null;
    if (token && !user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!user && (!parsed.data.guestName || !parsed.data.guestEmail)) {
      return Response.json(
        { error: "Guest projects require guestName and guestEmail." },
        { status: 400 },
      );
    }
    if (user && (parsed.data.guestName || parsed.data.guestEmail || parsed.data.guestPhone)) {
      return Response.json(
        { error: "Guest contact fields cannot be set for an authenticated project." },
        { status: 400 },
      );
    }

    const projectTitle = parsed.data.description
      ? await generateProjectTitle(parsed.data.description, parsed.data.language)
      : parsed.data.title;
    if (!projectTitle) {
      return Response.json({ error: "A project idea or title is required." }, { status: 400 });
    }

    const projectId = user ? undefined : randomUUID();
    const guestProjectToken = projectId ? await createGuestProjectToken(projectId) : undefined;
    const project = await prisma.project.create({
      data: {
        ...(projectId ? { id: projectId } : {}),
        title: projectTitle,
        description: parsed.data.description ?? null,
        status: ProjectStatus.DRAFT,
        customerId: user?.id ?? null,
        isGuest: !user,
        guestName: user ? null : parsed.data.guestName,
        guestEmail: user ? null : parsed.data.guestEmail,
        guestPhone: user ? null : parsed.data.guestPhone || null,
      },
      select: projectSummarySelect,
    });
    return Response.json(
      { project, ...(guestProjectToken ? { guestProjectToken } : {}) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof LlmConfigurationError) {
      return Response.json({ error: "AI service is not configured." }, { status: 503 });
    }
    if (error instanceof LlmRequestError) {
      return Response.json({ error: "AI service could not name the project." }, { status: 502 });
    }
    return handleApiError(error, "Create project");
  }
}
