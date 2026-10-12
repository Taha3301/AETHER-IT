import { connection } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { ImageUploadError, removeStoredImage, storeImage } from "@/lib/image-storage";
import { prisma } from "@/lib/prisma";
import { websiteContentUpdateSchema } from "@/lib/user-validation";

type WebsiteContentRouteContext = { params: Promise<{ id: string }> };

const websiteContentSelect = {
  id: true,
  section: true,
  title: true,
  content: true,
  imageUrl: true,
  updatedAt: true,
};

export async function GET(
  _request: Request,
  { params }: WebsiteContentRouteContext,
): Promise<Response> {
  await connection();
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Content ID must be a valid UUID." }, { status: 400 });
    }
    const content = await prisma.websiteContent.findUnique({
      where: { id },
      select: websiteContentSelect,
    });
    if (!content) return Response.json({ error: "Website content not found." }, { status: 404 });
    return Response.json({ content });
  } catch (error) {
    return handleApiError(error, "Read website content");
  }
}

export async function PATCH(
  request: Request,
  { params }: WebsiteContentRouteContext,
): Promise<Response> {
  let uploadedImageName: string | undefined;
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Content ID must be a valid UUID." }, { status: 400 });
    }
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
      const fields: Record<string, string | null> = {};
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
    const parsed = websiteContentUpdateSchema.safeParse(input);
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

    const content = await prisma.websiteContent.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        managerId: authorization.user.id,
      },
      select: websiteContentSelect,
    });
    return Response.json({ content });
  } catch (error) {
    if (uploadedImageName) {
      try {
        await removeStoredImage(uploadedImageName);
      } catch (cleanupError) {
        const errorName = cleanupError instanceof Error ? cleanupError.name : "UnknownError";
        console.error("[Update website content image cleanup]", errorName);
      }
    }
    if (error instanceof ImageUploadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, "Update website content");
  }
}

export async function DELETE(
  request: Request,
  { params }: WebsiteContentRouteContext,
): Promise<Response> {
  try {
    const authorization = await requireAdmin(request);
    if ("response" in authorization) return authorization.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return Response.json({ error: "Content ID must be a valid UUID." }, { status: 400 });
    }
    await prisma.websiteContent.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Delete website content");
  }
}
