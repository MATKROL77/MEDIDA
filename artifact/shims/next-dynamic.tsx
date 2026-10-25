import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

/** reemplazo de next/dynamic: en un solo archivo alcanza con React.lazy */
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options: { loading?: () => ReactNode; ssr?: boolean } = {},
) {
  const Lazy = lazy(async () => {
    const mod = await loader();
    return "default" in mod ? mod : { default: mod };
  });
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={options.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
