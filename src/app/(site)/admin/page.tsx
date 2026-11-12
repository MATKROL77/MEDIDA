import type { Metadata } from "next";

import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminPanel />;
}
