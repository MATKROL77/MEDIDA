import Link from "next/link";

import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="wrap grid min-h-[60dvh] place-items-center py-20 text-center">
        <div>
          <p className="eyebrow">Error 404</p>
          <h1 className="display-lg mt-4">Esta página no existe.</h1>
          <p className="lead mx-auto mt-5 max-w-md">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary">
              Ir al inicio
            </Link>
            <Link href="/configuradores/" className="btn btn-secondary">
              Probar un configurador
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
