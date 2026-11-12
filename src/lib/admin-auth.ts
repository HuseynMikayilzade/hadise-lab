import { timingSafeEqual } from "node:crypto";

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/** x-admin-token başlığının sabit vaxtlı müqayisəsi. */
export function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const provided = request.headers.get("x-admin-token");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
