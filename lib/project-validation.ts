import { z } from "zod";

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(20000),
    guestName: z.string().trim().min(1).max(120).optional(),
    guestEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
    guestPhone: z.string().trim().max(40).optional(),
    language: z.enum(["fr", "en"]).default("fr"),
  })
  .strict()
  .refine((value) => Boolean(value.title || value.description), {
    message: "Provide a project idea or a title.",
    path: ["description"],
  });

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalText(20000),
    status: z.enum(["DRAFT", "IN_PROGRESS", "ANALYSIS_READY", "COMPLETED", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const createMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(12000),
    sender: z.enum(["USER", "ADMIN"]).optional(),
    language: z.enum(["fr", "en"]).default("fr"),
  })
  .strict();

export const exportDocumentSchema = z
  .object({
    type: z.enum(["PDF", "DOCX"]),
    documentKind: z.enum(["ANALYSIS", "CAHIER_DES_CHARGES"]).default("ANALYSIS"),
  })
  .strict();

export const analysisSchema = z
  .object({
    summary: z.string().trim().min(1).max(20000),
    problem: z.string().trim().max(20000),
    solution: z.string().trim().max(20000),
    targetAudience: z.string().trim().max(20000),
    targetMarket: z.string().trim().max(20000),
    businessModel: z.string().trim().max(20000),
    valueProposition: z.string().trim().max(20000),
    features: z.string().trim().max(20000),
    competitors: z.string().trim().max(20000),
    technology: z.string().trim().max(20000),
    marketingStrategy: z.string().trim().max(20000),
    roadmap: z.string().trim().max(20000),
    risks: z.string().trim().max(20000),
  })
  .strict();
