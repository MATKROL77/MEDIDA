/**
 * Llamadas al servidor de MEDIDA (el Worker de Cloudflare, bajo /api).
 * En desarrollo puede vivir en otro puerto: NEXT_PUBLIC_API_BASE.
 */

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const apiUrl = (path: string) => `${BASE}${path}`;

export async function api<T>(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: BASE ? "include" : "same-origin",
      keepalive: init.keepalive,
    });
  } catch {
    throw new ApiError(0, "sin_conexion");
  }
  const type = res.headers.get("content-type") ?? "";
  // una respuesta que no es JSON es el sitio estático contestando por una API que no está
  if (!type.includes("application/json")) throw new ApiError(res.status, "sin_servidor");
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error");
  return data;
}
