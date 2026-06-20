// Node-runtime auth helpers (bcrypt + cookies). Import from server components / route handlers.
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken, sessionCookieOptions } from "./session";

/** Server-component / route helper: returns the signed-in user or null. */
export async function getSession(): Promise<{ email: string } | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Verify submitted credentials against the configured single account. */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const expectedEmail = process.env.AUTH_EMAIL;
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!expectedEmail || !hash) return false;
  if (email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) return false;
  return bcrypt.compare(password, hash);
}
