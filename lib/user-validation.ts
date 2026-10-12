import { z } from "zod";

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    message: "Password must be no more than 72 bytes.",
  });

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());

export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: emailSchema,
    password: passwordSchema,
    phone: z.string().trim().max(40).optional(),
    guestProjectToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72),
    guestProjectToken: z.string().min(1).max(4096).optional(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z.string().regex(/^\d{6}$/, "Verification code must contain 6 digits."),
    password: passwordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use HTTP or HTTPS.");

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();
const imageUrlOrPath = z
  .union([
    httpUrlSchema,
    z
      .string()
      .trim()
      .max(2048)
      .regex(/^\/(?!\/).+/, "Photo must be an HTTP(S) URL or a local path."),
  ])
  .nullable()
  .optional();
const websiteImageUrlOrPath = z
  .union([
    httpUrlSchema,
    z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) =>
          value.startsWith("/images/") &&
          !value.includes("\\") &&
          !value.split("/").some((segment) => segment === "." || segment === ".."),
        "Image must be an HTTP(S) URL or a path inside /images.",
      ),
  ])
  .nullable()
  .optional();

export const employeeCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120),
    description: optionalText(10000),
    photo: imageUrlOrPath,
    linkedinUrl: httpUrlSchema.nullable().optional(),
  })
  .strict();

export const employeeUpdateSchema = employeeCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const serviceCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: optionalText(10000),
    icon: optionalText(2048),
  })
  .strict();

export const serviceUpdateSchema = serviceCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const websiteContentCreateSchema = z
  .object({
    section: z.string().trim().min(1).max(120),
    title: optionalText(300),
    content: optionalText(50000),
    imageUrl: websiteImageUrlOrPath,
  })
  .strict();

export const websiteContentUpdateSchema = websiteContentCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });
