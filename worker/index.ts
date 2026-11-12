/**
 * Entrada del Worker. El sitio es estático y Cloudflare lo sirve sin pasar por
 * acá; solo los pedidos a /api llegan a este código, y van al servidor.
 */

import { PlatformDO, TenantDO, type Env } from "./platform.ts";

export { PlatformDO, TenantDO };

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) return env.PLATFORM.get(env.PLATFORM.idFromName("medida")).fetch(request);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
