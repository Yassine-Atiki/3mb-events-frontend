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
  userId: string;
  ticketTypeId: string;
  status: RegistrationStatus;
  quantity: number;
  totalPrice: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
}
