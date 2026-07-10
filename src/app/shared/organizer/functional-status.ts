export type FunctionalStatusTone = 'confirmed' | 'pending' | 'cancelled' | 'draft';

export const FUNCTIONAL_STATUS_COLORS: Record<FunctionalStatusTone, string> = {
  confirmed: '#2B8A72',
  pending: '#C99A3E',
  cancelled: '#B4553F',
  draft: '#8A93A6'
};

export interface FunctionalStatusConfig {
  label: string;
  tone: FunctionalStatusTone;
}

const EVENT_STATUS_MAP: Record<string, FunctionalStatusConfig> = {
  BROUILLON: { label: 'Brouillon', tone: 'draft' },
  EN_REVISION: { label: 'En révision', tone: 'pending' },
  PUBLIE: { label: 'Publié', tone: 'confirmed' },
  COMPLET: { label: 'Complet', tone: 'confirmed' },
  ANNULE: { label: 'Annulé', tone: 'cancelled' },
  ARCHIVE: { label: 'Archivé', tone: 'draft' }
};

const REGISTRATION_STATUS_MAP: Record<string, FunctionalStatusConfig> = {
  PENDING: { label: 'En attente', tone: 'pending' },
  CONFIRMED: { label: 'Confirmé', tone: 'confirmed' },
  WAITLIST: { label: "Liste d'attente", tone: 'pending' },
  CANCELLED: { label: 'Annulé', tone: 'cancelled' },
  ATTENDED: { label: 'Présent', tone: 'confirmed' },
  REFUNDED: { label: 'Remboursé', tone: 'draft' }
};

const REFUND_STATUS_MAP: Record<string, FunctionalStatusConfig> = {
  REQUESTED: { label: 'En cours de traitement', tone: 'pending' },
  APPROVED: { label: 'Approuvée', tone: 'confirmed' },
  REJECTED: { label: 'Rejetée', tone: 'cancelled' },
  PROCESSED: { label: 'Remboursée', tone: 'confirmed' }
};

export function eventFunctionalStatus(status: string): FunctionalStatusConfig {
  return EVENT_STATUS_MAP[status] ?? { label: status, tone: 'draft' };
}

export function registrationFunctionalStatus(status: string): FunctionalStatusConfig {
  return REGISTRATION_STATUS_MAP[status] ?? { label: status, tone: 'draft' };
}

export function refundFunctionalStatus(status: string): FunctionalStatusConfig {
  return REFUND_STATUS_MAP[status] ?? { label: status, tone: 'draft' };
}

export function statusColor(tone: FunctionalStatusTone): string {
  return FUNCTIONAL_STATUS_COLORS[tone];
}
