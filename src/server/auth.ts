import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles, userRoles, supplierProfiles } from '../db/schema.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SUPER_ADMIN_EMAIL = 'snfalseceiling@gmail.com';

export interface AuthenticatedProfile {
  id: number;
  uid: string;
  email: string;
  mobile: string | null;
  fullName: string;
  preferredLanguage: string;
  activeRole: string;
  roles: string[];
  isVerified: boolean;
  isSuspended: boolean;
  supplierId: number | null;
  supplierVerificationStatus: string | null;
}

export interface AuthRequest extends Request {
  profile?: AuthenticatedProfile;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(code).digest('hex');
}

export function signSessionToken(payload: { uid: string; email: string }): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `bm.${data}.${sig}`;
}

export function verifySessionToken(
  token: string
): { uid: string; email: string } | null {
  if (!token.startsWith('bm.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return { uid: parsed.uid, email: parsed.email };
  } catch {
    return null;
  }
}

export async function getOrCreateProfile(
  uid: string,
  email: string,
  fullName?: string,
  requestedRole = 'customer',
  mobile?: string
): Promise<AuthenticatedProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const isDefaultAdmin = normalizedEmail === SUPER_ADMIN_EMAIL;
  const safeRole = isDefaultAdmin
    ? 'super_admin'
    : ['customer', 'electrician', 'plumber', 'contractor', 'supplier'].includes(
          requestedRole
        )
      ? requestedRole
      : 'customer';

  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.uid, uid))
    .limit(1);

  let profileRow = existing[0];

  if (!profileRow) {
    const inserted = await db
      .insert(profiles)
      .values({
        uid,
        email: normalizedEmail,
        mobile: mobile || null,
        fullName: fullName?.trim() || normalizedEmail.split('@')[0] || 'BuildMate User',
        activeRole: safeRole,
        isVerified: isDefaultAdmin,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: { email: normalizedEmail },
      })
      .returning();

    profileRow = inserted[0];

    await db.insert(userRoles).values({
      profileId: profileRow.id,
      role: safeRole,
    });

    if (isDefaultAdmin) {
      await db.insert(userRoles).values({
        profileId: profileRow.id,
        role: 'customer',
      });
    }
  } else if (isDefaultAdmin && profileRow.activeRole !== 'super_admin') {
    const existingAdminRole = await db
      .select()
      .from(userRoles)
      .where(
        and(eq(userRoles.profileId, profileRow.id), eq(userRoles.role, 'super_admin'))
      )
      .limit(1);
    if (!existingAdminRole[0]) {
      await db.insert(userRoles).values({
        profileId: profileRow.id,
        role: 'super_admin',
      });
    }
  }

  return loadFullAuthenticatedProfile(profileRow.id);
}

export async function loadFullAuthenticatedProfile(
  profileId: number
): Promise<AuthenticatedProfile> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!rows[0]) {
    throw new Error('Profile not found');
  }
  const p = rows[0];
  const roleRows = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.profileId, p.id));
  const roles = Array.from(new Set(roleRows.map((r) => r.role)));
  if (p.email.toLowerCase() === SUPER_ADMIN_EMAIL && !roles.includes('super_admin')) {
    roles.push('super_admin');
  }

  const supplierRows = await db
    .select()
    .from(supplierProfiles)
    .where(eq(supplierProfiles.profileId, p.id))
    .limit(1);

  return {
    id: p.id,
    uid: p.uid,
    email: p.email,
    mobile: p.mobile,
    fullName: p.fullName,
    preferredLanguage: p.preferredLanguage,
    activeRole: p.activeRole,
    roles,
    isVerified: p.isVerified,
    isSuspended: p.isSuspended,
    supplierId: supplierRows[0]?.id ?? null,
    supplierVerificationStatus: supplierRows[0]?.verificationStatus ?? null,
  };
}

export async function resolveAuthFromRequest(
  req: Request
): Promise<AuthenticatedProfile | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // 1. Check BuildMate HMAC session token (email/mobile auth)
  const localSession = verifySessionToken(token);
  if (localSession) {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, localSession.uid))
      .limit(1);
    if (!existing[0]) return null;
    return loadFullAuthenticatedProfile(existing[0].id);
  }

  // 2. Verify Firebase ID Token (Google Sign-In)
  const decoded = await adminAuth.verifyIdToken(token);
  const email = decoded.email || `${decoded.uid}@firebase.local`;
  return getOrCreateProfile(decoded.uid, email, decoded.name);
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await resolveAuthFromRequest(req);
    if (!profile) {
      return res.status(401).json({ error: 'Unauthorized: Sign in required' });
    }
    if (profile.isSuspended) {
      return res.status(403).json({ error: 'Account suspended. Contact BuildMate support.' });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hasRole =
      req.profile.roles.some((r) => allowedRoles.includes(r)) ||
      allowedRoles.includes(req.profile.activeRole);
    if (!hasRole) {
      return res
        .status(403)
        .json({ error: 'Forbidden: Insufficient permissions for this role' });
    }
    next();
  };
};
