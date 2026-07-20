import { BadgeTone } from '../ui/badge/badge.component';
import { RefundStatus, RegistrationStatus, TicketStatus } from '../../core/models';

export interface StatusBadgeConfig {
  label: string;
  tone: BadgeTone;
}

const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, StatusBadgeConfig> = {
  PENDING: { label: 'En attente', tone: 'amber' },
  CONFIRMED: { label: 'Confirmée', tone: 'teal' },
  WAITLIST: { label: "Liste d'attente", tone: 'amber' },
  CANCELLED: { label: 'Annulée', tone: 'gray' },
  ATTENDED: { label: 'Présent', tone: 'green' },
  REFUNDED: { label: 'Remboursée', tone: 'blue' }
};

const TICKET_STATUS_CONFIG: Record<TicketStatus, StatusBadgeConfig> = {
  VALID: { label: 'Valide', tone: 'teal' },
  USED: { label: 'Utilisé', tone: 'gray' },
  CANCELLED: { label: 'Annulé', tone: 'gray' },
  EXPIRED: { label: 'Expiré', tone: 'red' },
  REFUNDED: { label: 'Remboursé', tone: 'blue' }
};

const REFUND_STATUS_CONFIG: Record<RefundStatus, StatusBadgeConfig> = {
  REQUESTED: { label: 'En cours de traitement', tone: 'amber' },
  APPROVED: { label: 'Approuvée', tone: 'teal' },
  REJECTED: { label: 'Rejetée', tone: 'red' },
  PROCESSED: { label: 'Remboursée', tone: 'green' }
};

export function registrationStatusBadge(status: RegistrationStatus): StatusBadgeConfig {
  return REGISTRATION_STATUS_CONFIG[status];
}

export function ticketStatusBadge(status: TicketStatus): StatusBadgeConfig {
  return TICKET_STATUS_CONFIG[status];
}

export function refundStatusBadge(status: RefundStatus): StatusBadgeConfig {
  return REFUND_STATUS_CONFIG[status];
}
