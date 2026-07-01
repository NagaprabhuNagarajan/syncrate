import { redirect } from "next/navigation";

/**
 * Registration is passwordless and unified with sign-in: the /login screen
 * both signs users in and provisions new accounts via an emailed login code.
 * This route is kept only to redirect any lingering links.
 */
export default function RegisterPage() {
  redirect("/login");
}
