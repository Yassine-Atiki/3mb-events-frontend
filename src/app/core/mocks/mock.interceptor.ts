import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpParams,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditLogSearchParams } from '../api/admin.service';
import { AuthFlowResponse, AuthResponse, GoogleAuthRequest, LoginRequest, RefreshTokenRequest, RegisterRequest } from '../api/auth.service';
import type { TwoFactorChallenge } from '../api/auth.service';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../api/category.service';
import { CreateEventRequest, UpdateEventRequest } from '../api/event.service';
import { CreatePaymentIntentRequest } from '../api/payment.service';
import { CreateRefundRequest, RefundSearchParams } from '../api/refund.service';
import { CreateRegistrationRequest } from '../api/registration.service';
import { CreateTicketTypeRequest, UpdateTicketTypeRequest } from '../api/ticket.service';
import { UpdateProfileRequest } from '../api/user.service';
import { CreateVenueRequest, UpdateVenueRequest } from '../api/venue.service';
import {
  AdminStats,
  AuditLogEntry,
  Category,
  Event,
  EventStatus,
  OrganizerStats,
  PageResponse,
  PaymentIntent,
  RefundRequest,
  RefundStatus,
  Registration,
  RegistrationStatus,
  Ticket,
  TicketType,
  User,
  UserRole,
  UserStatus,
  Venue
} from '../models';
import {
  computeAdminStats,
  computeEventStats,
  computeOrganizerStats,
  createTicketsForRegistration,
  findCategoryById,
  findCredentialByEmail,
  findCredentialByUserId,
  findEventById,
  findEventBySlug,
  findRefundById,
  findRegistrationById,
  findTicketById,
  findTicketByQrCode,
  findTicketTypeById,
  findUserByEmail,
  findUserById,
  findVenueById,
  generateId,
  getCategoriesWithCounts,
  mockAuditLogs,
  mockCategories,
  mockEvents,
  mockPaymentIntents,
  mockRefunds,
  mockRefreshTokens,
  mockRegistrations,
  mockTicketTypes,
  mockTickets,
  mockUsers,
  mockVenues,
  DEFAULT_COVER_IMAGE,
  type MockRefreshToken
} from './mock-data';

const ACCESS_TOKEN_STORAGE_KEY = '3mb_access_token';
/** Access token lifetime in the mock (~15 min, matches the chosen JWT strategy). */
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Refresh token lifetime (30 days). */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class MockApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

interface RouteContext {
  req: HttpRequest<unknown>;
  params: Record<string, string>;
  query: HttpParams;
  body: unknown;
  currentUser: User | null;
}

interface MockRoute {
  method: string;
  pattern: string;
  status?: number;
  handler: (ctx: RouteContext) => unknown;
}

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getPath(req: HttpRequest<unknown>): string {
  let path = req.url;
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex);
  }
  if (path.startsWith(environment.apiUrl)) {
    path = path.slice(environment.apiUrl.length);
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter((segment) => segment.length > 0);
  const pathSegments = path.split('/').filter((segment) => segment.length > 0);
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];
    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

function getUserIdFromToken(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }
  // Access tokens remain parseable for the mock: mock-access-<userId>-<issuedAtMs>
  const match = /^mock-access-(.+)-(\d+)$/.exec(token);
  if (!match) {
    return null;
  }
  const issuedAt = Number(match[2]);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > ACCESS_TOKEN_TTL_MS) {
    return null;
  }
  return match[1];
}

/**
 * Mock stand-in for a real one-way hash (SHA-256 / bcrypt).
 * Production MUST hash refresh tokens server-side; never store plaintext.
 */
