import type { Metadata } from "next";

import { CompanyPanel } from "@/components/admin/CompanyPanel";

export const metadata: Metadata = { title: "Panel de empresa", robots: { index: false, follow: false } };

export default function Page() {
  return <CompanyPanel />;
}
