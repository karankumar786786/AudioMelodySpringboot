import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Log In - One Melody",
  description: "Sign in to your One Melody account to access your library, playlists, and lossless streaming.",
};

export default function LoginPage() {
  return <AuthPage initialMode="login" />;
}
