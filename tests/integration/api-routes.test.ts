import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: { id: "10000000-0000-4000-8000-000000000001", role: "CUSTOMER" },
  auth: {
    getAuthenticatedUser: vi.fn(),
    createSessionToken: vi.fn(),
    sessionDurationSeconds: 172800,
  },
  bcrypt: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  mail: {
    isPasswordResetEmailConfigured: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  },
  image: {
    storeImage: vi.fn(),
    removeStoredImage: vi.fn(),
  },
  passwordCode: {
    hashPasswordResetCode: vi.fn(),
    verifyPasswordResetCode: vi.fn(),
  },
  guest: {
    verifyGuestProjectToken: vi.fn(),
    claimGuestProject: vi.fn(),
  },
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    websiteContent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    passwordResetToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: mocks.auth.getAuthenticatedUser,
  createSessionToken: mocks.auth.createSessionToken,
  sessionDurationSeconds: mocks.auth.sessionDurationSeconds,
}));
vi.mock("bcryptjs", () => ({ default: mocks.bcrypt }));
vi.mock("@/lib/password-reset-mail", () => ({
  isPasswordResetEmailConfigured: mocks.mail.isPasswordResetEmailConfigured,
  sendPasswordResetEmail: mocks.mail.sendPasswordResetEmail,
}));
vi.mock("@/lib/image-storage", () => ({
  ImageUploadError: class ImageUploadError extends Error {},
  storeImage: mocks.image.storeImage,
  removeStoredImage: mocks.image.removeStoredImage,
}));
vi.mock("@/lib/password-reset-code", () => ({
  hashPasswordResetCode: mocks.passwordCode.hashPasswordResetCode,
  verifyPasswordResetCode: mocks.passwordCode.verifyPasswordResetCode,
}));
vi.mock("@/lib/guest-project", () => ({
  verifyGuestProjectToken: mocks.guest.verifyGuestProjectToken,
  claimGuestProject: mocks.guest.claimGuestProject,
  GuestProjectClaimError: class GuestProjectClaimError extends Error {},
}));

import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { GET as listUsers, POST as createUser } from "@/app/api/users/route";
import {
  DELETE as deleteUser,
  GET as getUser,
  PATCH as updateUser,
} from "@/app/api/users/[id]/route";
import {
  GET as listEmployees,
  POST as createEmployee,
} from "@/app/api/employees/route";
import {
  DELETE as deleteEmployee,
  GET as getEmployee,
  PATCH as updateEmployee,
} from "@/app/api/employees/[id]/route";
import { GET as listServices, POST as createService } from "@/app/api/services/route";
import {
  DELETE as deleteService,
  GET as getService,
  PATCH as updateService,
} from "@/app/api/services/[id]/route";
import {
  GET as listWebsiteContent,
  POST as createWebsiteContent,
} from "@/app/api/website-content/route";
import {
  DELETE as deleteWebsiteContent,
  GET as getWebsiteContent,
  PATCH as updateWebsiteContent,
} from "@/app/api/website-content/[id]/route";

const userId = "10000000-0000-4000-8000-000000000001";
const recordId = "20000000-0000-4000-8000-000000000002";
const timestamp = new Date("2026-01-01T00:00:00.000Z");
const customer = {
  id: userId,
  name: "Test User",
  email: "test@example.com",
  phone: null,
  role: "CUSTOMER",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const admin = { ...customer, role: "ADMIN" };
const employee = {
  id: recordId,
  name: "Jane Smith",
  role: "Designer",
  description: null,
  photo: null,
  linkedinUrl: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const service = {
  id: recordId,
  name: "Consulting",
  description: null,
  icon: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const websiteContent = {
  id: recordId,
  section: "hero",
  title: null,
  content: null,
  imageUrl: null,
  updatedAt: timestamp,
};

function request(
  method: string,
  path: string,
  body?: unknown,
  options: { token?: string; form?: FormData } = {},
): Request {
  const headers = new Headers();
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.form) {
    body = options.form;
  } else if (body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: body as BodyInit } : {}),
  });
}

function routeContext(id = recordId) {
  return { params: Promise.resolve({ id }) };
}

async function json(response: Response) {
  return response.status === 204 ? null : response.json();
}

