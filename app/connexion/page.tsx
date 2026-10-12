import AuthForm from "@/app/components/auth-form";

export const metadata = {
  title: "Connexion — Aether IT",
  description: "Connectez-vous à votre espace projet Aether IT.",
};

export default function ConnexionPage() {
  return <AuthForm mode="login" />;
}
