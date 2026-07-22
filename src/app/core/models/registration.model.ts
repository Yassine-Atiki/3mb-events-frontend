export type RegistrationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'WAITLIST'
  | 'CANCELLED'
  | 'ATTENDED'
  | 'REFUNDED';

/** PUBLIC = sold via link; MANUAL/IMPORT = organizer-added (not a sale). */
export type RegistrationSource = 'PUBLIC' | 'MANUAL' | 'IMPORT';

export interface Registration {
  id: string;
  eventId: string;
  ticketTypeId: string;
  status: RegistrationStatus;
  source?: RegistrationSource;
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
