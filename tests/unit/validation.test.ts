import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
  websiteContentCreateSchema,
  websiteContentUpdateSchema,
} from "@/lib/user-validation";

describe("API request validation", () => {
  it("accepts employee fields and valid optional URLs", () => {
    expect(
      employeeCreateSchema.safeParse({
        name: "Jane Smith",
        role: "Designer",
        photo: "/images/jane.webp",
        linkedinUrl: "https://www.linkedin.com/in/jane",
      }).success,
    ).toBe(true);
  });

  it("rejects non-HTTP LinkedIn URLs and empty employee updates", () => {
    expect(
      employeeCreateSchema.safeParse({
        name: "Jane",
        role: "Designer",
        linkedinUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(employeeUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts service values and rejects empty updates", () => {
    expect(serviceCreateSchema.safeParse({ name: "Consulting", icon: "briefcase" }).success).toBe(
      true,
    );
    expect(serviceUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts website image URLs and paths only inside /images", () => {
    expect(
      websiteContentCreateSchema.safeParse({
        section: "hero",
        imageUrl: "/images/hero.webp",
      }).success,
    ).toBe(true);
    expect(
      websiteContentCreateSchema.safeParse({
        section: "hero",
        imageUrl: "/images/../private.txt",
      }).success,
    ).toBe(false);
    expect(websiteContentUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("validates password reset and password change payloads", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "USER@example.com" }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        email: "user@example.com",
        code: "012345",
        password: "new-pass",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        email: "user@example.com",
        code: "not-a-code",
        password: "new-pass",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "same-pass",
        newPassword: "same-pass",
      }).success,
    ).toBe(false);
  });
});
