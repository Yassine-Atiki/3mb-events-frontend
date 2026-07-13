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
import { AuthResponse, LoginRequest, RefreshTokenRequest, RegisterRequest } from '../api/auth.service';
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
  mockRegistrations,
  mockTicketTypes,
  mockTickets,
  mockUsers,
  mockVenues,
  DEFAULT_COVER_IMAGE
} from './mock-data';

const ACCESS_TOKEN_STORAGE_KEY = '3mb_access_token';

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
  const match = /^mock-(?:access|refresh)-(.+)-\d+$/.exec(token);
  return match ? match[1] : null;
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

function buildAuthResponse(user: User): AuthResponse {
  return {
    user,
    accessToken: `mock-access-${user.id}-${Date.now()}`,
    refreshToken: `mock-refresh-${user.id}-${Date.now()}`
  };
}

/* -------------------------------------------------------------------------- */
/* AUTH                                                                       */
/* -------------------------------------------------------------------------- */

function handleLogin(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as LoginRequest;
  const credential = findCredentialByEmail(payload.email ?? '');
  const user = credential ? findUserById(credential.userId) : undefined;
  if (!credential || !user || credential.password !== payload.password) {
    throw new MockApiError(401, 'Email ou mot de passe incorrect.', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') {
    throw new MockApiError(403, 'Ce compte est désactivé.', 'ACCOUNT_DISABLED');
  }
  user.lastLoginAt = new Date().toISOString();
  return buildAuthResponse(user);
}

function handleRegister(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as RegisterRequest;
  if (!payload.email || !payload.password || !payload.firstName || !payload.lastName) {
    throw new MockApiError(400, 'Champs obligatoires manquants.', 'VALIDATION_ERROR');
  }
  if (findUserByEmail(payload.email)) {
    throw new MockApiError(409, 'Un compte existe déjà avec cet email.', 'EMAIL_TAKEN');
  }
  const now = new Date().toISOString();
  const user: User = {
    id: generateId('usr'),
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role ?? 'PARTICIPANT',
    status: 'ACTIVE',
    organization: payload.organization,
    phone: payload.phone,
    createdAt: now,
    lastLoginAt: now
  };
  mockUsers.push(user);
  return buildAuthResponse(user);
}

function handleLogout(): null {
  return null;
}

function handleMe(ctx: RouteContext): User {
  return requireAuth(ctx.currentUser);
}

function handleRefresh(ctx: RouteContext): AuthResponse {
  const payload = ctx.body as RefreshTokenRequest;
  const userId = getUserIdFromToken(payload.refreshToken);
  const user = userId ? findUserById(userId) : undefined;
  if (!user) {
    throw new MockApiError(401, 'Refresh token invalide.', 'INVALID_REFRESH_TOKEN');
  }
  return buildAuthResponse(user);
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
  Object.assign(user, payload);
  if (payload.avatarUrl === '') {
    delete user.avatarUrl;
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
    status: 'BROUILLON',
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
  requireRole(ctx.currentUser, ['ADMIN']);
  const payload = ctx.body as CreateCategoryRequest;
  const category: Category = { ...payload, id: generateId('cat'), eventCount: 0 };
  mockCategories.push(category);
  return category;
}

function handleUpdateCategory(ctx: RouteContext): Category {
  requireRole(ctx.currentUser, ['ADMIN']);
  const category = findCategoryById(ctx.params['id']);
  if (!category) {
    throw new MockApiError(404, 'Catégorie introuvable.');
  }
  Object.assign(category, ctx.body as UpdateCategoryRequest);
  return category;
}

function handleDeleteCategory(ctx: RouteContext): null {
  requireRole(ctx.currentUser, ['ADMIN']);
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
  requireRole(ctx.currentUser, ['ADMIN']);
  const index = mockVenues.findIndex((venue) => venue.id === ctx.params['id']);
  if (index === -1) {
    throw new MockApiError(404, 'Lieu introuvable.');
  }
  mockVenues.splice(index, 1);
  return null;
}

/* -------------------------------------------------------------------------- */
/* REGISTRATIONS                                                              */
/* -------------------------------------------------------------------------- */

function handleSearchRegistrations(ctx: RouteContext): PageResponse<Registration> {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const eventId = ctx.query.get('eventId');
  const userId = ctx.query.get('userId');
  const status = ctx.query.get('status') as RegistrationStatus | null;

  let results = [...mockRegistrations];
  if (eventId) {
    results = results.filter((registration) => registration.eventId === eventId);
  }
  if (userId) {
    results = results.filter((registration) => registration.userId === userId);
  }
  if (status) {
    results = results.filter((registration) => registration.status === status);
  }
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(results, page, size);
}

function handleGetRegistration(ctx: RouteContext): Registration {
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  const user = requireAuth(ctx.currentUser);
  if (user.role === 'PARTICIPANT' && registration.userId !== user.id) {
    throw new MockApiError(403, 'Accès refusé.');
  }
  return registration;
}

function handleGetMyRegistrations(ctx: RouteContext): Registration[] {
  const user = requireAuth(ctx.currentUser);
  return mockRegistrations
    .filter((registration) => registration.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function handleCreateRegistration(ctx: RouteContext): Registration {
  const user = requireAuth(ctx.currentUser);
  const payload = ctx.body as CreateRegistrationRequest;
  const event = findEventById(payload.eventId);
  if (!event) {
    throw new MockApiError(404, 'Événement introuvable.');
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
    userId: user.id,
    ticketTypeId: ticketType.id,
    status: event.isFree ? 'CONFIRMED' : 'PENDING',
    quantity: payload.quantity,
    totalPrice: ticketType.price * payload.quantity,
    currency: ticketType.currency,
    createdAt: now,
    updatedAt: now
  };
  mockRegistrations.push(registration);
  ticketType.quantitySold += payload.quantity;
  if (registration.status === 'CONFIRMED') {
    createTicketsForRegistration(registration);
  }
  return registration;
}

function handleCancelRegistration(ctx: RouteContext): Registration {
  const user = requireAuth(ctx.currentUser);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  if (user.role === 'PARTICIPANT' && registration.userId !== user.id) {
    throw new MockApiError(403, 'Accès refusé.');
  }
  registration.status = 'CANCELLED';
  registration.updatedAt = new Date().toISOString();
  mockTickets
    .filter((ticket) => ticket.registrationId === registration.id)
    .forEach((ticket) => {
      ticket.status = 'CANCELLED';
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

function handleUpdateRegistrationStatus(ctx: RouteContext): Registration {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const registration = findRegistrationById(ctx.params['id']);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  registration.status = (ctx.body as { status: RegistrationStatus }).status;
  registration.updatedAt = new Date().toISOString();
  return registration;
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

function handleGetMyTickets(ctx: RouteContext): Ticket[] {
  const user = requireAuth(ctx.currentUser);
  return mockTickets
    .filter((ticket) => ticket.ownerUserId === user.id)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

function handleGetTicket(ctx: RouteContext): Ticket {
  const ticket = findTicketById(ctx.params['id']);
  if (!ticket) {
    throw new MockApiError(404, 'Billet introuvable.');
  }
  const user = requireAuth(ctx.currentUser);
  if (user.role === 'PARTICIPANT' && ticket.ownerUserId !== user.id) {
    throw new MockApiError(403, 'Accès refusé.');
  }
  return ticket;
}

function handleValidateTicket(ctx: RouteContext): Ticket {
  requireRole(ctx.currentUser, ['ORGANIZER', 'ADMIN']);
  const payload = ctx.body as { qrCode: string };
  const ticket = findTicketByQrCode(payload.qrCode);
  if (!ticket) {
    throw new MockApiError(404, 'Billet invalide ou introuvable.', 'INVALID_TICKET');
  }
  if (ticket.status === 'USED') {
    throw new MockApiError(409, 'Ce billet a déjà été scanné.', 'ALREADY_SCANNED');
  }
  if (ticket.status !== 'VALID') {
    throw new MockApiError(400, `Ce billet n'est pas valide (statut : ${ticket.status}).`, 'INVALID_TICKET');
  }
  ticket.status = 'USED';
  ticket.usedAt = new Date().toISOString();
  return ticket;
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
  const user = requireAuth(ctx.currentUser);
  const payload = ctx.body as CreateRefundRequest;
  const registration = findRegistrationById(payload.registrationId);
  if (!registration) {
    throw new MockApiError(404, 'Inscription introuvable.');
  }
  if (registration.userId !== user.id) {
    throw new MockApiError(403, 'Accès refusé.');
  }
  const refund: RefundRequest = {
    id: generateId('rfd'),
    registrationId: registration.id,
    userId: user.id,
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

function handleGetMyRefunds(ctx: RouteContext): RefundRequest[] {
  const user = requireAuth(ctx.currentUser);
  return mockRefunds
    .filter((refund) => refund.userId === user.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

function handleSearchRefunds(ctx: RouteContext): PageResponse<RefundRequest> {
  const user = requireRole(ctx.currentUser, ['ADMIN', 'ORGANIZER']);
  const page = queryNumber(ctx.query, 'page', 0);
  const size = queryNumber(ctx.query, 'size', 20);
  const status = ctx.query.get('status') as RefundStatus | null;
  const eventId = ctx.query.get('eventId');

  let results = [...mockRefunds];
  if (user.role === 'ORGANIZER') {
    const organizerEventIds = new Set(
      mockEvents.filter((event) => event.organizerId === user.id).map((event) => event.id)
    );
    results = results.filter((refund) => organizerEventIds.has(refund.eventId));
  }
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
  requireRole(ctx.currentUser, ['ADMIN']);
  const refund = findRefundById(ctx.params['id']);
  if (!refund) {
    throw new MockApiError(404, 'Demande de remboursement introuvable.');
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
  requireRole(ctx.currentUser, ['ADMIN']);
  const refund = findRefundById(ctx.params['id']);
  if (!refund) {
    throw new MockApiError(404, 'Demande de remboursement introuvable.');
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
  { method: 'POST', pattern: '/events/:id/duplicate', status: 201, handler: handleDuplicateEvent },
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

  // REGISTRATIONS
  { method: 'GET', pattern: '/registrations/me', handler: handleGetMyRegistrations },
  { method: 'PATCH', pattern: '/registrations/:id/cancel', handler: handleCancelRegistration },
  { method: 'PATCH', pattern: '/registrations/:id/check-in', handler: handleCheckInRegistration },
  { method: 'PATCH', pattern: '/registrations/:id/status', handler: handleUpdateRegistrationStatus },
  { method: 'GET', pattern: '/registrations', handler: handleSearchRegistrations },
  { method: 'POST', pattern: '/registrations', status: 201, handler: handleCreateRegistration },
  { method: 'GET', pattern: '/registrations/:id', handler: handleGetRegistration },

  // TICKETS
  { method: 'GET', pattern: '/tickets/me', handler: handleGetMyTickets },
  { method: 'POST', pattern: '/tickets/validate', handler: handleValidateTicket },
  { method: 'PATCH', pattern: '/tickets/types/:id', handler: handleUpdateTicketType },
  { method: 'DELETE', pattern: '/tickets/types/:id', handler: handleDeleteTicketType },
  { method: 'GET', pattern: '/tickets/:id', handler: handleGetTicket },

  // PAYMENTS
  { method: 'POST', pattern: '/payments/intents', status: 201, handler: handleCreatePaymentIntent },
  { method: 'GET', pattern: '/payments/intents/:id', handler: handleGetPaymentIntent },
  { method: 'POST', pattern: '/payments/intents/:id/confirm', handler: handleConfirmPaymentIntent },

  // REFUNDS
  { method: 'GET', pattern: '/refunds/me', handler: handleGetMyRefunds },
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
