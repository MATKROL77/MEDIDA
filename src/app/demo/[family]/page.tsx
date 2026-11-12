import type { Metadata } from "next";
import { notFound } from "next/navigation";

import FurnitureConfigurator from "@/components/FurnitureConfigurator";
import { SPECS, specById } from "@/lib/furniture";

type Props = { params: Promise<{ family: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SPECS.map((s) => ({ family: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const spec = specById((await params).family);
  return spec ? { title: `Configurador de ${spec.title.toLowerCase()}`, description: `Armá ${spec.title.toLowerCase()} a medida en 3D y mirá el precio estimado al instante.`, alternates: { canonical: `/demo/${spec.id}/` } } : {};
}

export default async function Page({ params }: Props) {
  const { family } = await params;
  if (!specById(family)) notFound();
  return <FurnitureConfigurator key={family} family={family} />;
}
