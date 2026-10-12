import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { getAuthenticatedUser: vi.fn() },
  guest: {
    createGuestProjectToken: vi.fn(),
    verifyGuestProjectToken: vi.fn(),
  },
  llm: {
    answerProjectMessage: vi.fn(),
    generateProjectAnalysis: vi.fn(),
  },
  files: {
    storeProjectAnalysisExport: vi.fn(),
    removeProjectAnalysisExport: vi.fn(),
    readProjectAnalysisExport: vi.fn(),
  },
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    aIAnalysis: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUser: mocks.auth.getAuthenticatedUser }));
vi.mock("@/lib/guest-project", () => ({
  createGuestProjectToken: mocks.guest.createGuestProjectToken,
  verifyGuestProjectToken: mocks.guest.verifyGuestProjectToken,
}));
vi.mock("@/lib/llm", () => ({
  answerProjectMessage: mocks.llm.answerProjectMessage,
  generateProjectAnalysis: mocks.llm.generateProjectAnalysis,
  LlmConfigurationError: class LlmConfigurationError extends Error {},
}));
vi.mock("@/lib/document-export", () => ({
  storeProjectAnalysisExport: mocks.files.storeProjectAnalysisExport,
  removeProjectAnalysisExport: mocks.files.removeProjectAnalysisExport,
  readProjectAnalysisExport: mocks.files.readProjectAnalysisExport,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { GET as listProjects, POST as createProject } from "@/app/api/projects/route";
import { GET as getProject, PATCH as updateProject } from "@/app/api/projects/[id]/route";
import {
  GET as listConversations,
  POST as startConversation,
} from "@/app/api/projects/[id]/conversations/route";
import { GET as getMessages, POST as sendMessage } from "@/app/api/conversations/[id]/messages/route";
import { POST as finishConversation } from "@/app/api/conversations/[id]/finish/route";
import {
  GET as getAnalysis,
  POST as generateAnalysis,
} from "@/app/api/projects/[id]/analysis/route";
import { GET as listDocuments, POST as exportDocument } from "@/app/api/projects/[id]/documents/route";
import { GET as downloadDocument } from "@/app/api/documents/[id]/download/route";
import { LlmConfigurationError } from "@/lib/llm";

const projectId = "30000000-0000-4000-8000-000000000003";
const conversationId = "40000000-0000-4000-8000-000000000004";
const documentId = "50000000-0000-4000-8000-000000000005";
const userId = "60000000-0000-4000-8000-000000000006";
const createdAt = new Date("2026-10-07T10:00:00.000Z");
const guestProject = {
  id: projectId,
  title: "Booking platform",
  description: "A service booking idea",
  status: "DRAFT",
  customerId: null,
  guestName: "Guest User",
  guestEmail: "guest@example.com",
  guestPhone: null,
  isGuest: true,
  createdAt,
  updatedAt: createdAt,
  _count: { conversations: 0, documents: 0 },
  aiAnalysis: null,
};
const projectAccess = {
  id: projectId,
  title: "Booking platform",
  customerId: null,
  isGuest: true,
};
const analysis = {
  summary: "A platform to book local services.",
  problem: "Customers struggle to find availability.",
  solution: "A searchable local service marketplace.",
  targetAudience: "Local customers",
  targetMarket: "Tunisia",
  businessModel: "Commission",
  valueProposition: "Fast local bookings",
  features: '["Search","Booking"]',
  competitors: "Unknown",
  technology: "Web application",
  marketingStrategy: "Local partnerships",
  roadmap: '["MVP","Launch"]',
  risks: "Customer acquisition",
};

function request(
  method: string,
  path: string,
  body?: unknown,
  token = "guest-token",
): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const projectContext = { params: Promise.resolve({ id: projectId }) };
const conversationContext = { params: Promise.resolve({ id: conversationId }) };
const documentContext = { params: Promise.resolve({ id: documentId }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.getAuthenticatedUser.mockResolvedValue(null);
  mocks.guest.createGuestProjectToken.mockResolvedValue("new-guest-token");
  mocks.guest.verifyGuestProjectToken.mockResolvedValue(projectId);
  mocks.llm.answerProjectMessage.mockResolvedValue("Let's define your target users.");
  mocks.llm.generateProjectAnalysis.mockResolvedValue(analysis);
  mocks.files.storeProjectAnalysisExport.mockResolvedValue({
    fileName: "Booking-platform-analysis.pdf",
    filePath: "generated-documents/11111111-1111-4111-8111-111111111111.pdf",
    fileSize: 1234,
  });
  mocks.files.removeProjectAnalysisExport.mockResolvedValue(undefined);
  mocks.files.readProjectAnalysisExport.mockResolvedValue(Buffer.from("%PDF"));

  mocks.prisma.project.findMany.mockResolvedValue([]);
  mocks.prisma.project.findUnique.mockResolvedValue(projectAccess);
  mocks.prisma.project.create.mockResolvedValue(guestProject);
  mocks.prisma.project.update.mockResolvedValue({ ...guestProject, status: "IN_PROGRESS" });
  mocks.prisma.conversation.findMany.mockResolvedValue([]);
  mocks.prisma.conversation.findUnique.mockResolvedValue({
    id: conversationId,
    projectId,
    project: projectAccess,
  });
  mocks.prisma.conversation.create.mockResolvedValue({
    id: conversationId,
    projectId,
    createdAt,
    updatedAt: createdAt,
  });
  mocks.prisma.conversation.update.mockResolvedValue({ id: conversationId, updatedAt: createdAt });
  mocks.prisma.message.findMany.mockResolvedValue([
    { id: "1", sender: "USER", content: "I need a booking app." },
  ]);
  mocks.prisma.message.create.mockImplementation(async ({ data }) => ({
    id: data.sender === "USER" ? "user-message" : "ai-message",
    conversationId: data.conversationId,
    sender: data.sender,
    content: data.content,
    createdAt,
  }));
  mocks.prisma.aIAnalysis.findUnique.mockResolvedValue(analysis);
  mocks.prisma.aIAnalysis.upsert.mockResolvedValue({ projectId, ...analysis });
  mocks.prisma.document.findMany.mockResolvedValue([]);
  mocks.prisma.document.findUnique.mockResolvedValue({
    id: documentId,
    projectId,
    type: "PDF",
    fileName: "Booking-platform-analysis.pdf",
    filePath: "generated-documents/11111111-1111-4111-8111-111111111111.pdf",
  });
  mocks.prisma.document.create.mockResolvedValue({
    id: documentId,
    projectId,
    type: "PDF",
    fileName: "Booking-platform-analysis.pdf",
    fileSize: 1234,
    createdAt,
  });
  mocks.prisma.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === "function") return operation(mocks.prisma);
    return Promise.all(operation as Promise<unknown>[]);
  });
});

