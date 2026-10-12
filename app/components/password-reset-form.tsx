"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

type FormMode = "request" | "reset" | "complete";
type ApiResponse = Record<string, unknown>;

function isApiResponse(value: unknown): value is ApiResponse {
  return typeof value === "object" && value !== null;
}

export default function PasswordResetForm() {
  const [mode, setMode] = useState<FormMode>("request");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorMessage("");
    setMessage("");

    const formEmail = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    if (mode === "reset" && password !== confirmation) {
      setErrorMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (mode === "reset" && new TextEncoder().encode(password).byteLength > 72) {
      setErrorMessage("Le mot de passe ne doit pas dépasser 72 octets.");
      return;
    }
    setIsSubmitting(true);

    const body =
      mode === "request"
        ? { email: formEmail }
        : {
            email: formEmail,
            code: String(form.get("code") ?? "").trim(),
            password,
          };

    try {
      const response = await fetch(
        mode === "request" ? "/api/auth/forgot-password" : "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw new Error("Le service a renvoyé une réponse illisible. Réessayez.");
      }
      const payload = isApiResponse(result) ? result : {};

      if (!response.ok) {
        const apiError = typeof payload.error === "string" ? payload.error : "";
        if (response.status === 503) {
          setErrorMessage(
            "La réinitialisation par e-mail est momentanément indisponible. Contactez l’assistance.",
          );
        } else if (response.status === 400 && mode === "reset") {
          setErrorMessage(
            apiError === "Invalid request data."
              ? "Saisissez un code à six chiffres et un mot de passe valide."
              : "Ce code est invalide ou expiré. Vérifiez-le puis réessayez.",
          );
        } else if (response.status === 400) {
          setErrorMessage("Saisissez une adresse e-mail valide.");
        } else {
          setErrorMessage("Le service est momentanément indisponible. Réessayez dans quelques instants.");
        }
        return;
      }

      setEmail(formEmail);
      if (mode === "request") {
        setMode("reset");
        setMessage(
          "Si un compte correspond à cette adresse, vous recevrez un code de vérification par e-mail.",
        );
      } else {
        setMode("complete");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de joindre le service. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-back-link" href="/connexion">
        <span aria-hidden="true">←</span> Retour à la connexion
      </Link>
      <section aria-labelledby="auth-title" className="auth-card">
        <Image
          alt=""
          className="auth-logo"
          height={56}
          src="/images/aetherit-logo.png"
          width={56}
        />
        <p className="auth-eyebrow">AETHER IT · VOTRE ESPACE</p>
        <h1 id="auth-title">
          {mode === "complete" ? "Mot de passe modifié" : "Mot de passe oublié ?"}
        </h1>
        <p className="auth-intro">
          {mode === "request"
            ? "Recevez un code de vérification pour choisir un nouveau mot de passe."
            : mode === "reset"
              ? "Saisissez le code reçu par e-mail et choisissez un nouveau mot de passe."
              : "Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter."}
        </p>

        {mode === "complete" ? (
          <div className="auth-success" role="status">
            <span aria-hidden="true" className="success-check">
              ✓
            </span>
            <div>
              <strong>Votre mot de passe a bien été modifié.</strong>
              <p>Utilisez votre nouveau mot de passe pour accéder à votre espace.</p>
              <Link href="/connexion">Se connecter</Link>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Adresse e-mail</span>
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vous@exemple.com"
                required
                readOnly={mode === "reset"}
                type="email"
                value={email}
              />
            </label>
            {mode === "reset" && (
              <>
                {message && (
                  <p className="auth-status" role="status">
                    {message}
                  </p>
                )}
                <label className="auth-field">
                  <span>Code de vérification</span>
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    minLength={6}
                    name="code"
                    pattern="[0-9]{6}"
                    placeholder="123456"
                    required
                    title="Le code contient six chiffres."
                  />
                </label>
                <label className="auth-field">
                  <span>Nouveau mot de passe</span>
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    minLength={6}
                    name="password"
                    placeholder="6 caractères minimum"
                    required
                    type="password"
                  />
                </label>
                <label className="auth-field">
                  <span>Confirmer le nouveau mot de passe</span>
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    minLength={6}
                    name="confirmPassword"
                    placeholder="Répétez le nouveau mot de passe"
                    required
                    type="password"
                  />
                </label>
              </>
            )}
            {errorMessage && (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            )}
            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? "Veuillez patienter…"
                : mode === "request"
                  ? "Recevoir un code"
                  : "Réinitialiser le mot de passe"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
            {mode === "reset" && (
              <button
                className="auth-reset-restart"
                onClick={() => {
                  setMode("request");
                  setMessage("");
                  setErrorMessage("");
                }}
                type="button"
              >
                Modifier l’adresse e-mail ou renvoyer le code
              </button>
            )}
          </form>
        )}

        {mode !== "complete" && (
          <p className="auth-switch">
            Vous vous souvenez de votre mot de passe ? <Link href="/connexion">Se connecter</Link>
          </p>
        )}
      </section>
      <p className="auth-footer">AETHER IT <span>·</span> CONSTRUISONS LA SUITE ENSEMBLE</p>
    </main>
  );
}
