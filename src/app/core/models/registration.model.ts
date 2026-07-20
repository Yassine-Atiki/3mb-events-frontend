export type RegistrationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'WAITLIST'
  | 'CANCELLED'
  | 'ATTENDED'
  | 'REFUNDED';

export interface Registration {
  id: string;
  eventId: string;
  ticketTypeId: string;
  status: RegistrationStatus;
  quantity: number;
  totalPrice: number;
  currency: string;
  participantFirstName: string;
  participantLastName: string;
  participantEmail: string;
  participantPhone?: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
}
