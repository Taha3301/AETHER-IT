"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { label: "Accueil", href: "/", icon: "home" },
  { label: "Qui sommes-nous", href: "#robot", icon: "team" },
  { label: "À propos", href: "#conversation-heading", icon: "about" },
  { label: "Services", href: "#services", icon: "services" },
];

function NavIcon({ type }: { type: string }) {
  switch (type) {
    case "home":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
          <path
            d="M3 10.5 10 4l7 6.5M5 9.5V16a1 1 0 0 0 1 1h3v-4h2v4h3a1 1 0 0 0 1-1V9.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "team":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2 16c0-2.2 2.2-4 5-4s5 1.8 5 4m1-9a3 3 0 1 1 0 4m1 5c0-1.7-1-3.1-2.5-3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "about":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 9v4.5m0-7h.01"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      );
    case "services":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
          <rect
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
            width="5"
            x="3"
            y="3"
          />
          <rect
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
            width="5"
            x="12"
            y="3"
          />
          <rect
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
            width="5"
            x="3"
            y="12"
          />
          <rect
            height="5"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
            width="5"
            x="12"
            y="12"
          />
        </svg>
      );
    default:
      return null;
  }
}

type CurrentUser = {
  name: string;
  role: "ADMIN" | "CUSTOMER";
};

export default function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const accessToken = window.sessionStorage.getItem("aether.accessToken");
    if (!accessToken) return;

    const controller = new AbortController();
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.sessionStorage.removeItem("aether.accessToken");
          return;
        }
        if (!response.ok) {
          setSessionError("La session n’a pas pu être vérifiée. Réessayez.");
          return;
        }

        const result: unknown = await response.json();
        if (
          typeof result === "object" &&
          result !== null &&
          "user" in result &&
          typeof result.user === "object" &&
          result.user !== null &&
          "name" in result.user &&
          typeof result.user.name === "string" &&
          "role" in result.user &&
          (result.user.role === "ADMIN" || result.user.role === "CUSTOMER")
        ) {
          setCurrentUser({ name: result.user.name, role: result.user.role });
          return;
        }
        setSessionError("Les informations de session reçues sont invalides.");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Unable to load the current user.", error);
          setSessionError("Impossible de vérifier votre session. Vérifiez votre connexion.");
        }
      }
    }

    void loadCurrentUser();
    return () => controller.abort();
  }, []);

  function handleLogout() {
    window.sessionStorage.removeItem("aether.accessToken");
    router.replace("/connexion");
  }

  return (
    <header className={`site-header${scrolled ? " header-scrolled" : ""}`}>
      <div className="header-inner">
        {/* Brand */}
        <Link
          aria-label="Aether IT — accueil"
          className="brand"
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-logo-wrap">
            <Image
              alt=""
              className="brand-logo"
              height={48}
              priority
              src="/images/aetherit-logo.png"
              width={48}
            />
          </span>
          <span className="brand-wordmark">
            AETHER<span>IT</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav
          aria-label="Navigation principale"
          className={`primary-navigation${menuOpen ? " is-open" : ""}`}
          id="primary-navigation"
        >
          <div className="nav-links-group">
            {navigation.map((item) => (
              <Link
                className="nav-link"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-link-icon">
                  <NavIcon type={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="nav-auth-group">
            {sessionError ? (
              <span className="nav-session-error" role="status">
                {sessionError}
              </span>
            ) : currentUser ? (
              <>
                <span className="nav-user-name">Bonjour, {currentUser.name}</span>
                {currentUser.role === "ADMIN" && (
                  <Link
                    className="nav-sign-in"
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                  >
                    Tableau de bord
                  </Link>
                )}
                <button className="nav-sign-in nav-logout" onClick={handleLogout} type="button">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
            <Link
              className="nav-sign-in"
              href="/connexion"
              onClick={() => setMenuOpen(false)}
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                <path
                  d="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-3.5 7c.7-1.2 2-2 3.5-2s2.8.8 3.5 2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
              </svg>
              <span>Se connecter</span>
            </Link>

            <Link
              className="nav-sign-up"
              href="/inscription"
              onClick={() => setMenuOpen(false)}
            >
              <span>Commencer</span>
              <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                <path
                  d="M3.5 10h12m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </Link>
              </>
            )}
          </div>
        </nav>

        {/* Hamburger */}
        <button
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
