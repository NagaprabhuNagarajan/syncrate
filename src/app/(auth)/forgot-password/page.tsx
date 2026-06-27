import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/identity/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Syncrate account password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
