import "server-only";
import nodemailer from "nodemailer";

const senderAddress = "support@aetherit.tn";

export function isPasswordResetEmailConfigured(): boolean {
  const port = Number(process.env.SMTP_PORT);
  return Boolean(
    process.env.SMTP_HOST &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535 &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD,
  );
}

export async function sendPasswordResetEmail(
  recipient: string,
  code: string,
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!isPasswordResetEmailConfigured() || !host || !username || !password) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD must be configured.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
  });

  try {
    await transporter.sendMail({
      from: { name: "Aether IT", address: senderAddress },
      to: recipient,
      subject: "Réinitialisation de votre mot de passe Aether IT",
      text: [
        "Une demande de réinitialisation du mot de passe de votre compte Aether IT a été reçue.",
        "",
        "Votre code de vérification à usage unique est :",
        code,
        "",
        "Ce code expire dans 60 minutes. Saisissez-le avec votre adresse e-mail dans la requête POST /api/auth/reset-password. Après 5 codes incorrects, demandez un nouveau code.",
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
      ].join("\n"),
    });
  } catch (error) {
    const details =
      error && typeof error === "object"
        ? {
            code: "code" in error && typeof error.code === "string" ? error.code : undefined,
            responseCode:
              "responseCode" in error && typeof error.responseCode === "number"
                ? error.responseCode
                : undefined,
            command:
              "command" in error && typeof error.command === "string" ? error.command : undefined,
          }
        : {};
    console.error("[Password reset SMTP delivery]", details);
    throw error;
  }
}
