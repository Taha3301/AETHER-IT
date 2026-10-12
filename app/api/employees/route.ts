import { connection } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { ImageUploadError, removeStoredImage, storeImage } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { employeeCreateSchema } from "@/lib/user-validation";

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

export async function GET(): Promise<Response> {
  await connection();
  try {
    const employees = await prisma.employee.findMany({
      select: employeeSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ employees });
  } catch (error) {
    return handleApiError(error, "List employees");
  }
}

export async function POST(request: Request): Promise<Response> {
  let uploadedImageName: string | undefined;
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;

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

      const fields: Record<string, string> = {};
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
        if (value !== "") fields[key] = value;
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

    const parsed = employeeCreateSchema.safeParse(input);
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

    const employee = await prisma.employee.create({
      data: { ...parsed.data, photo, managerId: authorization.user.id },
      select: employeeSelect,
    });
    return Response.json({ employee }, { status: 201 });
  } catch (error) {
    if (uploadedImageName) {
      try {
        await removeStoredImage(uploadedImageName);
      } catch (cleanupError) {
        const errorName = cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error("[Create employee image cleanup]", errorName);
      }
    }
    if (error instanceof ImageUploadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, "Create employee");
  }
}
