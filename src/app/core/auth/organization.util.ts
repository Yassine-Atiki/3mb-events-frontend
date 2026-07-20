import { User } from '../models';

/**
 * Organizers must finish organization setup before accessing the app.
 */
export function needsOrganizationSetup(user: User | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'ORGANIZER') {
    return !(user.organizationId || user.organization?.trim());
  }
  return false;
}

/** @deprecated Use needsOrganizationSetup */
export function organizerNeedsOrganization(user: User | null | undefined): boolean {
  return needsOrganizationSetup(user);
}
