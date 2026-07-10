import { Component, computed, input } from '@angular/core';
import { BadgeComponent, BadgeTone } from '../badge/badge.component';

export type EventStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
export type RegistrationStatus =
  | 'pending'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'checked-in';
export type TicketStatus = 'valid' | 'used' | 'expired' | 'cancelled' | 'refunded';

export type StatusBadgeStatus = EventStatus | RegistrationStatus | TicketStatus;

interface StatusConfig {
  label: string;
  tone: BadgeTone;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  draft: { label: 'Brouillon', tone: 'gray' },
  published: { label: 'Publié', tone: 'teal' },
  ongoing: { label: 'En cours', tone: 'blue' },
  completed: { label: 'Terminé', tone: 'green' },
  cancelled: { label: 'Annulé', tone: 'red' },
  pending: { label: 'En attente', tone: 'amber' },
  confirmed: { label: 'Confirmé', tone: 'teal' },
  waitlisted: { label: "Liste d'attente", tone: 'amber' },
  'checked-in': { label: 'Enregistré', tone: 'green' },
  valid: { label: 'Valide', tone: 'teal' },
  used: { label: 'Utilisé', tone: 'gray' },
  expired: { label: 'Expiré', tone: 'red' },
  refunded: { label: 'Remboursé', tone: 'blue' },

  // Real API enum values (uppercase) used across event/registration/ticket/refund models.
  BROUILLON: { label: 'Brouillon', tone: 'gray' },
  EN_REVISION: { label: 'En révision', tone: 'amber' },
  PUBLIE: { label: 'Publié', tone: 'teal' },
  COMPLET: { label: 'Complet', tone: 'blue' },
  ANNULE: { label: 'Annulé', tone: 'red' },
  ARCHIVE: { label: 'Archivé', tone: 'gray' },
  PENDING: { label: 'En attente', tone: 'amber' },
  CONFIRMED: { label: 'Confirmé', tone: 'teal' },
  WAITLIST: { label: "Liste d'attente", tone: 'amber' },
  CANCELLED: { label: 'Annulé', tone: 'red' },
  ATTENDED: { label: 'Présent', tone: 'green' },
  REFUNDED: { label: 'Remboursé', tone: 'blue' },
  VALID: { label: 'Valide', tone: 'teal' },
  USED: { label: 'Utilisé', tone: 'gray' },
  EXPIRED: { label: 'Expiré', tone: 'red' },
  REQUESTED: { label: 'Demandé', tone: 'amber' },
  APPROVED: { label: 'Approuvé', tone: 'teal' },
  REJECTED: { label: 'Rejeté', tone: 'red' },
  PROCESSED: { label: 'Traité', tone: 'green' }
};

@Component({
  selector: 'app-ui-status-badge',
  standalone: true,
  imports: [BadgeComponent],
  templateUrl: './status-badge.component.html'
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusBadgeStatus | string>();

  protected readonly config = computed<StatusConfig>(() => {
    const key = this.status();
    return STATUS_MAP[key] ?? { label: this.humanize(key), tone: 'gray' };
  });

  private humanize(value: string): string {
    if (!value) return '';
    const spaced = value.replace(/[-_]/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
}
