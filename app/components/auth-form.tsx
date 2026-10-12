"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

type AuthResponse = {
  accessToken?: unknown;
  error?: unknown;
  user?: {
    role?: unknown;
  };
};

const errorMessages: Record<string, string> = {
  "A record with these unique values already exists.":
    "Un compte existe déjà avec cette adresse e-mail.",
  "Email or password is incorrect.":
    "L’adresse e-mail ou le mot de passe est incorrect.",
  "Invalid login data.": "Vérifiez les informations saisies puis réessayez.",
  "Invalid user data.": "Vérifiez les informations saisies puis réessayez.",
  "An unexpected server error occurred.":
    "Une erreur est survenue sur le serveur. Réessayez dans quelques instants.",
};

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorMessage("");

    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    if (isSignup && new TextEncoder().encode(password).byteLength > 72) {
      setErrorMessage("Le mot de passe ne doit pas dépasser 72 octets.");
      return;
    }
    setIsSubmitting(true);

    const requestBody = {
      ...(isSignup ? { name: String(formData.get("name") ?? "").trim() } : {}),
      email: String(formData.get("email") ?? "").trim(),
      password,
      ...(isSignup && formData.get("phone")
        ? { phone: String(formData.get("phone")).trim() }
        : {}),
    };

    try {
      const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result: unknown = await response.json();
      const payload =
        result && typeof result === "object" ? (result as AuthResponse) : {};

      if (!response.ok) {
        const apiError = typeof payload.error === "string" ? payload.error : "";
        if (response.status === 409) {
          setErrorMessage(errorMessages[apiError] ?? "Cette adresse e-mail est déjà utilisée.");
        } else if (response.status === 401) {
          setErrorMessage(errorMessages[apiError] ?? "L’adresse e-mail ou le mot de passe est incorrect.");
        } else if (response.status === 400) {
          setErrorMessage(
            errorMessages[apiError] ??
              "Vérifiez les informations saisies. Le mot de passe doit contenir au moins 6 caractères.",
          );
        } else {
          setErrorMessage(
            errorMessages[apiError] ??
              "Le service est momentanément indisponible. Réessayez dans quelques instants.",
          );
        }
        return;
      }

      if (typeof payload.accessToken !== "string" || !payload.accessToken) {
        setErrorMessage("La session n’a pas pu être ouverte. Veuillez réessayer.");
        return;
      }

      window.sessionStorage.setItem("aether.accessToken", payload.accessToken);
      router.replace(payload.user?.role === "ADMIN" ? "/admin" : "/");
    } catch {
      setErrorMessage("Impossible de joindre le service. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-back-link" href="/">
        <span aria-hidden="true">←</span> Retour à l’accueil
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
        <h1 id="auth-title">{isSignup ? "Créer votre compte" : "Ravi de vous revoir"}</h1>
        <p className="auth-intro">
          {isSignup
            ? "Rejoignez-nous et donnez vie à vos projets numériques."
            : "Connectez-vous pour retrouver votre espace projet."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="auth-field">
                <span>Nom complet</span>
                <input
                  autoComplete="name"
                  maxLength={120}
                  name="name"
                  placeholder="Votre nom"
                  required
                />
              </label>
            )}
            <label className="auth-field">
              <span>Adresse e-mail</span>
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                placeholder="vous@exemple.com"
                required
                type="email"
              />
            </label>
            {isSignup && (
              <label className="auth-field">
                <span>Téléphone <span className="field-optional">(facultatif)</span></span>
                <input
                  autoComplete="tel"
                  maxLength={40}
                  name="phone"
                  placeholder="+216"
                  type="tel"
                />
              </label>
            )}
            <label className="auth-field">
              <span>Mot de passe</span>
              <input
                autoComplete={isSignup ? "new-password" : "current-password"}
                maxLength={72}
                minLength={isSignup ? 6 : 1}
                name="password"
                placeholder={isSignup ? "6 caractères minimum" : "Votre mot de passe"}
                required
                type="password"
              />
            </label>
            {!isSignup && (
              <Link className="auth-forgot-link" href="/mot-de-passe-oublie">
                Mot de passe oublié ?
              </Link>
            )}
            {errorMessage && (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            )}
            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? "Veuillez patienter…"
                : isSignup
                  ? "Créer mon compte"
                  : "Me connecter"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Vous avez déjà un compte ?" : "Vous n’avez pas encore de compte ?"}{" "}
          <Link href={isSignup ? "/connexion" : "/inscription"}>
            {isSignup ? "Se connecter" : "Créer un compte"}
          </Link>
        </p>
      </section>
      <p className="auth-footer">AETHER IT <span>·</span> CONSTRUISONS LA SUITE ENSEMBLE</p>
    </main>
  );
}
