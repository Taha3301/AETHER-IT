import { connection } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { ImageUploadError, removeStoredImage, storeImage } from "@/lib/image-storage";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { employeeUpdateSchema } from "@/lib/user-validation";

type EmployeeRouteContext = { params: Promise<{ id: string }> };

const employeeSelect = {
  id: true,
  name: true,
  role: true,
  description: true,
  photo: true,
  linkedinUrl: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(
  _request: Request,
  { params }: EmployeeRouteContext,
): Promise<Response> {
  await connection();
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Employee ID must be a valid UUID." }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id }, select: employeeSelect });
    if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });
    return Response.json({ employee });
  } catch (error) {
    return handleApiError(error, "Read employee");
  }
}

export async function PATCH(
  request: Request,
  { params }: EmployeeRouteContext,
): Promise<Response> {
  let uploadedImageName: string | undefined;
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Employee ID must be a valid UUID." }, { status: 400 });
    }
    let input: unknown;
    let photoFile: File | undefined;
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return Response.json(
          { error: "Request body must be valid multipart form data." },
          { status: 400 },
        );
      }
      const fields: Record<string, string | null> = {};
      for (const [key, value] of formData.entries()) {
        if (key === "photo" && value instanceof File) {
          if (value.name) {
            if (photoFile) {
              return Response.json({ error: "Provide only one photo file." }, { status: 400 });
            }
            photoFile = value;
          }
          continue;
        }
        if (typeof value !== "string") {
          return Response.json({ error: `The '${key}' field must be text.` }, { status: 400 });
        }
        fields[key] = value === "" ? null : value;
      }
      input = fields;
    } else if (contentType.startsWith("application/json")) {
      try {
        input = await request.json();
      } catch {
        return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }
    } else {
      return Response.json(
        { error: "Content-Type must be application/json or multipart/form-data." },
        { status: 415 },
      );
    }
    const parsed = employeeUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid employee data.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    let photo = parsed.data.photo;
    if (photoFile) {
      const storedImage = await storeImage(photoFile);
      uploadedImageName = storedImage.fileName;
      photo = storedImage.url;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { ...parsed.data, ...(photo !== undefined ? { photo } : {}), managerId: authorization.user.id },
      select: employeeSelect,
    });
    return Response.json({ employee });
  } catch (error) {
    if (uploadedImageName) {
      try {
        await removeStoredImage(uploadedImageName);
      } catch (cleanupError) {
        const errorName = cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error("[Update employee image cleanup]", errorName);
      }
    }
    if (error instanceof ImageUploadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, "Update employee");
  }
}

export async function DELETE(
  request: Request,
  { params }: EmployeeRouteContext,
): Promise<Response> {
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Employee ID must be a valid UUID." }, { status: 400 });
    }
    await prisma.employee.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Delete employee");
  }
}
