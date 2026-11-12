/**
 * La base de datos, vista desde la lógica del servidor: consultas con
 * parámetros y nada más. En Cloudflare la respalda el SQLite de un Durable
 * Object; en las pruebas, el SQLite de Node. La lógica es la misma en los dos.
 */

export type Value = string | number | null;
export type Row = Record<string, Value>;

export interface Sql {
  all<T = Row>(query: string, ...params: Value[]): T[];
  run(query: string, ...params: Value[]): void;
}

export const one = <T = Row>(sql: Sql, query: string, ...params: Value[]): T | null => sql.all<T>(query, ...params)[0] ?? null;

/** crea lo que falte; se puede correr todas las veces que haga falta */
export function migrate(sql: Sql, statements: string[]) {
  for (const s of statements) sql.run(s);
}