function hashRefreshToken(token: string): string {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256_mock_${(hash >>> 0).toString(16)}_${token.length}`;
}

function createOpaqueRefreshToken(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `rt_${random}${Math.random().toString(36).slice(2, 10)}`;
}

function issueRefreshToken(userId: string): string {
  const plain = createOpaqueRefreshToken();
  const now = new Date();
  const row: MockRefreshToken = {
    id: generateId('rft'),
    userId,
    tokenHash: hashRefreshToken(plain),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
    revoked: false,
    createdAt: now.toISOString()
  };
  mockRefreshTokens.push(row);
  return plain;
}

function findActiveRefreshToken(plain: string | null | undefined): MockRefreshToken | undefined {
  if (!plain) {
    return undefined;
  }
  const tokenHash = hashRefreshToken(plain);
  const now = Date.now();
  return mockRefreshTokens.find(
    (row) =>
      row.tokenHash === tokenHash &&
      !row.revoked &&
      new Date(row.expiresAt).getTime() > now
  );
}

function revokeRefreshToken(plain: string | null | undefined): void {
  if (!plain) {
    return;
  }
  const tokenHash = hashRefreshToken(plain);
  const row = mockRefreshTokens.find((item) => item.tokenHash === tokenHash && !item.revoked);
  if (row) {
    row.revoked = true;
  }
}

function revokeAllRefreshTokensForUser(userId: string): void {
  for (const row of mockRefreshTokens) {
    if (row.userId === userId && !row.revoked) {
      row.revoked = true;
    }
  }
}

function issueAccessToken(userId: string): string {
  return `mock-access-${userId}-${Date.now()}`;
}

function buildAuthResponse(user: User): AuthResponse {
  return {
    user,
    accessToken: issueAccessToken(user.id),
    refreshToken: issueRefreshToken(user.id)
  };
}

function getCurrentUser(req: HttpRequest<unknown>): User | null {
  const headerValue = req.headers.get('Authorization');
  const headerToken = headerValue ? headerValue.replace(/^Bearer\s+/i, '') : null;
  const storedToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) : null;
  const token = headerToken ?? storedToken;
  const userId = getUserIdFromToken(token);
  return userId ? (findUserById(userId) ?? null) : null;
}

function requireAuth(user: User | null): User {
  if (!user) {
    throw new MockApiError(401, 'Non authentifié.', 'UNAUTHORIZED');
  }
  return user;
}

function requireRole(user: User | null, roles: UserRole[]): User {
  const authenticated = requireAuth(user);
  if (!roles.includes(authenticated.role)) {
    throw new MockApiError(403, 'Accès refusé.', 'FORBIDDEN');
  }
  return authenticated;
}

function requireEventOwnerOrAdmin(user: User | null, event: Event): User {
  const authenticated = requireAuth(user);
  if (authenticated.role === 'ADMIN') {
    return authenticated;
  }
  if (authenticated.role === 'ORGANIZER' && authenticated.id === event.organizerId) {
    return authenticated;
  }
  throw new MockApiError(403, 'Accès refusé.', 'FORBIDDEN');
}

function resolveUserId(ctx: RouteContext): string {
  const id = ctx.params['id'];
  if (id === 'me') {
    return requireAuth(ctx.currentUser).id;
  }
  return id;
}

function paginate<T>(items: T[], page: number, size: number): PageResponse<T> {
  const safeSize = size > 0 ? size : 20;
  const safePage = page >= 0 ? page : 0;
  const start = safePage * safeSize;
  return {
    content: items.slice(start, start + safeSize),
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / safeSize)),
    page: safePage,
    size: safeSize
  };
}

function queryNumber(query: HttpParams, key: string, fallback: number): number {
  const raw = query.get(key);
  const parsed = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* -------------------------------------------------------------------------- */
/* AUTH                                                                       */
/* -------------------------------------------------------------------------- */

function handleLogin(ctx: RouteContext): AuthFlowResponse {
  const payload = ctx.body as LoginRequest;
  const credential = findCredentialByEmail(payload.email ?? '');
  const user = credential ? findUserById(credential.userId) : undefined;
  if (!credential || !user || credential.password !== payload.password) {
    throw new MockApiError(401, 'Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') {
    throw new MockApiError(403, 'Ce compte est désactivé.', 'ACCOUNT_DISABLED');
  }
  return maybeChallengeOrAuth(user);
}

function maybeChallengeOrAuth(user: User): AuthFlowResponse {
  if (user.totpEnabled) {
    const challenge: TwoFactorChallenge = {
      requires2fa: true,
      preAuthToken: `mock-preauth-${user.id}-${Date.now()}`
    };
    mockPreAuthTokens.set(challenge.preAuthToken, user.id);
    return challenge;
  }
  user.lastLoginAt = new Date().toISOString();
  const auth = buildAuthResponse(user);
  return {
    requires2fa: false,
    user: auth.user,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken
  };
}

/** preAuthToken → userId */
const mockPreAuthTokens = new Map<string, string>();
/** userId → pending mock secret (setup not yet enabled) */
const mockTotpPending = new Map<string, string>();
/** userId → unused recovery codes (plaintext for mock only) */
const mockRecoveryCodes = new Map<string, string[]>();

function handleRegister(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as RegisterRequest;
  if (!payload.email || !payload.password || !payload.firstName || !payload.lastName) {
    throw new MockApiError(400, 'Champs obligatoires manquants.', 'VALIDATION_ERROR');
  }
  if (findUserByEmail(payload.email)) {
    throw new MockApiError(409, 'Un compte existe déjà avec cet email.', 'EMAIL_TAKEN');
  }
  const role: UserRole = payload.role ?? 'ORGANIZER';
  if (role === 'ADMIN') {
    throw new MockApiError(400, 'Cannot self-register as ADMIN', 'INVALID_ROLE');
  }
  if (role === 'ORGANIZER' && !payload.organization?.trim()) {
    throw new MockApiError(400, 'Organization is required for organizers', 'ORGANIZATION_REQUIRED');
  }
  const now = new Date().toISOString();
  const user: User = {
    id: generateId('usr'),
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role,
    status: 'ACTIVE',
    organization: role === 'ORGANIZER' ? payload.organization!.trim() : payload.organization,
    phone: payload.phone,
    createdAt: now,
    lastLoginAt: now
  };
  mockUsers.push(user);
  return buildAuthResponse(user);
}

/** In-memory Google subject → userId map for mock linking. */
const mockGoogleSubjects = new Map<string, string>();

function decodeMockGoogleIdToken(idToken: string): {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
} {
  const parts = idToken.split('.');
  if (parts.length >= 2) {
    try {
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(json) as Record<string, unknown>;
      const email = typeof payload['email'] === 'string' ? payload['email'] : '';
      const sub = typeof payload['sub'] === 'string' ? payload['sub'] : '';
      if (email && sub) {
        return {
          sub,
          email: email.toLowerCase(),
          given_name: typeof payload['given_name'] === 'string' ? payload['given_name'] : undefined,
          family_name: typeof payload['family_name'] === 'string' ? payload['family_name'] : undefined,
          picture: typeof payload['picture'] === 'string' ? payload['picture'] : undefined,
          email_verified: payload['email_verified'] !== false
        };
      }
    } catch {
      /* fall through to opaque mock token */
    }
  }

  // Opaque demo token: "mock-google:<email>" or any string → stable mock profile
  const emailMatch = /^mock-google:(.+)$/i.exec(idToken.trim());
  const email = (emailMatch?.[1] ?? `google.${idToken.slice(0, 8)}@mock.local`).toLowerCase();
  return {
    sub: `mock-sub-${email}`,
    email,
    given_name: 'Google',
    family_name: 'User',
    email_verified: true
  };
}

function handleGoogleAuth(ctx: RouteContext): AuthFlowResponse {
  const payload = ctx.body as GoogleAuthRequest;
  if (!payload?.idToken) {
    throw new MockApiError(400, 'Google ID token is required', 'VALIDATION_ERROR');
  }

  const profile = decodeMockGoogleIdToken(payload.idToken);
  if (profile.email_verified === false) {
    throw new MockApiError(401, 'Google email is not verified', 'EMAIL_NOT_VERIFIED');
  }

  let user: User | undefined;
  const linkedUserId = mockGoogleSubjects.get(profile.sub);
  if (linkedUserId) {
    user = findUserById(linkedUserId);
  }
  if (!user) {
    user = findUserByEmail(profile.email);
    if (user) {
      mockGoogleSubjects.set(profile.sub, user.id);
      if (!user.firstName && profile.given_name) user.firstName = profile.given_name;
      if (!user.lastName && profile.family_name) user.lastName = profile.family_name;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
    }
  }

  if (!user) {
    const role: UserRole = payload.role ?? 'ORGANIZER';
    if (role === 'ADMIN') {
      throw new MockApiError(400, 'Cannot self-register as ADMIN', 'INVALID_ROLE');
    }
    const now = new Date().toISOString();
    user = {
      id: generateId('usr'),
      email: profile.email,
      firstName: profile.given_name || profile.email.split('@')[0] || 'Utilisateur',
      lastName: profile.family_name || '.',
      role,
      status: 'ACTIVE',
      organization: payload.organization?.trim() || undefined,
      avatarUrl: profile.picture,
      createdAt: now,
      lastLoginAt: now
    };
    mockUsers.push(user);
    mockGoogleSubjects.set(profile.sub, user.id);
  }

  if (user.status !== 'ACTIVE') {
    throw new MockApiError(403, 'Ce compte est désactivé.', 'ACCOUNT_DISABLED');
  }

  return maybeChallengeOrAuth(user);
}

function handleLogout(ctx: RouteContext): null {
  const payload = (ctx.body ?? {}) as { refreshToken?: string };
  if (payload.refreshToken) {
    revokeRefreshToken(payload.refreshToken);
  } else if (ctx.currentUser) {
    // Fallback: revoke all sessions for the authenticated user (Bearer access token).
    revokeAllRefreshTokensForUser(ctx.currentUser.id);
  }
  return null;
}

function handleMe(ctx: RouteContext): User {
  return requireAuth(ctx.currentUser);
}

function handleRefresh(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as RefreshTokenRequest;
  const row = findActiveRefreshToken(payload.refreshToken);
  if (!row) {
    throw new MockApiError(401, 'Refresh token invalide.', 'INVALID_REFRESH_TOKEN');
  }
  const user = findUserById(row.userId);
  if (!user || user.status !== 'ACTIVE') {
    throw new MockApiError(401, 'Refresh token invalide.', 'INVALID_REFRESH_TOKEN');
  }
  // Strategy: issue a new short-lived access token; keep the same opaque refresh token
  // until expiry/logout (frontend AuthResponse still includes refreshToken).
  return {
    user,
    accessToken: issueAccessToken(user.id),
    refreshToken: payload.refreshToken
  };
}

function handleForgotPassword(): null {
  return null;
}

function handleResetPassword(ctx: RouteContext): null {
  const payload = ctx.body as { token?: string; newPassword?: string };
  if (!payload.token || !payload.newPassword) {
    throw new MockApiError(400, 'Requête invalide.', 'VALIDATION_ERROR');
  }
  return null;
}

function handleChangePassword(ctx: RouteContext): null {
  const user = requireAuth(ctx.currentUser);
  const payload = ctx.body as { currentPassword?: string; newPassword?: string };
  const credential = findCredentialByUserId(user.id);
  if (!credential || credential.password !== payload.currentPassword) {
    throw new MockApiError(400, 'Mot de passe actuel incorrect.', 'INVALID_PASSWORD');
  }
  credential.password = payload.newPassword ?? credential.password;
  return null;
}

function handleTotpVerify(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as { preAuthToken?: string; code?: string };
  if (!payload.preAuthToken || !payload.code) {
    throw new MockApiError(400, 'Champs obligatoires manquants.', 'VALIDATION_ERROR');
  }
  const userId = mockPreAuthTokens.get(payload.preAuthToken);
  if (!userId) {
    throw new MockApiError(401, 'Session 2FA expirée ou invalide', 'INVALID_PRE_AUTH_TOKEN');
  }
  const user = findUserById(userId);
  if (!user?.totpEnabled) {
    throw new MockApiError(400, "La 2FA n'est pas activée sur ce compte", 'TOTP_NOT_ENABLED');
  }
  const code = payload.code.trim();
  const recoveries = mockRecoveryCodes.get(userId) ?? [];
  const recoveryIdx = recoveries.findIndex((c) => c.replace(/-/g, '').toUpperCase() === code.replace(/[\s-]/g, '').toUpperCase());
  const totpOk = code === '000000' || /^\d{6}$/.test(code);
  if (recoveryIdx >= 0) {
    recoveries.splice(recoveryIdx, 1);
    mockRecoveryCodes.set(userId, recoveries);
  } else if (!totpOk) {
    throw new MockApiError(401, 'Code 2FA invalide', 'INVALID_TOTP_CODE');
  }
  mockPreAuthTokens.delete(payload.preAuthToken);
  user.lastLoginAt = new Date().toISOString();
  return buildAuthResponse(user);
}

function handleTotpSetup(ctx: RouteContext): { secret: string; otpauthUrl: string; qrCodeDataUrl: string } {
  const user = requireAuth(ctx.currentUser);
  if (user.totpEnabled) {
    throw new MockApiError(409, 'La 2FA est déjà activée', 'TOTP_ALREADY_ENABLED');
  }
  const secret = 'MOCKTOTPSECRET123';
  mockTotpPending.set(user.id, secret);
  const otpauthUrl = `otpauth://totp/3MB%20Events:${encodeURIComponent(user.email)}?secret=${secret}&issuer=3MB%20Events`;
  // 1x1 transparent PNG
  const qrCodeDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return { secret, otpauthUrl, qrCodeDataUrl };
}