beforeEach(() => {
  mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
  mocks.auth.createSessionToken.mockResolvedValue("test-jwt");
  mocks.bcrypt.compare.mockResolvedValue(true);
  mocks.bcrypt.hash.mockResolvedValue("hashed-password");
  mocks.mail.isPasswordResetEmailConfigured.mockReturnValue(true);
  mocks.mail.sendPasswordResetEmail.mockResolvedValue(undefined);
  mocks.image.storeImage.mockResolvedValue({
    fileName: "test-image.jpg",
    url: "/images/test-image.jpg",
    contentType: "image/jpeg",
    size: 4,
  });
  mocks.image.removeStoredImage.mockResolvedValue(undefined);
  mocks.passwordCode.hashPasswordResetCode.mockReturnValue("hashed-code");
  mocks.passwordCode.verifyPasswordResetCode.mockReturnValue(true);
  mocks.guest.verifyGuestProjectToken.mockResolvedValue(null);

  for (const model of [
    mocks.prisma.user,
    mocks.prisma.employee,
    mocks.prisma.service,
    mocks.prisma.websiteContent,
    mocks.prisma.passwordResetToken,
  ]) {
    for (const method of Object.values(model)) {
      method.mockReset();
    }
  }
  mocks.prisma.user.findUnique.mockResolvedValue(null);
  mocks.prisma.user.findMany.mockResolvedValue([]);
  mocks.prisma.user.count.mockResolvedValue(0);
  mocks.prisma.user.create.mockResolvedValue(customer);
  mocks.prisma.user.update.mockResolvedValue(customer);
  mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.user.delete.mockResolvedValue(customer);
  mocks.prisma.employee.findMany.mockResolvedValue([]);
  mocks.prisma.employee.findUnique.mockResolvedValue(null);
  mocks.prisma.employee.create.mockResolvedValue(employee);
  mocks.prisma.employee.update.mockResolvedValue(employee);
  mocks.prisma.employee.delete.mockResolvedValue(employee);
  mocks.prisma.service.findMany.mockResolvedValue([]);
  mocks.prisma.service.findUnique.mockResolvedValue(null);
  mocks.prisma.service.create.mockResolvedValue(service);
  mocks.prisma.service.update.mockResolvedValue(service);
  mocks.prisma.service.delete.mockResolvedValue(service);
  mocks.prisma.websiteContent.findMany.mockResolvedValue([]);
  mocks.prisma.websiteContent.findUnique.mockResolvedValue(null);
  mocks.prisma.websiteContent.create.mockResolvedValue(websiteContent);
  mocks.prisma.websiteContent.update.mockResolvedValue(websiteContent);
  mocks.prisma.websiteContent.delete.mockResolvedValue(websiteContent);
  mocks.prisma.passwordResetToken.findFirst.mockResolvedValue(null);
  mocks.prisma.passwordResetToken.create.mockResolvedValue({});
  mocks.prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.$transaction.mockImplementation(async (operation: unknown) => {
    if (typeof operation === "function") return operation(mocks.prisma);
    return Promise.all(operation as Promise<unknown>[]);
  });

  mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
});

