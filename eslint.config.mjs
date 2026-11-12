import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // el sitio es un export estático: next/image no optimiza nada ahí. Las
    // imágenes ya salen optimizadas de scripts/capture.mjs.
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    ignores: [
      ".next/**",
      "out/**", // export estático: es salida del build, no código fuente
      "public/**",
      "next-env.d.ts", // lo genera Next en cada build
      "node_modules/**",
      "artifact-out/**",
      ".wrangler/**",
    ],
  },
];

export default eslintConfig;
