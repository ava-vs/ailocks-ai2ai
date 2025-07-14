import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

// AICODE-NOTE: This module handles all authentication-related utilities including JWT management and cookie-based auth.
// When modifying auth flow, ensure that all methods are updated consistently to maintain security integrity.

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

if (!JWT_SECRET) {
  console.warn('[auth-utils] JWT_SECRET is not set – using insecure default');
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createToken(payload: JwtPayload, expires = '7d'): string {
  return jwt.sign(payload as any, JWT_SECRET as any, { expiresIn: expires } as any);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

// AICODE-NOTE: Cookie configuration for auth tokens
// These settings are critical for security - httpOnly prevents JavaScript access to cookies,
// secure ensures HTTPS-only in production, and sameSite prevents CSRF attacks
// AICODE-TODO: Consider adding rotation mechanism for auth tokens to enhance security
const isProduction = process.env.NODE_ENV === 'production';

export const cookieOptions: import('cookie').CookieSerializeOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  secure: isProduction,
};

export function setAuthCookie(token: string): string {
  return serialize('auth_token', token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 }); // 7 days
}

export function clearAuthCookie(): string {
  // Setting both maxAge=0 and an expired date maximises cross-browser reliability when clearing cookies
  return serialize('auth_token', '', {
    ...cookieOptions,
    maxAge: 0,
    expires: new Date(0)
  });
}

// AICODE-ASK: Should we implement additional validation for the auth token structure before returning it?
// Current implementation only checks for existence but not format validity
export function getAuthTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  // Сначала проверяем заголовок Authorization
  const authHeader = headers.authorization as string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Затем проверяем cookie, если заголовок Authorization не содержит токен
  const cookieHeader = headers.cookie as string | undefined;
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    return cookies['auth_token'] || null;
  }

  return null;
  
  // AICODE-NOTE: This function is used by Netlify Functions to extract the auth token from incoming requests.
  // It's the primary method by which serverless functions authenticate users, so any changes here
  // will affect the entire authentication system.
}