describe("authentication API routes", () => {
  it("creates a customer through signup and the user-registration alias", async () => {
    const created = await signup(
      request("POST", "/api/auth/signup", {
        name: "Test User",
        email: "TEST@example.com",
        password: "password1",
      }),
    );
    expect(created.status).toBe(201);
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "CUSTOMER" }) }),
    );

    const alias = await createUser(
      request("POST", "/api/users", {
        name: "Test User",
        email: "TEST@example.com",
        password: "password1",
      }),
    );
    expect(alias.status).toBe(201);
  });

  it("rejects invalid login and returns a JWT for valid credentials", async () => {
    const invalid = await login(request("POST", "/api/auth/login", { email: "bad", password: "x" }));
    expect(invalid.status).toBe(400);

    mocks.prisma.user.findUnique.mockResolvedValue({
      ...customer,
      password: "stored-hash",
      sessionVersion: 0,
    });
    const valid = await login(
      request("POST", "/api/auth/login", {
        email: "test@example.com",
        password: "password1",
      }),
    );
    expect(valid.status).toBe(200);
    expect((await json(valid)).accessToken).toBe("test-jwt");
  });

  it("protects current-user and logout routes with a valid JWT", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(null);
    expect((await me(request("GET", "/api/auth/me"))).status).toBe(401);
    expect((await logout(request("POST", "/api/auth/logout"))).status).toBe(401);
    mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
    expect((await me(request("GET", "/api/auth/me", undefined, { token: "valid" }))).status).toBe(
      200,
    );
    expect(
      (
        await logout(
          request("POST", "/api/auth/logout", undefined, { token: "valid" }),
        )
      ).status,
    ).toBe(200);
  });

  it("changes password only after checking the old password and revokes reset codes", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ password: "stored-hash" });
    mocks.bcrypt.compare.mockResolvedValue(false);
    expect(
      (
        await changePassword(
          request(
            "POST",
            "/api/auth/change-password",
            { currentPassword: "wrong", newPassword: "new-pass" },
            { token: "valid" },
          ),
        )
      ).status,
    ).toBe(401);

    mocks.bcrypt.compare.mockResolvedValue(true);
    expect(
      (
        await changePassword(
          request(
            "POST",
            "/api/auth/change-password",
            { currentPassword: "old-pass", newPassword: "new-pass" },
            { token: "valid" },
          ),
        )
      ).status,
    ).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
      }),
    );
  });

  it("returns generic forgot-password responses and rejects unavailable SMTP", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect(
      (
        await forgotPassword(
          request("POST", "/api/auth/forgot-password", { email: "unknown@example.com" }),
        )
      ).status,
    ).toBe(200);

    mocks.mail.isPasswordResetEmailConfigured.mockReturnValue(false);
    expect(
      (
        await forgotPassword(
          request("POST", "/api/auth/forgot-password", { email: "user@example.com" }),
        )
      ).status,
    ).toBe(503);
  });

  it("issues one reset code, sends it by email, and applies the per-account cooldown", async () => {
      mocks.prisma.user.findUnique.mockResolvedValue({ id: userId });
      mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
      const firstRequest = await forgotPassword(
        request("POST", "/api/auth/forgot-password", { email: "test@example.com" }),
      );
      expect(firstRequest.status).toBe(200);
      expect(mocks.prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            codeHash: "hashed-code",
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mocks.mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        "test@example.com",
        expect.stringMatching(/^\d{6}$/),
      );

      mocks.prisma.user.updateMany.mockResolvedValue({ count: 0 });
      const cooldownRequest = await forgotPassword(
        request("POST", "/api/auth/forgot-password", { email: "test@example.com" }),
      );
      expect(cooldownRequest.status).toBe(200);
      expect(mocks.mail.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it("rejects malformed reset requests and atomically consumes valid reset codes", async () => {
      const response = await resetPassword(
        request("POST", "/api/auth/reset-password", {
          email: "user@example.com",
        code: "not-six-digits",
        password: "new-pass",
      }),
    );
    expect(response.status).toBe(400);

    mocks.prisma.user.findUnique.mockResolvedValue({ id: userId });
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: recordId,
      codeHash: "hashed-code",
      attemptsUsed: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const validResponse = await resetPassword(
      request("POST", "/api/auth/reset-password", {
        email: "test@example.com",
        code: "012345",
        password: "new-password",
      }),
    );
    expect(validResponse.status).toBe(200);
    expect(mocks.passwordCode.verifyPasswordResetCode).toHaveBeenCalledWith(
      userId,
      "012345",
      "hashed-code",
    );
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({
          password: "hashed-password",
          sessionVersion: { increment: 1 },
        }),
      }),
    );
    expect(mocks.prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("tracks invalid reset-code attempts and rejects expired codes", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: userId });
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: recordId,
      codeHash: "hashed-code",
      attemptsUsed: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.passwordCode.verifyPasswordResetCode.mockReturnValue(false);
    expect(
      (
        await resetPassword(
          request("POST", "/api/auth/reset-password", {
            email: "test@example.com",
            code: "123456",
            password: "new-password",
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: recordId }),
        data: { attemptsUsed: { increment: 1 } },
      }),
    );

    mocks.prisma.passwordResetToken.updateMany.mockClear();
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: recordId,
      codeHash: "hashed-code",
      attemptsUsed: 0,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const expired = await resetPassword(
      request("POST", "/api/auth/reset-password", {
        email: "test@example.com",
        code: "123456",
        password: "new-password",
      }),
    );
    expect(expired.status).toBe(400);
    expect(mocks.prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("user-management API routes", () => {
  it("allows only admins to list users and validates pagination", async () => {
    expect((await listUsers(request("GET", "/api/users"))).status).toBe(403);
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    expect((await listUsers(request("GET", "/api/users?page=0"))).status).toBe(400);
    mocks.prisma.$transaction.mockResolvedValue([[], 0]);
    expect((await listUsers(request("GET", "/api/users?page=1"))).status).toBe(200);
  });

  it("supports self-read while blocking password changes through profile PATCH", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
    mocks.prisma.user.findUnique.mockResolvedValue(customer);
    expect(
      (await getUser(request("GET", `/api/users/${userId}`, undefined, { token: "valid" }), routeContext(userId)))
        .status,
    ).toBe(200);
    const response = await updateUser(
      request(
        "PATCH",
        `/api/users/${userId}`,
        { password: "new-pass" },
        { token: "valid" },
      ),
      routeContext(userId),
    );
    expect(response.status).toBe(400);
  });

  it("updates a user's own profile and lets an admin update another user's role", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
    mocks.prisma.user.findUnique.mockResolvedValue({ id: userId, role: "CUSTOMER" });
    mocks.prisma.user.update.mockResolvedValue({ ...customer, name: "Updated Name" });
    const selfUpdate = await updateUser(
      request("PATCH", `/api/users/${userId}`, { name: "Updated Name" }, { token: "valid" }),
      routeContext(userId),
    );
    expect(selfUpdate.status).toBe(200);

    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.user.findUnique.mockResolvedValue({ id: recordId, role: "CUSTOMER" });
    const roleUpdate = await updateUser(
      request("PATCH", `/api/users/${recordId}`, { role: "ADMIN" }, { token: "admin" }),
      routeContext(recordId),
    );
    expect(roleUpdate.status).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: recordId },
        data: expect.objectContaining({ role: "ADMIN" }),
      }),
    );
  });

  it("prevents deleting owned-project accounts or the last administrator", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(customer);
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      _count: { projects: 1 },
    });
    const hasProjects = await deleteUser(
      request("DELETE", `/api/users/${userId}`, undefined, { token: "valid" }),
      routeContext(userId),
    );
    expect(hasProjects.status).toBe(409);

    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "ADMIN",
      _count: { projects: 0 },
    });
    mocks.prisma.user.count.mockResolvedValue(1);
    const lastAdmin = await deleteUser(
      request("DELETE", `/api/users/${userId}`, undefined, { token: "admin" }),
      routeContext(userId),
    );
    expect(lastAdmin.status).toBe(409);
  });

  it("deletes own user only after account rules allow it", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: userId,
      role: "CUSTOMER",
      _count: { projects: 0 },
    });
    expect(
      (
        await deleteUser(
          request("DELETE", `/api/users/${userId}`, undefined, { token: "valid" }),
          routeContext(userId),
        )
      ).status,
    ).toBe(204);
  });
});

