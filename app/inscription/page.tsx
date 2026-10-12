import AuthForm from "@/app/components/auth-form";

export const metadata = {
  title: "Créer un compte — Aether IT",
  description: "Créez votre espace Aether IT et donnez vie à vos projets numériques.",
};

export default function InscriptionPage() {
  return <AuthForm mode="signup" />;
}
