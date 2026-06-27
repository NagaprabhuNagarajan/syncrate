import type { Metadata } from "next";
import { RegistrationSuccess } from "@/features/identity/components/register-form";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your email address to activate your Syncrate account",
};

export default function VerifyEmailPage() {
  return <RegistrationSuccess />;
}
