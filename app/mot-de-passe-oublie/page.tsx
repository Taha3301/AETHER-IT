import PasswordResetForm from "@/app/components/password-reset-form";

export const metadata = {
  title: "Mot de passe oublié — Aether IT",
  description: "Réinitialisez le mot de passe de votre espace Aether IT.",
};

export default function MotDePasseOubliePage() {
  return <PasswordResetForm />;
}
