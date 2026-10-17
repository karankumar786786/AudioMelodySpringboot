import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Sign Up - One Melody",
  description: "Create your One Melody account and start listening to lossless high-fidelity audio today.",
};

export default function SignupPage() {
  return <AuthPage initialMode="signup" />;
}
