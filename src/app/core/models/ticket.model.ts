export type TicketTypeKind = 'STANDARD' | 'VIP' | 'GRATUIT' | 'EARLY_BIRD' | 'GROUPE';

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  kind: TicketTypeKind;
  price: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  saleStartAt?: string;
  saleEndAt?: string;
  maxPerOrder?: number;
  description?: string;
}

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

export interface Ticket {
  id: string;
  ticketTypeId: string;
  registrationId: string;
  eventId: string;
  accessToken: string;
  participantFirstName: string;
  participantLastName: string;
  participantEmail: string;
  status: TicketStatus;
  qrCode: string;
  /** Deep-link encoded into QR images for participant read-only view. */
  publicQrUrl?: string;
  seatLabel?: string;
  issuedAt: string;
  usedAt?: string;
}

export interface EventScanStats {
  eventId: string;
  scanned: number;
  issued: number;
  capacity: number;
}
