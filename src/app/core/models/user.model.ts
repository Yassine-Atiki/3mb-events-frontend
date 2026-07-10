export type UserRole = 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  organization?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}
