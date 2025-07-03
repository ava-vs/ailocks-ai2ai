import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

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

// Cookie helpers
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production'
};

export function setAuthCookie(token: string): string {
  return serialize('auth_token', token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 }); // 7 days
}

export function clearAuthCookie(): string {
  return serialize('auth_token', '', { ...cookieOptions, maxAge: 0 });
}

export function getAuthTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  const cookieHeader = headers.cookie as string | undefined;
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies['auth_token'] || null;
} 