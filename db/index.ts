/**
 * This site currently has no database-backed feature. Keep the explicit
 * failure so a future caller does not silently assume a Cloudflare D1 binding
 * exists when running on Vercel.
 */
export function getDb(): never {
  throw new Error("数据库尚未配置。请先为 Vercel 接入数据库后再调用 getDb().");
}
