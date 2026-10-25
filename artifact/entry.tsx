import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import Configurator from "@/components/Configurator";
import Workshop from "@/components/Workshop";

/** la demo y la vista del taller en una sola página, para publicarla en Claude */
function App() {
  const [view, setView] = useState<"demo" | "taller">("demo");
  useEffect(() => {
    const go = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      const query = href.includes("?") ? `?${href.split("?")[1]}` : "";
      window.__artifactQuery = query;
      setView(href.includes("/taller") ? "taller" : "demo");
      window.scrollTo(0, 0);
    };
    window.addEventListener("artifact-nav", go);
    return () => window.removeEventListener("artifact-nav", go);
  }, []);
  return view === "taller" ? <Workshop key="taller" /> : <Configurator key="demo" />;
}

createRoot(document.getElementById("app")!).render(<App />);
