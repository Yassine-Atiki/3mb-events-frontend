export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSED';

export interface RefundRequest {
  id: string;
  registrationId: string;
  userId: string;
  eventId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedAt?: string;
  adminNote?: string;
}