describe("project creation and access", () => {
  it("creates guest projects with contact metadata and a signed project token", async () => {
    const response = await createProject(
      request("POST", "/api/projects", {
        title: "Booking platform",
        guestName: "Guest User",
        guestEmail: "GUEST@example.com",
      }, ""),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).guestProjectToken).toBe("new-guest-token");
    expect(mocks.prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: null,
          isGuest: true,
          guestEmail: "guest@example.com",
        }),
      }),
    );
  });

  it("links authenticated project creation to the signed-in user", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue({ id: userId, role: "CUSTOMER" });
    const response = await createProject(
      request("POST", "/api/projects", { title: "Member project" }, "user-token"),
    );
    expect(response.status).toBe(201);
    expect(mocks.prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: userId,
          isGuest: false,
          guestName: null,
          guestEmail: null,
        }),
      }),
    );
    expect(mocks.guest.createGuestProjectToken).not.toHaveBeenCalled();
  });

  it("lists only the project associated with a guest token", async () => {
    const response = await listProjects(request("GET", "/api/projects"));
    expect(response.status).toBe(200);
    expect((await response.json()).projects).toHaveLength(1);
    expect(mocks.guest.verifyGuestProjectToken).toHaveBeenCalledWith("guest-token");
  });

  it("requires guest contact fields and enforces guest-token project scope", async () => {
    const invalid = await createProject(
      request("POST", "/api/projects", { title: "Guest project" }, ""),
    );
    expect(invalid.status).toBe(400);

    mocks.guest.verifyGuestProjectToken.mockResolvedValue("another-project");
    const forbidden = await getProject(
      request("GET", `/api/projects/${projectId}`),
      projectContext,
    );
    expect(forbidden.status).toBe(403);
  });

  it("starts conversations for an authorized project and blocks missing credentials", async () => {
    const created = await startConversation(
      request("POST", `/api/projects/${projectId}/conversations`),
      projectContext,
    );
    expect(created.status).toBe(201);
    expect(mocks.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "IN_PROGRESS" } }),
    );

    const unauthorized = await startConversation(
      request("POST", `/api/projects/${projectId}/conversations`, undefined, ""),
      projectContext,
    );
    expect(unauthorized.status).toBe(401);
  });

  it("lists and updates authorized project conversations and details", async () => {
    const conversations = await listConversations(
      request("GET", `/api/projects/${projectId}/conversations`),
      projectContext,
    );
    expect(conversations.status).toBe(200);

    const updated = await updateProject(
      request("PATCH", `/api/projects/${projectId}`, { title: "Updated booking platform" }),
      projectContext,
    );
    expect(updated.status).toBe(200);
  });
});

