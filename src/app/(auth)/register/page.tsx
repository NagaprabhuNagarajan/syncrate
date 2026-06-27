import type { Metadata } from "next";
import { RegisterForm } from "@/features/identity/components/register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your free Syncrate account",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
