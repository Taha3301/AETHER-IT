"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminConsole from "./admin-console";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Réponse inattendue du serveur.");
  }
  if (!isJsonObject(value)) throw new Error("Réponse inattendue du serveur.");
  return value;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminName, setAdminName] = useState("");
  const [token, setToken] = useState("");
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const accessToken = window.sessionStorage.getItem("aether.accessToken");
    if (!accessToken) {
      router.replace("/connexion");
      return;
    }
    const token = accessToken;

    const controller = new AbortController();
    async function verifyAdmin() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.sessionStorage.removeItem("aether.accessToken");
          router.replace("/connexion");
          return;
        }
        if (!response.ok) throw new Error("Impossible de vérifier les droits administrateur.");

        const result = await readJson(response);
        if (!isJsonObject(result.user) || typeof result.user.role !== "string") {
          throw new Error("Les informations de votre compte sont invalides.");
        }
        if (result.user.role !== "ADMIN") {
          router.replace("/");
          return;
        }
        setAdminName(typeof result.user.name === "string" ? result.user.name : "Administrateur");
        setToken(token);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccessError(
            error instanceof Error
              ? error.message
              : "Une erreur inattendue a empêché la vérification de votre compte.",
          );
        }
      }
    }

    void verifyAdmin();
    return () => controller.abort();
  }, [router]);

  function handleLogout() {
    window.sessionStorage.removeItem("aether.accessToken");
    router.replace("/connexion");
  }

  if (accessError) {
    return (
      <main className="admin-page">
        <section aria-labelledby="admin-error-title" className="admin-state">
          <h1 id="admin-error-title">Tableau de bord indisponible</h1>
          <p role="alert">{accessError}</p>
          <Link href="/">Retour à l’accueil</Link>
        </section>
      </main>
    );
  }

  if (!adminName || !token) {
    return (
      <main aria-live="polite" className="admin-page">
        <div className="admin-state">Vérification des droits administrateur…</div>
      </main>
    );
  }

  return <AdminConsole adminName={adminName} onLogout={handleLogout} token={token} />;
}