describe("administrator project status", () => {
  it("allows administrators to update a project status", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue({ id: userId, role: "ADMIN" });
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      customerId: null,
      isGuest: true,
    });

    const response = await updateProject(
      request("PATCH", `/api/projects/${projectId}`, { status: "IN_PROGRESS" }, "admin-token"),
      projectContext,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "IN_PROGRESS" } }),
    );
  });

  it("does not allow customers to update a project status", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue({ id: userId, role: "CUSTOMER" });
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      customerId: userId,
      isGuest: false,
    });

    const response = await updateProject(
      request("PATCH", `/api/projects/${projectId}`, { status: "COMPLETED" }, "customer-token"),
      projectContext,
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.project.update).not.toHaveBeenCalled();
  });
});

describe("conversation and analysis workflow", () => {
  it("saves user and AI messages and returns chronological history", async () => {
    const sent = await sendMessage(
      request("POST", `/api/conversations/${conversationId}/messages`, {
        content: "I want a booking app.",
      }),
      conversationContext,
    );
    expect(sent.status).toBe(201);
    expect((await sent.json()).aiMessage.content).toBe("Let's define your target users.");
    expect(mocks.prisma.message.create).toHaveBeenCalledTimes(2);
    expect(mocks.llm.answerProjectMessage).toHaveBeenCalledOnce();

    const listed = await getMessages(
      request("GET", `/api/conversations/${conversationId}/messages`),
      conversationContext,
    );
    expect(listed.status).toBe(200);
    expect(mocks.prisma.message.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("allows administrators to send messages with an ADMIN sender and receive an AI reply", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue({ id: userId, role: "ADMIN" });
    mocks.prisma.message.findMany.mockResolvedValue([
      { id: "admin-turn", sender: "ADMIN", content: "Clarify the booking commission." },
    ]);

    const response = await sendMessage(
      request(
        "POST",
        `/api/conversations/${conversationId}/messages`,
        { content: "Clarify the booking commission.", sender: "ADMIN" },
        "admin-token",
      ),
      conversationContext,
    );

    expect(response.status).toBe(201);
    expect((await response.json()).message.sender).toBe("ADMIN");
    expect(mocks.prisma.message.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ sender: "ADMIN" }),
      }),
    );
    expect(mocks.llm.answerProjectMessage).toHaveBeenCalledWith(
      "Booking platform",
      [{ role: "user", content: "Clarify the booking commission." }],
    );
  });

  it("rejects customer attempts to send an ADMIN message", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue({ id: userId, role: "CUSTOMER" });
    mocks.prisma.conversation.findUnique.mockResolvedValue({
      id: conversationId,
      projectId,
      project: { ...projectAccess, customerId: userId, isGuest: false },
    });

    const response = await sendMessage(
      request(
        "POST",
        `/api/conversations/${conversationId}/messages`,
        { content: "Admin-only message.", sender: "ADMIN" },
        "customer-token",
      ),
      conversationContext,
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.message.create).not.toHaveBeenCalled();
  });

  it("sends the entire conversation history without a turn or character cutoff", async () => {
    const longHistory = Array.from({ length: 48 }, (_, index) => ({
      id: `history-${index.toString().padStart(2, "0")}`,
      sender: index % 2 === 0 ? "USER" : "AI",
      content: `Turn ${index.toString().padStart(2, "0")} ${"context ".repeat(500)}`,
    }));
    mocks.prisma.message.findMany.mockResolvedValue(longHistory);

    const response = await sendMessage(
      request("POST", `/api/conversations/${conversationId}/messages`, {
        content: "Remember what we discussed at the beginning?",
      }),
      conversationContext,
    );

    expect(response.status).toBe(201);
    const sentHistory = mocks.llm.answerProjectMessage.mock.calls[0][1];
    expect(sentHistory).toHaveLength(48);
    expect(sentHistory[0].content).toContain("Turn 00");
    expect(sentHistory[47].content).toContain("Turn 47");
    expect(
      sentHistory.reduce(
        (total: number, message: { content: string }) => total + message.content.length,
        0,
      ),
    ).toBeGreaterThan(32000);
  });

  it("retains the user message if the LLM is not configured", async () => {
    const error = new LlmConfigurationError("not configured");
    mocks.llm.answerProjectMessage.mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await sendMessage(
      request("POST", `/api/conversations/${conversationId}/messages`, {
        content: "Tell me more.",
      }),
      conversationContext,
    );
    expect(response.status).toBe(503);
    expect(mocks.prisma.message.create).toHaveBeenCalledTimes(1);
  });

  it("creates or refreshes analysis and marks the project ready", async () => {
    mocks.prisma.conversation.findMany.mockResolvedValue([
      {
        messages: [
          { sender: "USER", content: "I need a booking app." },
          { sender: "AI", content: "Who is it for?" },
        ],
      },
    ]);
    const response = await generateAnalysis(
      request("POST", `/api/projects/${projectId}/analysis`),
      projectContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.prisma.aIAnalysis.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId }, create: expect.objectContaining({ summary: analysis.summary }) }),
    );
    expect(mocks.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ANALYSIS_READY" } }),
    );
  });

  it("returns a saved analysis only to a project member", async () => {
    const response = await getAnalysis(
      request("GET", `/api/projects/${projectId}/analysis`),
      projectContext,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).analysis.summary).toBe(analysis.summary);
  });

  it("uses the finish-conversation endpoint to generate the same analysis", async () => {
    mocks.prisma.conversation.findMany.mockResolvedValue([
      { messages: [{ sender: "USER", content: "I need a booking app." }] },
    ]);
    const response = await finishConversation(
      request("POST", `/api/conversations/${conversationId}/finish`),
      conversationContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.llm.generateProjectAnalysis).toHaveBeenCalledOnce();
    expect(mocks.prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } }),
    );
  });
});

