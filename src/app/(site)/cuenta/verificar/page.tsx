import type { Metadata } from "next";

import { VerifyAccess } from "@/components/account/VerifyAccess";

export const metadata: Metadata = {
  title: "Entrando a tu cuenta",
  robots: { index: false, follow: false },
  // el enlace de acceso no tiene que salir de esta página hacia ningún otro sitio
  referrer: "no-referrer",
};

export default function Page() {
  return <VerifyAccess />;
}