function handleTotpEnable(ctx: RouteContext): { recoveryCodes: string[] } {
  const user = requireAuth(ctx.currentUser);
  if (user.totpEnabled) {
    throw new MockApiError(409, 'La 2FA est déjà activée', 'TOTP_ALREADY_ENABLED');
  }
  if (!mockTotpPending.has(user.id)) {
    throw new MockApiError(400, "Lancez d'abord la configuration 2FA", 'TOTP_SETUP_REQUIRED');
  }
  const code = (ctx.body as { code?: string })?.code?.trim() ?? '';
  if (code !== '000000' && !/^\d{6}$/.test(code)) {
    throw new MockApiError(400, 'Code 2FA invalide', 'INVALID_TOTP_CODE');
  }
  mockTotpPending.delete(user.id);
  user.totpEnabled = true;
  const recoveryCodes = Array.from({ length: 10 }, (_, i) => `A${i}B${i}-C${i}D${i}`);
  mockRecoveryCodes.set(user.id, [...recoveryCodes]);
  return { recoveryCodes };
}

function handleTotpDisable(ctx: RouteContext): null {
  const user = requireAuth(ctx.currentUser);
  if (!user.totpEnabled) {
    throw new MockApiError(400, "La 2FA n'est pas activée", 'TOTP_NOT_ENABLED');
  }
  const code = (ctx.body as { code?: string })?.code?.trim() ?? '';
  const recoveries = mockRecoveryCodes.get(user.id) ?? [];
  const recoveryOk = recoveries.some(
    (c) => c.replace(/-/g, '').toUpperCase() === code.replace(/[\s-]/g, '').toUpperCase()
  );
  if (code !== '000000' && !/^\d{6}$/.test(code) && !recoveryOk) {
    throw new MockApiError(400, 'Code 2FA invalide', 'INVALID_TOTP_CODE');
  }
  user.totpEnabled = false;
  mockRecoveryCodes.delete(user.id);
  mockTotpPending.delete(user.id);
  return null;
}

function handleTotpStatus(ctx: RouteContext): { enabled: boolean } {
  const user = requireAuth(ctx.currentUser);
  return { enabled: !!user.totpEnabled };
}

/* -------------------------------------------------------------------------- */
/* USERS                                                                      */
/* -------------------------------------------------------------------------- */

