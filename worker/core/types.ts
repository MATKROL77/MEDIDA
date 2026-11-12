import type { Sql } from "./sql.ts";
import type { TenantApi } from "./tenant.ts";

export type Mail = { to: string; subject: string; text: string; html: string };

/**
 * Todo lo que la lógica del servidor necesita de afuera. En Cloudflare lo arma
 * el Durable Object; en las pruebas, un SQLite en memoria y funciones que
 * anotan lo que se hubiera mandado.
 */
export type Deps = {
  sql: Sql;
  now: () => number;
  config: {
    /** emails que pueden entrar al panel de administración */
    adminEmails: string[];
    /** hay un proveedor de email configurado */
    emailEnabled: boolean;
    /** solo en desarrollo: los emails se guardan en una bandeja que se puede leer por la API */
    devOutbox: boolean;
  };
  sendEmail: (mail: Mail) => Promise<boolean>;
  /** manda una notificación a un navegador; "gone" si esa suscripción ya no existe */
  sendPush: (endpoint: string) => Promise<"ok" | "gone" | "error">;
  /** pide que el servidor se despierte solo en ese momento (recordatorios, limpieza) */
  schedule: (at: number) => Promise<void>;
  /** la base de una empresa: separada de la plataforma y de las otras empresas */
  tenant: (id: string) => TenantApi;
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
