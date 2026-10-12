import { connection } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { ImageUploadError, removeStoredImage, storeImage } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { websiteContentCreateSchema } from "@/lib/user-validation";

const websiteContentSelect = {
  id: true,
  section: true,
  title: true,
  content: true,
  imageUrl: true,
  updatedAt: true,
};

export async function GET(): Promise<Response> {
  await connection();
  try {
    const content = await prisma.websiteContent.findMany({
      select: websiteContentSelect,
      orderBy: { section: "asc" },
    });
    return Response.json({ content });
  } catch (error) {
    return handleApiError(error, "List website content");
  }
}

export async function POST(request: Request): Promise<Response> {
  let uploadedImageName: string | undefined;
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;

    let input: unknown;
    let imageFile: File | undefined;
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
        if (key === "image" && value instanceof File) {
          if (value.name) {
            if (imageFile) {
              return Response.json({ error: "Provide only one image file." }, { status: 400 });
            }
            imageFile = value;
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

    const parsed = websiteContentCreateSchema.safeParse(input);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid website content.", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    let imageUrl = parsed.data.imageUrl;
    if (imageFile) {
      const storedImage = await storeImage(imageFile);
      uploadedImageName = storedImage.fileName;
      imageUrl = storedImage.url;
    }

    const content = await prisma.websiteContent.create({
      data: { ...parsed.data, imageUrl, managerId: authorization.user.id },
      select: websiteContentSelect,
    });
    return Response.json({ content }, { status: 201 });
  } catch (error) {
    if (uploadedImageName) {
      try {
        await removeStoredImage(uploadedImageName);
      } catch (cleanupError) {
        const errorName = cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error("[Create website content image cleanup]", errorName);
      }
    }
    if (error instanceof ImageUploadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, "Create website content");
  }
}