function handleSearchUsers(ctx: RouteContext): PageResponse<User> {
  requireRole(ctx.currentUser, ['ADMIN']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const query = ctx.query.get('query')?.toLowerCase() ?? null;
  const role = ctx.query.get('role') as UserRole | null;
  const status = ctx.query.get('status') as UserStatus | null;

  let results = [...mockUsers];
  if (query) {
    results = results.filter((user) =>
      `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(query)
    );
  }
  if (role) {
    results = results.filter((user) => user.role === role);
  }
  if (status) {
    results = results.filter((user) => user.status === status);
  }
  return paginate(results, page, size);
}

function handleGetUser(ctx: RouteContext): User {
  const user = findUserById(resolveUserId(ctx));
  if (!user) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  return user;
}

function handleUpdateProfile(ctx: RouteContext): User {
  const user = findUserById(resolveUserId(ctx));
  if (!user) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  const payload = ctx.body as UpdateProfileRequest;
  if (payload.organization !== undefined) {
    const organization = payload.organization?.trim() ?? '';
    if (!organization) {
      if (user.role === 'ORGANIZER') {
        throw new MockApiError(400, 'Organization is required for organizers', 'ORGANIZATION_REQUIRED');
      }
      user.organization = undefined;
    } else {
      user.organization = organization;
    }
  }
  if (payload.firstName !== undefined) user.firstName = payload.firstName;
  if (payload.lastName !== undefined) user.lastName = payload.lastName;
  if (payload.phone !== undefined) user.phone = payload.phone;
  if (payload.avatarUrl !== undefined) {
    if (payload.avatarUrl === '') {
      delete user.avatarUrl;
    } else {
      user.avatarUrl = payload.avatarUrl;
    }
  }
  return { ...user };
}

function handleUpdateUserStatus(ctx: RouteContext): User {
  requireRole(ctx.currentUser, ['ADMIN']);
  const user = findUserById(ctx.params['id']);
  if (!user) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  user.status = (ctx.body as { status: UserStatus }).status;
  if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    revokeAllRefreshTokensForUser(user.id);
  }
  return user;
}

function handleUpdateUserRole(ctx: RouteContext): User {
  requireRole(ctx.currentUser, ['ADMIN']);
  const user = findUserById(ctx.params['id']);
  if (!user) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  user.role = (ctx.body as { role: UserRole }).role;
  return user;
}

function handleDeleteUser(ctx: RouteContext): null {
  requireRole(ctx.currentUser, ['ADMIN']);
  const index = mockUsers.findIndex((user) => user.id === ctx.params['id']);
  if (index === -1) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  mockUsers.splice(index, 1);
  return null;
}

/* -------------------------------------------------------------------------- */
/* EVENTS                                                                     */
/* -------------------------------------------------------------------------- */

function handleSearchEvents(ctx: RouteContext): PageResponse<Event> {
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 12);
  const query = (ctx.query.get('query') ?? ctx.query.get('search'))?.toLowerCase() ?? null;
  const categoryId = ctx.query.get('categoryId') ?? ctx.query.get('category');
  const city = ctx.query.get('city');
  const status = ctx.query.get('status') as EventStatus | null;
  const organizerId = ctx.query.get('organizerId');
  const from = ctx.query.get('from') ?? ctx.query.get('dateFrom');
  const to = ctx.query.get('to') ?? ctx.query.get('dateTo');
  const isFreeParam = ctx.query.get('isFree');

  let results = [...mockEvents];

  if (status) {
    results = results.filter((event) => event.status === status);
  } else if (!organizerId) {
    results = results.filter((event) => event.status === 'PUBLIE' || event.status === 'COMPLET');
  }
  if (query) {
    results = results.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.shortDescription.toLowerCase().includes(query)
    );
  }
  if (categoryId) {
    results = results.filter((event) => event.categoryId === categoryId);
  }
  if (city) {
    results = results.filter((event) => event.city.toLowerCase() === city.toLowerCase());
  }
  if (organizerId) {
    results = results.filter((event) => event.organizerId === organizerId);
  }
  if (from) {
    results = results.filter((event) => event.startAt >= from);
  }
  if (to) {
    results = results.filter((event) => event.startAt <= to);
  }
  if (isFreeParam !== null) {
    results = results.filter((event) => event.isFree === (isFreeParam === 'true'));
  }

  results = [...results].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return paginate(results, page, size);
}

function handleGetEvent(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  return event;
}

function handleGetEventBySlug(ctx: RouteContext): Event {
  const event = findEventBySlug(ctx.params['slug']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  return event;
}

function handleCreateEvent(ctx: RouteContext): Event {
  const user = requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const payload = ctx.body as CreateEventRequest;
  const now = new Date().toISOString();
  const event: Event = {
    id: generateId('evt'),
    slug: `${slugify(payload.title)}-${Date.now().toString(36)}`,
    title: payload.title,
    description: payload.description,
    shortDescription: payload.shortDescription,
    coverImageUrl: payload.coverImageUrl ?? DEFAULT_COVER_IMAGE,
    status: payload.status === 'PUBLIE' ? 'PUBLIE' : 'BROUILLON',
    categoryId: payload.categoryId,
    venueId: payload.venueId,
    organizerId: user.id,
    organizerName: `${user.firstName} ${user.lastName}`,
    startAt: payload.startAt,
    endAt: payload.endAt,
    city: payload.city,
    capacity: payload.capacity,
    visibility: payload.visibility,
    priceFrom: payload.isFree ? 0 : (payload.priceFrom ?? 0),
    isFree: payload.isFree,
    createdAt: now,
    updatedAt: now
  };
  mockEvents.push(event);
  return event;
}

function handleUpdateEvent(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  Object.assign(event, ctx.body as UpdateEventRequest);
  event.updatedAt = new Date().toISOString();
  return event;
}

function handleUpdateEventStatus(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  event.status = (ctx.body as { status: EventStatus }).status;
  event.updatedAt = new Date().toISOString();
  return event;
}

function handleDeleteEvent(ctx: RouteContext): null {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  const eventId = event.id;
  const registrationIds = new Set(
    mockRegistrations.filter((registration) => registration.eventId === eventId).map((r) => r.id)
  );
  for (let i = mockRefunds.length - 1; i >= 0; i--) {
    if (mockRefunds[i].eventId === eventId || registrationIds.has(mockRefunds[i].registrationId)) {
      mockRefunds.splice(i, 1);
    }
  }
  for (let i = mockPaymentIntents.length - 1; i >= 0; i--) {
    if (registrationIds.has(mockPaymentIntents[i].registrationId)) {
      mockPaymentIntents.splice(i, 1);
    }
  }
  for (let i = mockTickets.length - 1; i >= 0; i--) {
    if (mockTickets[i].eventId === eventId || registrationIds.has(mockTickets[i].registrationId)) {
      mockTickets.splice(i, 1);
    }
  }
  for (let i = mockRegistrations.length - 1; i >= 0; i--) {
    if (mockRegistrations[i].eventId === eventId) {
      mockRegistrations.splice(i, 1);
    }
  }
  for (let i = mockTicketTypes.length - 1; i >= 0; i--) {
    if (mockTicketTypes[i].eventId === eventId) {
      mockTicketTypes.splice(i, 1);
    }
  }
  mockEvents.splice(mockEvents.indexOf(event), 1);
  return null;
}

function handleDuplicateEvent(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  const now = new Date().toISOString();
  const copy: Event = {
    ...event,
    id: generateId('evt'),
    slug: `${event.slug}-copie-${Date.now().toString(36)}`,
    title: `${event.title} (copie)`,
    status: 'BROUILLON',
    createdAt: now,
    updatedAt: now
  };
  mockEvents.push(copy);
  return copy;
}

function handleEventsByOrganizer(ctx: RouteContext): PageResponse<Event> {
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const results = mockEvents
    .filter((event) => event.organizerId === ctx.params['organizerId'])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(results, page, size);
}

function handleGetTicketTypesByEvent(ctx: RouteContext): TicketType[] {
  return mockTicketTypes.filter((ticketType) => ticketType.eventId === ctx.params['id']);
}

function handleCreateTicketType(ctx: RouteContext): TicketType {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  const payload = ctx.body as CreateTicketTypeRequest;
  const ticketType: TicketType = {
    ...payload,
    id: generateId('tt'),
    eventId: event.id,
    quantitySold: 0
  };
  mockTicketTypes.push(ticketType);
  return ticketType;
}

/* -------------------------------------------------------------------------- */
/* CATEGORIES                                                                 */
/* -------------------------------------------------------------------------- */

function handleListCategories(): Category[] {
  return getCategoriesWithCounts();
}

function handleGetCategory(ctx: RouteContext): Category {
  const category = findCategoryById(ctx.params['id']);
  if (!category) {
    throw new MockApiError(404, 'Catégorie introuvable.');
  }
  return {
    ...category,
    eventCount: mockEvents.filter(
      (event) => event.categoryId === category.id && event.status === 'PUBLIE'
    ).length
  };
}

function handleCreateCategory(ctx: RouteContext): Category {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const payload = ctx.body as CreateCategoryRequest;
  const category: Category = { ...payload, id: generateId('cat'), eventCount: 0 };
  mockCategories.push(category);
  return category;
}

function handleUpdateCategory(ctx: RouteContext): Category {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const category = findCategoryById(ctx.params['id']);
  if (!category) {
    throw new MockApiError(404, 'Catégorie introuvable.');
  }
  Object.assign(category, ctx.body as UpdateCategoryRequest);
  return category;
}

function handleDeleteCategory(ctx: RouteContext): null {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const index = mockCategories.findIndex((category) => category.id === ctx.params['id']);
  if (index === -1) {
    throw new MockApiError(404, 'Catégorie introuvable.');
  }
  mockCategories.splice(index, 1);
  return null;
}

/* -------------------------------------------------------------------------- */
/* VENUES                                                                     */
/* -------------------------------------------------------------------------- */

function handleListVenues(ctx: RouteContext): Venue[] {
  const city = ctx.query.get('city');
  return city ? mockVenues.filter((venue) => venue.city.toLowerCase() === city.toLowerCase()) : mockVenues;
}

function handleGetVenue(ctx: RouteContext): Venue {
  const venue = findVenueById(ctx.params['id']);
  if (!venue) {
    throw new MockApiError(404, 'Lieu introuvable.');
  }
  return venue;
}

function handleCreateVenue(ctx: RouteContext): Venue {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const payload = ctx.body as CreateVenueRequest;
  const venue: Venue = { ...payload, id: generateId('venue') };
  mockVenues.push(venue);
  return venue;
}

function handleUpdateVenue(ctx: RouteContext): Venue {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const venue = findVenueById(ctx.params['id']);
  if (!venue) {
    throw new MockApiError(404, 'Lieu introuvable.');
  }
  Object.assign(venue, ctx.body as UpdateVenueRequest);
  return venue;
}

function handleDeleteVenue(ctx: RouteContext): null {
  requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const index = mockVenues.findIndex((venue) => venue.id === ctx.params['id']);
  if (index === -1) {
    throw new MockApiError(404, 'Lieu introuvable.');
  }
  mockVenues.splice(index, 1);
  return null;
}

/* -------------------------------------------------------------------------- */
/* PUBLIC REGISTRATION                                                        */
/* -------------------------------------------------------------------------- */

function findEventByPublicToken(token: string): Event | undefined {
  return mockEvents.find(
    (event) => event.publicRegistrationEnabled && event.publicRegistrationToken === token
  );
}

function handleEnablePublicRegistration(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  event.publicRegistrationEnabled = true;
  event.publicRegistrationToken = event.publicRegistrationToken ?? generateId('pub-reg');
  event.updatedAt = new Date().toISOString();
  return event;
}

function handleRevokePublicRegistration(ctx: RouteContext): Event {
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  event.publicRegistrationEnabled = false;
  event.publicRegistrationToken = null;
  event.updatedAt = new Date().toISOString();
  return event;
}

function handleGetPublicRegistrationInfo(ctx: RouteContext) {
  const event = findEventByPublicToken(ctx.params['token']);
  if (!event) {
    throw new MockApiError(404, "Lien d'inscription invalide ou expiré.");
  }
  return {
    eventId: event.id,
    eventTitle: event.title,
    eventSlug: event.slug,
    shortDescription: event.shortDescription,
    startAt: event.startAt,
    endAt: event.endAt,
    city: event.city,
    isFree: event.isFree,
    ticketTypes: mockTicketTypes.filter((ticketType) => ticketType.eventId === event.id)
  };
}

function handlePublicRegister(ctx: RouteContext): Registration {
  const event = findEventByPublicToken(ctx.params['token']);
  if (!event) {
    throw new MockApiError(404, "Lien d'inscription invalide ou expiré.");
  }
  const payload = ctx.body as {
    participantFirstName: string;
    participantLastName: string;
    participantEmail: string;
    participantPhone?: string;
    ticketTypeId?: string;
    quantity?: number;
  };
  if (!payload.participantFirstName?.trim() || !payload.participantLastName?.trim() || !payload.participantEmail?.trim()) {
    throw new MockApiError(400, 'Les informations du participant sont requises.', 'VALIDATION_ERROR');
  }

  const eventTicketTypes = mockTicketTypes.filter((ticketType) => ticketType.eventId === event.id);
  const ticketType =
    (payload.ticketTypeId ? findTicketTypeById(payload.ticketTypeId) : undefined) ?? eventTicketTypes[0];
  if (!ticketType || ticketType.eventId !== event.id) {
    throw new MockApiError(404, 'Type de billet introuvable.');
  }

  const quantity = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
  const available = ticketType.quantityTotal - ticketType.quantitySold;
  if (quantity > available) {
    throw new MockApiError(409, 'Places insuffisantes pour ce type de billet.', 'SOLD_OUT');
  }

  const email = payload.participantEmail.trim().toLowerCase();
  const alreadyRegistered = mockRegistrations.some(
    (registration) =>
      registration.eventId === event.id &&
      registration.participantEmail.toLowerCase() === email &&
      registration.status !== 'CANCELLED' &&
      registration.status !== 'REFUNDED'
  );
  if (alreadyRegistered) {
    throw new MockApiError(
      409,
      'Vous êtes déjà inscrit à cet événement avec cet email.',
      'ALREADY_REGISTERED'
    );
  }

  const now = new Date().toISOString();
  const registration: Registration = {
    id: generateId('reg'),
    eventId: event.id,
    participantFirstName: payload.participantFirstName.trim(),
    participantLastName: payload.participantLastName.trim(),
    participantEmail: email,
    participantPhone: payload.participantPhone?.trim() || undefined,
    ticketTypeId: ticketType.id,
    status: event.isFree ? 'CONFIRMED' : 'PENDING',
    quantity,
    totalPrice: ticketType.price * quantity,
    currency: ticketType.currency,
    createdAt: now,
    updatedAt: now
  };
  mockRegistrations.push(registration);
  ticketType.quantitySold += quantity;
  if (registration.status === 'CONFIRMED') {
    createTicketsForRegistration(registration);
  }
  return registration;
}

/* -------------------------------------------------------------------------- */
/* REGISTRATIONS                                                              */
/* -------------------------------------------------------------------------- */

function handleSearchRegistrations(ctx: RouteContext): PageResponse<Registration> {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const eventId = ctx.query.get('eventId');
  const participantEmail = ctx.query.get('participantEmail');
  const status = ctx.query.get('status') as RegistrationStatus | null;

  let results = [...mockRegistrations];
  if (eventId) {
    results = results.filter((registration) => registration.eventId === eventId);
  }
  if (participantEmail) {
    results = results.filter((registration) => registration.participantEmail === participantEmail);
  }
  if (status) {
    results = results.filter((registration) => registration.status === status);
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(results, page, size);
}

function handleGetRegistration(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  return registration;
}

function handleCreateRegistration(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const payload = ctx.body as CreateRegistrationRequest;
  const event = findEventById(payload.eventId);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  if (!payload.participantFirstName?.trim() || !payload.participantLastName?.trim() || !payload.participantEmail?.trim()) {
    throw new MockApiError(400, 'Les informations du participant sont requises.', 'VALIDATION_ERROR');
  }
  const ticketType = findTicketTypeById(payload.ticketTypeId);
  if (!ticketType) {
    throw new MockApiError(404, 'Type de billet introuvable.');
  }
  const available = ticketType.quantityTotal - ticketType.quantitySold;
  if (payload.quantity > available) {
    throw new MockApiError(409, 'Places insuffisantes pour ce type de billet.', 'SOLD_OUT');
  }

  const now = new Date().toISOString();
  const registration: Registration = {
    id: generateId('reg'),
    eventId: event.id,
    participantFirstName: payload.participantFirstName.trim(),
    participantLastName: payload.participantLastName.trim(),
    participantEmail: payload.participantEmail.trim(),
    participantPhone: payload.participantPhone?.trim() || undefined,
    ticketTypeId: ticketType.id,
    status: 'CONFIRMED',
    quantity: payload.quantity,
    totalPrice: ticketType.price * payload.quantity,
    currency: ticketType.currency,
    createdAt: now,
    updatedAt: now
  };
  mockRegistrations.push(registration);
  ticketType.quantitySold += payload.quantity;
  createTicketsForRegistration(registration);
  return registration;
}

function handleCancelRegistration(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  registration.status = 'CANCELLED';
  registration.updatedAt = new Date().toISOString();
  mockTickets
    .filter((ticket) => ticket.registrationId === registration.id)
    .forEach((ticket) => {
      if (ticket.status === 'VALID' || ticket.status === 'EXPIRED') {
        ticket.status = 'CANCELLED';
      }
    });
  return registration;
}

function handleCheckInRegistration(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  registration.status = 'ATTENDED';
  registration.checkedInAt = new Date().toISOString();
  registration.updatedAt = registration.checkedInAt;
  return registration;
}

function handleDeleteRegistration(ctx: RouteContext): null {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const index = mockRegistrations.findIndex((r) => r.id === ctx.params['id']);
  if (index === -1) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  mockRegistrations.splice(index, 1);
  return null;
}

function handleUpdateRegistrationStatus(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  registration.status = (ctx.body as { status: RegistrationStatus }).status;
  registration.updatedAt = new Date().toISOString();
  if (registration.status === 'CANCELLED') {
    mockTickets
      .filter((ticket) => ticket.registrationId === registration.id)
      .forEach((ticket) => {
        if (ticket.status === 'VALID' || ticket.status === 'EXPIRED') {
          ticket.status = 'CANCELLED';
        }
      });
  }
  return registration;
}

function handleChangeRegistrationTicketType(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  const ticketTypeId = (ctx.body as { ticketTypeId?: string }).ticketTypeId;
  const ticketType = ticketTypeId ? findTicketTypeById(ticketTypeId) : undefined;
  if (!ticketType || ticketType.eventId !== registration.eventId) {
    throw new MockApiError(400, 'Type de billet invalide.', 'VALIDATION_ERROR');
  }
  registration.ticketTypeId = ticketType.id;
  registration.totalPrice = ticketType.price * registration.quantity;
  registration.currency = ticketType.currency;
  registration.updatedAt = new Date().toISOString();
  return registration;
}

function handleSendRegistrationTicket(ctx: RouteContext): { sent: number; skipped: number; message: string } {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  if (registration.status === 'CANCELLED' || registration.status === 'REFUNDED') {
    throw new MockApiError(400, 'Inscription non éligible.', 'INVALID_STATUS');
  }
  const hasValid = mockTickets.some(
    (ticket) => ticket.registrationId === registration.id && ticket.status === 'VALID'
  );
  if (!hasValid) {
    throw new MockApiError(400, 'Aucun billet valide à envoyer.', 'NO_TICKETS');
  }
  return {
    sent: 1,
    skipped: 0,
    message: `Billet(s) envoyé(s) à ${registration.participantEmail}`
  };
}

function handleSendEventTickets(ctx: RouteContext): { sent: number; skipped: number; message: string } {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  const regs = mockRegistrations.filter((r) => r.eventId === event.id);
  let sent = 0;
  let skipped = 0;
  for (const registration of regs) {
    if (
      registration.status === 'CANCELLED' ||
      registration.status === 'REFUNDED' ||
      registration.status === 'PENDING'
    ) {
      skipped++;
      continue;
    }
    const hasValid = mockTickets.some(
      (ticket) => ticket.registrationId === registration.id && ticket.status === 'VALID'
    );
    if (!hasValid) {
      skipped++;
      continue;
    }
    sent++;
  }
  return { sent, skipped, message: `${sent} email(s) envoyé(s), ${skipped} ignoré(s)` };
}

/* -------------------------------------------------------------------------- */
/* TICKETS                                                                    */
/* -------------------------------------------------------------------------- */

function handleUpdateTicketType(ctx: RouteContext): TicketType {
  const ticketType = findTicketTypeById(ctx.params['id']);
  if (!ticketType) {
    throw new MockApiError(404, 'Type de billet introuvable.');
  }
  const event = findEventById(ticketType.eventId);
  if (event) {
    requireEventOwnerOrAdmin(ctx.currentUser, event);
  } else {
    requireRole(ctx.currentUser, ['ADMIN']);
  }
  Object.assign(ticketType, ctx.body as UpdateTicketTypeRequest);
  return ticketType;
}

function handleDeleteTicketType(ctx: RouteContext): null {
  const ticketType = findTicketTypeById(ctx.params['id']);
  if (!ticketType) {
    throw new MockApiError(404, 'Type de billet introuvable.');
  }
  const event = findEventById(ticketType.eventId);
  if (event) {
    requireEventOwnerOrAdmin(ctx.currentUser, event);
  } else {
    requireRole(ctx.currentUser, ['ADMIN']);
  }
  mockTicketTypes.splice(mockTicketTypes.indexOf(ticketType), 1);
  return null;
}

function handleGetTicket(ctx: RouteContext): Ticket {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const ticket = findTicketById(ctx.params['id']);
  if (!ticket) {
    throw new MockApiError(404, 'Billet introuvable.');
  }
  return ticket;
}

function handleValidateTicket(ctx: RouteContext): Ticket {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const payload = ctx.body as { qrCode: string; eventId: string };
  if (!payload.eventId) {
    throw new MockApiError(400, "L'identifiant d'événement est requis.", 'EVENT_REQUIRED');
  }
  const qrCode = extractMockQrCode(payload.qrCode);
  const ticket = findTicketByQrCode(qrCode);
  if (!ticket) {
    throw new MockApiError(404, 'Billet invalide ou introuvable.', 'INVALID_TICKET');
  }
  if (ticket.eventId !== payload.eventId) {
    throw new MockApiError(400, "Ce billet n'appartient pas à cet événement.", 'WRONG_EVENT');
  }
  expireMockTicketIfNeeded(ticket);
  if (ticket.status === 'USED') {
    throw new MockApiError(409, 'Ce billet a déjà été scanné.', 'ALREADY_SCANNED');
  }
  if (ticket.status === 'EXPIRED') {
    throw new MockApiError(400, 'Ce billet a expiré.', 'TICKET_EXPIRED');
  }
  if (ticket.status === 'CANCELLED') {
    throw new MockApiError(400, 'Ce billet a été annulé.', 'TICKET_CANCELLED');
  }
  if (ticket.status !== 'VALID') {
    throw new MockApiError(400, `Ce billet n'est pas valide (statut : ${ticket.status}).`, 'INVALID_TICKET');
  }
  ticket.status = 'USED';
  ticket.usedAt = new Date().toISOString();
  return ticket;
}

function extractMockQrCode(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed).searchParams.get('qr')?.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

function expireMockTicketIfNeeded(ticket: Ticket): void {
  if (ticket.status !== 'VALID') return;
  const event = findEventById(ticket.eventId);
  if (event && Date.now() > new Date(event.endAt).getTime()) {
    ticket.status = 'EXPIRED';
  }
}

function handleTicketInfo(ctx: RouteContext): Record<string, unknown> {
  const rawQr = ctx.query.get('qrCode') ?? '';
  const eventId = ctx.query.get('eventId') || '';
  if (!eventId) {
    throw new MockApiError(400, "L'identifiant d'événement est requis.", 'EVENT_REQUIRED');
  }
  const qrCode = extractMockQrCode(rawQr);
  const ticket = findTicketByQrCode(qrCode);
  if (!ticket) {
    throw new MockApiError(400, 'Billet invalide ou introuvable.', 'INVALID_TICKET');
  }
  if (ticket.eventId !== eventId) {
    throw new MockApiError(400, "Ce billet n'appartient pas à cet événement.", 'WRONG_EVENT');
  }
  expireMockTicketIfNeeded(ticket);
  const event = findEventById(ticket.eventId);
  const ticketType = findTicketTypeById(ticket.ticketTypeId);
  const isOrganizer =
    ctx.currentUser &&
    (ctx.currentUser.role === 'ORGANIZER' || ctx.currentUser.role === 'ADMIN');

  if (isOrganizer) {
    return {
      mode: 'ORGANIZER_VIEW',
      eventId: ticket.eventId,
      eventTitle: event?.title ?? 'Événement',
      city: event?.city,
      ticketId: ticket.id,
      participantFirstName: ticket.participantFirstName,
      participantLastName: ticket.participantLastName,
      participantEmail: ticket.participantEmail,
      ticketTypeName: ticketType?.name,
      status: ticket.status,
      issuedAt: ticket.issuedAt,
      usedAt: ticket.usedAt ?? null,
      eventStartAt: event?.startAt,
      eventEndAt: event?.endAt,
      canValidate: ticket.status === 'VALID',
      message:
        ticket.status === 'VALID'
          ? 'Billet valide — prêt à être scanné à l\'entrée.'
          : ticket.status === 'USED'
            ? 'Billet déjà scanné.'
            : ticket.status === 'EXPIRED'
              ? 'Billet expiré — entrée refusée.'
              : ticket.status === 'CANCELLED'
                ? 'Billet annulé — entrée refusée.'
                : 'Billet non valide.'
    };
  }

  const email = ticket.participantEmail;
  const masked =
    email && email.includes('@')
      ? `${email[0]}***@${email.split('@')[1]}`
      : email;

  return {
    mode: 'PARTICIPANT_VIEW',
    eventId: ticket.eventId,
    eventTitle: event?.title ?? 'Événement',
    city: event?.city,
    ticketId: ticket.id,
    participantFirstName: ticket.participantFirstName,
    participantLastName: ticket.participantLastName,
    participantEmail: masked,
    ticketTypeName: ticketType?.name,
    status: ticket.status,
    issuedAt: ticket.issuedAt,
    usedAt: null,
    eventStartAt: event?.startAt,
    eventEndAt: event?.endAt,
    canValidate: false,
    message:
      ticket.status === 'VALID'
        ? "Votre billet est valide. Présentez-le à l'entrée."
        : ticket.status === 'USED'
          ? 'Ce billet a déjà été utilisé pour entrer.'
          : ticket.status === 'EXPIRED'
            ? 'Ce billet a expiré.'
            : ticket.status === 'CANCELLED'
              ? 'Ce billet a été annulé.'
              : 'Ce billet n\'est pas valide.'
  };
}

function handleEventScanStats(ctx: RouteContext): { eventId: string; scanned: number; issued: number; capacity: number } {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const event = findEventById(ctx.params['id']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  const eventTickets = mockTickets.filter((ticket) => ticket.eventId === event.id);
  return {
    eventId: event.id,
    scanned: eventTickets.filter((ticket) => ticket.status === 'USED').length,
    issued: eventTickets.length,
    capacity: event.capacity
  };
}

/* -------------------------------------------------------------------------- */
/* PAYMENTS                                                                   */
/* -------------------------------------------------------------------------- */

function handleCreatePaymentIntent(ctx: RouteContext): PaymentIntent {
  requireAuth(ctx.currentUser);
  const payload = ctx.body as CreatePaymentIntentRequest;
  const registration = findRegistrationById(payload.registrationId);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  const intent: PaymentIntent = {
    id: generateId('pi'),
    registrationId: payload.registrationId,
    amount: payload.amount,
    currency: payload.currency,
    status: 'REQUIRES_PAYMENT',
    clientSecret: `mock_secret_${generateId('cs')}`,
    createdAt: new Date().toISOString()
  };
  mockPaymentIntents.push(intent);
  return intent;
}

function handleGetPaymentIntent(ctx: RouteContext): PaymentIntent {
  const intent = mockPaymentIntents.find((item) => item.id === ctx.params['id']);
  if (!intent) {
    throw new MockApiError(404, 'Intention de paiement introuvable.');
  }
  return intent;
}

function handleConfirmPaymentIntent(ctx: RouteContext): PaymentIntent {
  const intent = mockPaymentIntents.find((item) => item.id === ctx.params['id']);
  if (!intent) {
    throw new MockApiError(404, 'Intention de paiement introuvable.');
  }
  intent.status = 'SUCCEEDED';
  const registration = findRegistrationById(intent.registrationId);
  if (registration && registration.status === 'PENDING') {
    registration.status = 'CONFIRMED';
    registration.updatedAt = new Date().toISOString();
    createTicketsForRegistration(registration);
  }
  return intent;
}

/* -------------------------------------------------------------------------- */
/* REFUNDS                                                                    */
/* -------------------------------------------------------------------------- */

function handleCreateRefund(ctx: RouteContext): RefundRequest {
  const user = requireRole(ctx.currentUser, ['ORGANIZER']);
  const payload = ctx.body as CreateRefundRequest;
  const registration = findRegistrationById(payload.registrationId);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  const event = findEventById(registration.eventId);
  if (!event || event.organizerId !== user.id) {
    throw new MockApiError(403, 'Accès refusé à cet événement.');
  }
  const refund: RefundRequest = {
    id: generateId('rfd'),
    registrationId: registration.id,
    participantFirstName: registration.participantFirstName,
    participantLastName: registration.participantLastName,
    participantEmail: registration.participantEmail,
    eventId: registration.eventId,
    amount: registration.totalPrice,
    currency: registration.currency,
    reason: payload.reason,
    status: 'REQUESTED',
    requestedAt: new Date().toISOString()
  };
  mockRefunds.push(refund);
  return refund;
}

function handleSearchRefunds(ctx: RouteContext): PageResponse<RefundRequest> {
  const user = requireRole(ctx.currentUser, ['ORGANIZER']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const status = ctx.query.get('status') as RefundStatus | null;
  const eventId = ctx.query.get('eventId');

  const organizerEventIds = new Set(
    mockEvents.filter((event) => event.organizerId === user.id).map((event) => event.id)
  );
  let results = mockRefunds.filter((refund) => organizerEventIds.has(refund.eventId));
  if (status) {
    results = results.filter((refund) => refund.status === status);
  }
  if (eventId) {
    results = results.filter((refund) => refund.eventId === eventId);
  }
  results.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return paginate(results, page, size);
}

function handleApproveRefund(ctx: RouteContext): RefundRequest {
  const user = requireRole(ctx.currentUser, ['ORGANIZER']);
  const refund = findRefundById(ctx.params['id']);
  if (!refund) {
    throw new MockApiError(404, 'Demande de remboursement introuvable.');
  }
  const event = findEventById(refund.eventId);
  if (!event || event.organizerId !== user.id) {
    throw new MockApiError(403, 'Accès refusé à cet événement.');
  }
  refund.status = 'APPROVED';
  refund.processedAt = new Date().toISOString();
  refund.adminNote = (ctx.body as { adminNote?: string } | null)?.adminNote;
  const registration = findRegistrationById(refund.registrationId);
  if (registration) {
    registration.status = 'REFUNDED';
    registration.updatedAt = new Date().toISOString();
  }
  return refund;
}

function handleRejectRefund(ctx: RouteContext): RefundRequest {
  const user = requireRole(ctx.currentUser, ['ORGANIZER']);
  const refund = findRefundById(ctx.params['id']);
  if (!refund) {
    throw new MockApiError(404, 'Demande de remboursement introuvable.');
  }
  const event = findEventById(refund.eventId);
  if (!event || event.organizerId !== user.id) {
    throw new MockApiError(403, 'Accès refusé à cet événement.');
  }
  refund.status = 'REJECTED';
  refund.processedAt = new Date().toISOString();
  refund.adminNote = (ctx.body as { adminNote?: string } | null)?.adminNote;
  return refund;
}

/* -------------------------------------------------------------------------- */
/* ADMIN                                                                      */
/* -------------------------------------------------------------------------- */

function handleGetAuditLogs(ctx: RouteContext): PageResponse<AuditLogEntry> {
  requireRole(ctx.currentUser, ['ADMIN']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const actorUserId = ctx.query.get('actorUserId') as AuditLogSearchParams['actorUserId'];
  const targetType = ctx.query.get('targetType') as AuditLogSearchParams['targetType'];
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');

  let results = [...mockAuditLogs];
  if (actorUserId) {
    results = results.filter((entry) => entry.actorUserId === actorUserId);
  }
  if (targetType) {
    results = results.filter((entry) => entry.targetType === targetType);
  }
  if (from) {
    results = results.filter((entry) => entry.createdAt >= from);
  }
  if (to) {
    results = results.filter((entry) => entry.createdAt <= to);
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(results, page, size);
}

function handleImpersonate(ctx: RouteContext): { accessToken: string } {
  requireRole(ctx.currentUser, ['ADMIN']);
  const target = findUserById(ctx.params['userId']);
  if (!target) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  return { accessToken: `mock-access-${target.id}-${Date.now()}` };
}

function handleSuspendUser(ctx: RouteContext): User {
  const admin = requireRole(ctx.currentUser, ['ADMIN']);
  const target = findUserById(ctx.params['userId']);
  if (!target) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  target.status = 'SUSPENDED';
  revokeAllRefreshTokensForUser(target.id);
  mockAuditLogs.unshift({
    id: generateId('audit'),
    actorUserId: admin.id,
    actorName: `${admin.firstName} ${admin.lastName}`,
    action: 'USER_SUSPENDED',
    targetType: 'User',
    targetId: target.id,
    metadata: { reason: (ctx.body as { reason?: string } | null)?.reason },
    createdAt: new Date().toISOString()
  });
  return target;
}

function handleReactivateUser(ctx: RouteContext): User {
  const admin = requireRole(ctx.currentUser, ['ADMIN']);
  const target = findUserById(ctx.params['userId']);
  if (!target) {
    throw new MockApiError(404, 'Utilisateur introuvable.');
  }
  target.status = 'ACTIVE';
  mockAuditLogs.unshift({
    id: generateId('audit'),
    actorUserId: admin.id,
    actorName: `${admin.firstName} ${admin.lastName}`,
    action: 'USER_REACTIVATED',
    targetType: 'User',
    targetId: target.id,
    createdAt: new Date().toISOString()
  });
  return target;
}

/* -------------------------------------------------------------------------- */
/* STATS                                                                      */
/* -------------------------------------------------------------------------- */

function handleOrganizerStats(ctx: RouteContext): OrganizerStats {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  return computeOrganizerStats(ctx.params['organizerId']);
}

function handleAdminStats(ctx: RouteContext): AdminStats {
  requireRole(ctx.currentUser, ['ADMIN']);
  return computeAdminStats();
}

function handleEventStats(ctx: RouteContext): OrganizerStats {
  const event = findEventById(ctx.params['eventId']);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
  }
  requireEventOwnerOrAdmin(ctx.currentUser, event);
  return computeEventStats(event.id);
}

/* -------------------------------------------------------------------------- */
/* Route table                                                                */
/* -------------------------------------------------------------------------- */

const routes: MockRoute[] = [
  // AUTH
  { method: 'POST', pattern: '/auth/login', handler: handleLogin },
  { method: 'POST', pattern: '/auth/register', status: 201, handler: handleRegister },
  { method: 'POST', pattern: '/auth/google', handler: handleGoogleAuth },
  { method: 'POST', pattern: '/auth/2fa/verify', handler: handleTotpVerify },
  { method: 'POST', pattern: '/auth/2fa/setup', handler: handleTotpSetup },
  { method: 'POST', pattern: '/auth/2fa/enable', handler: handleTotpEnable },
  { method: 'POST', pattern: '/auth/2fa/disable', handler: handleTotpDisable },
  { method: 'GET', pattern: '/auth/2fa/status', handler: handleTotpStatus },
  { method: 'POST', pattern: '/auth/logout', handler: handleLogout },
  { method: 'GET', pattern: '/auth/me', handler: handleMe },
  { method: 'POST', pattern: '/auth/refresh', handler: handleRefresh },
  { method: 'POST', pattern: '/auth/forgot-password', handler: handleForgotPassword },
  { method: 'POST', pattern: '/auth/reset-password', handler: handleResetPassword },
  { method: 'POST', pattern: '/auth/change-password', handler: handleChangePassword },

  // USERS
  { method: 'GET', pattern: '/users', handler: handleSearchUsers },
  { method: 'GET', pattern: '/users/:id', handler: handleGetUser },
  { method: 'PATCH', pattern: '/users/:id', handler: handleUpdateProfile },
  { method: 'PATCH', pattern: '/users/:id/status', handler: handleUpdateUserStatus },
  { method: 'PATCH', pattern: '/users/:id/role', handler: handleUpdateUserRole },
  { method: 'DELETE', pattern: '/users/:id', handler: handleDeleteUser },

  // EVENTS
  { method: 'GET', pattern: '/events/slug/:slug', handler: handleGetEventBySlug },
  { method: 'GET', pattern: '/events/organizer/:organizerId', handler: handleEventsByOrganizer },
  { method: 'GET', pattern: '/events/:id/ticket-types', handler: handleGetTicketTypesByEvent },
  { method: 'POST', pattern: '/events/:id/ticket-types', status: 201, handler: handleCreateTicketType },
  { method: 'GET', pattern: '/events/:id/scan-stats', handler: handleEventScanStats },
  { method: 'POST', pattern: '/events/:id/send-tickets', handler: handleSendEventTickets },
  { method: 'POST', pattern: '/events/:id/duplicate', status: 201, handler: handleDuplicateEvent },
  { method: 'POST', pattern: '/events/:id/public-registration', handler: handleEnablePublicRegistration },
  { method: 'DELETE', pattern: '/events/:id/public-registration', handler: handleRevokePublicRegistration },
  { method: 'PATCH', pattern: '/events/:id/status', handler: handleUpdateEventStatus },
  { method: 'GET', pattern: '/events', handler: handleSearchEvents },
  { method: 'POST', pattern: '/events', status: 201, handler: handleCreateEvent },
  { method: 'GET', pattern: '/events/:id', handler: handleGetEvent },
  { method: 'PATCH', pattern: '/events/:id', handler: handleUpdateEvent },
  { method: 'DELETE', pattern: '/events/:id', handler: handleDeleteEvent },

  // CATEGORIES
  { method: 'GET', pattern: '/categories', handler: handleListCategories },
  { method: 'POST', pattern: '/categories', status: 201, handler: handleCreateCategory },
  { method: 'GET', pattern: '/categories/:id', handler: handleGetCategory },
  { method: 'PATCH', pattern: '/categories/:id', handler: handleUpdateCategory },
  { method: 'DELETE', pattern: '/categories/:id', handler: handleDeleteCategory },

  // VENUES
  { method: 'GET', pattern: '/venues', handler: handleListVenues },
  { method: 'POST', pattern: '/venues', status: 201, handler: handleCreateVenue },
  { method: 'GET', pattern: '/venues/:id', handler: handleGetVenue },
  { method: 'PATCH', pattern: '/venues/:id', handler: handleUpdateVenue },
  { method: 'DELETE', pattern: '/venues/:id', handler: handleDeleteVenue },

  // PUBLIC REGISTRATION
  { method: 'GET', pattern: '/public/registrations/:token', handler: handleGetPublicRegistrationInfo },
  { method: 'POST', pattern: '/public/registrations/:token', status: 201, handler: handlePublicRegister },

  // REGISTRATIONS
  { method: 'DELETE', pattern: '/registrations/:id', handler: handleDeleteRegistration },
  { method: 'PATCH', pattern: '/registrations/:id/cancel', handler: handleCancelRegistration },
  { method: 'PATCH', pattern: '/registrations/:id/check-in', handler: handleCheckInRegistration },
  { method: 'PATCH', pattern: '/registrations/:id/status', handler: handleUpdateRegistrationStatus },
  { method: 'PATCH', pattern: '/registrations/:id/ticket-type', handler: handleChangeRegistrationTicketType },
  { method: 'POST', pattern: '/registrations/:id/send-ticket', handler: handleSendRegistrationTicket },
  { method: 'GET', pattern: '/registrations', handler: handleSearchRegistrations },
  { method: 'POST', pattern: '/registrations', status: 201, handler: handleCreateRegistration },
  { method: 'GET', pattern: '/registrations/:id', handler: handleGetRegistration },

  // TICKETS
  { method: 'GET', pattern: '/tickets/info', handler: handleTicketInfo },
  { method: 'POST', pattern: '/tickets/validate', handler: handleValidateTicket },
  { method: 'PATCH', pattern: '/tickets/types/:id', handler: handleUpdateTicketType },
  { method: 'DELETE', pattern: '/tickets/types/:id', handler: handleDeleteTicketType },
  { method: 'GET', pattern: '/tickets/:id', handler: handleGetTicket },

  // PAYMENTS
  { method: 'POST', pattern: '/payments/intents', status: 201, handler: handleCreatePaymentIntent },
  { method: 'GET', pattern: '/payments/intents/:id', handler: handleGetPaymentIntent },
  { method: 'POST', pattern: '/payments/intents/:id/confirm', handler: handleConfirmPaymentIntent },

  // REFUNDS
  { method: 'PATCH', pattern: '/refunds/:id/approve', handler: handleApproveRefund },
  { method: 'PATCH', pattern: '/refunds/:id/reject', handler: handleRejectRefund },
  { method: 'GET', pattern: '/refunds', handler: handleSearchRefunds },
  { method: 'POST', pattern: '/refunds', status: 201, handler: handleCreateRefund },

  // ADMIN
  { method: 'GET', pattern: '/admin/audit-logs', handler: handleGetAuditLogs },
  { method: 'POST', pattern: '/admin/impersonate/:userId', handler: handleImpersonate },
  { method: 'PATCH', pattern: '/admin/users/:userId/suspend', handler: handleSuspendUser },
  { method: 'PATCH', pattern: '/admin/users/:userId/reactivate', handler: handleReactivateUser },

  // STATS
  { method: 'GET', pattern: '/stats/organizer/:organizerId', handler: handleOrganizerStats },
  { method: 'GET', pattern: '/stats/admin', handler: handleAdminStats },
  { method: 'GET', pattern: '/stats/events/:eventId', handler: handleEventStats }
];

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                 */
/* -------------------------------------------------------------------------- */

function resolveMockResponse(req: HttpRequest<unknown>): { status: number; body: unknown } {
  const path = getPath(req);

  for (const route of routes) {
    if (route.method !== req.method) {
      continue;
    }
    const params = matchRoute(route.pattern, path);
    if (!params) {
      continue;
    }
    const ctx: RouteContext = {
      req,
      params,
      query: req.params,
      body: req.body,
      currentUser: getCurrentUser(req)
    };
    const body = route.handler(ctx);
    return { status: route.status ?? 200, body };
  }

  throw new MockApiError(404, `Route mock introuvable : ${req.method} ${path}`, 'MOCK_ROUTE_NOT_FOUND');
}

/* -------------------------------------------------------------------------- */
/* Interceptor                                                                */
/* -------------------------------------------------------------------------- */

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMocks) {
    return next(req);
  }
  if (!req.url.includes(environment.apiUrl)) {
    return next(req);
  }

  // No artificial delay — mocks must feel instant for demo UX.
  return (of(null) as Observable<null>).pipe(
    map(() => {
      const { status, body } = resolveMockResponse(req);
      return new HttpResponse<unknown>({ status, body, url: req.urlWithParams });
    }),
    catchError((error: unknown) => {
      if (error instanceof MockApiError) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: error.status,
              statusText: error.message,
              url: req.urlWithParams,
              error: {
                status: error.status,
                message: error.message,
                code: error.code,
                timestamp: new Date().toISOString()
              }
            })
        );
      }
      console.error('[mock.interceptor] Unexpected error while handling request', req.method, req.url, error);
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Internal Mock Error',
            url: req.urlWithParams,
            error: {
              status: 500,
              message: 'Erreur interne inattendue.',
              code: 'MOCK_INTERNAL_ERROR',
              timestamp: new Date().toISOString()
            }
          })
      );
    })
  );
};