describe("private document exports", () => {
  it("creates private export metadata and only downloads after project authorization", async () => {
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      title: "Booking platform",
      customerId: null,
      isGuest: true,
      aiAnalysis: analysis,
    });
    const exported = await exportDocument(
      request("POST", `/api/projects/${projectId}/documents`, { type: "PDF" }),
      projectContext,
    );
    expect(exported.status).toBe(201);
    expect(mocks.prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId,
          type: "PDF",
          filePath: expect.stringMatching(/^generated-documents\//),
        }),
      }),
    );

    const download = await downloadDocument(
      request("GET", `/api/documents/${documentId}/download`),
      documentContext,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("cache-control")).toBe("private, no-store");
    expect(download.headers.get("content-type")).toBe("application/pdf");
  });

  it("exports a French cahier des charges in the requested file format", async () => {
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      title: "Booking platform",
      customerId: null,
      isGuest: true,
      aiAnalysis: analysis,
    });
    const exported = await exportDocument(
      request("POST", `/api/projects/${projectId}/documents`, {
        type: "DOCX",
        documentKind: "CAHIER_DES_CHARGES",
      }),
      projectContext,
    );
    expect(exported.status).toBe(201);
    expect(mocks.files.storeProjectAnalysisExport).toHaveBeenCalledWith(
      "Booking platform",
      analysis,
      "DOCX",
      "CAHIER_DES_CHARGES",
    );
    expect(mocks.prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CAHIER_DES_CHARGES_DOCX" }),
      }),
    );
  });

  it("requires analysis before creating an export and supports listing documents", async () => {
    mocks.prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      title: "Booking platform",
      customerId: null,
      isGuest: true,
      aiAnalysis: null,
    });
    const missingAnalysis = await exportDocument(
      request("POST", `/api/projects/${projectId}/documents`, { type: "DOCX" }),
      projectContext,
    );
    expect(missingAnalysis.status).toBe(409);

    mocks.prisma.project.findUnique.mockResolvedValue(projectAccess);
    const listed = await listDocuments(
      request("GET", `/api/projects/${projectId}/documents`),
      projectContext,
    );
    expect(listed.status).toBe(200);
  });

  it("does not expose a project export to another guest token", async () => {
    mocks.guest.verifyGuestProjectToken.mockResolvedValue("different-project");
    const response = await downloadDocument(
      request("GET", `/api/documents/${documentId}/download`),
      documentContext,
    );
    expect(response.status).toBe(403);
    expect(mocks.files.readProjectAnalysisExport).not.toHaveBeenCalled();
  });
});
