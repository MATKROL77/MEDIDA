import type { Metadata } from "next";

import { AccountPage } from "@/components/account/AccountPage";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Guardá tus diseños con tu email y abrilos desde cualquier dispositivo. Sin contraseña.",
  alternates: { canonical: "/cuenta/" },
  robots: { index: false },
};

export default function Page() {
  return <AccountPage />;
}