describe.each([
  {
    name: "employees",
    collectionGet: listEmployees,
    collectionPost: createEmployee,
    itemGet: getEmployee,
    itemPatch: updateEmployee,
    itemDelete: deleteEmployee,
    collectionPath: "/api/employees",
    delegate: mocks.prisma.employee,
    record: employee,
    createBody: { name: "Jane Smith", role: "Designer" },
    updateBody: { name: "Jane Doe" },
  },
  {
    name: "services",
    collectionGet: listServices,
    collectionPost: createService,
    itemGet: getService,
    itemPatch: updateService,
    itemDelete: deleteService,
    collectionPath: "/api/services",
    delegate: mocks.prisma.service,
    record: service,
    createBody: { name: "Consulting" },
    updateBody: { name: "Consulting Plus" },
  },
  {
    name: "website content",
    collectionGet: listWebsiteContent,
    collectionPost: createWebsiteContent,
    itemGet: getWebsiteContent,
    itemPatch: updateWebsiteContent,
    itemDelete: deleteWebsiteContent,
    collectionPath: "/api/website-content",
    delegate: mocks.prisma.websiteContent,
    record: websiteContent,
    createBody: { section: "hero" },
    updateBody: { title: "Welcome" },
  },
])("$name API routes", (api) => {
  it("provides public list and item reads", async () => {
    api.delegate.findMany.mockResolvedValue([api.record]);
    api.delegate.findUnique.mockResolvedValue(api.record);
    expect((await api.collectionGet()).status).toBe(200);
    expect(
      (
        await api.itemGet(
          request("GET", `${api.collectionPath}/${recordId}`),
          routeContext(),
        )
      ).status,
    ).toBe(200);
  });

  it("rejects writes without admin authorization", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(null);
    expect(
      (
        await api.collectionPost(
          request("POST", api.collectionPath, api.createBody),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await api.itemPatch(
          request("PATCH", `${api.collectionPath}/${recordId}`, api.updateBody),
          routeContext(),
        )
      ).status,
    ).toBe(401);
  });

  it("allows admins to create, update and delete records", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    api.delegate.findMany.mockResolvedValue([api.record]);
    api.delegate.findUnique.mockResolvedValue(api.record);
    api.delegate.create.mockResolvedValue(api.record);
    api.delegate.update.mockResolvedValue(api.record);
    api.delegate.delete.mockResolvedValue(api.record);

    expect(
      (
        await api.collectionPost(
          request("POST", api.collectionPath, api.createBody, { token: "admin" }),
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await api.itemPatch(
          request(
            "PATCH",
            `${api.collectionPath}/${recordId}`,
            api.updateBody,
            { token: "admin" },
          ),
          routeContext(),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api.itemDelete(
          request("DELETE", `${api.collectionPath}/${recordId}`, undefined, {
            token: "admin",
          }),
          routeContext(),
        )
      ).status,
    ).toBe(204);
  });
});

describe("multipart content creation", () => {
  it("accepts an employee file field and stores its image path", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.employee.create.mockResolvedValue({
      ...employee,
      photo: "/images/test-image.jpg",
    });
    const form = new FormData();
    form.set("name", "Jane Smith");
    form.set("role", "Designer");
    form.set("photo", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "photo.jpg");
    const response = await createEmployee(
      request("POST", "/api/employees", undefined, { token: "admin", form }),
    );
    expect(response.status).toBe(201);
    expect(mocks.image.storeImage).toHaveBeenCalledOnce();
  });

  it("accepts a website content image field and stores its image path", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.websiteContent.create.mockResolvedValue({
      ...websiteContent,
      imageUrl: "/images/test-image.jpg",
    });
    const form = new FormData();
    form.set("section", "hero");
    form.set("image", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "hero.jpg");
    const response = await createWebsiteContent(
      request("POST", "/api/website-content", undefined, { token: "admin", form }),
    );
    expect(response.status).toBe(201);
    expect(mocks.image.storeImage).toHaveBeenCalledOnce();
  });

  it("lets an administrator replace an employee photo with an uploaded image", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.employee.update.mockResolvedValue({
      ...employee,
      photo: "/images/test-image.jpg",
    });
    const form = new FormData();
    form.set("name", "Jane Smith");
    form.set("photo", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "photo.jpg");
    const response = await updateEmployee(
      request("PATCH", `/api/employees/${recordId}`, undefined, { token: "admin", form }),
      routeContext(),
    );
    expect(response.status).toBe(200);
    expect(mocks.image.storeImage).toHaveBeenCalledOnce();
    expect(mocks.prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ photo: "/images/test-image.jpg" }) }),
    );
  });

  it("lets an administrator replace a website image with an uploaded image", async () => {
    mocks.auth.getAuthenticatedUser.mockResolvedValue(admin);
    mocks.prisma.websiteContent.update.mockResolvedValue({
      ...websiteContent,
      imageUrl: "/images/test-image.jpg",
    });
    const form = new FormData();
    form.set("title", "Homepage");
    form.set("image", new Blob([new Uint8Array([1])], { type: "image/jpeg" }), "hero.jpg");
    const response = await updateWebsiteContent(
      request("PATCH", `/api/website-content/${recordId}`, undefined, { token: "admin", form }),
      routeContext(),
    );
    expect(response.status).toBe(200);
    expect(mocks.image.storeImage).toHaveBeenCalledOnce();
    expect(mocks.prisma.websiteContent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ imageUrl: "/images/test-image.jpg" }) }),
    );
  });
});
