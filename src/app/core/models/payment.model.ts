export type PaymentIntentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface PaymentIntent {
  id: string;
  registrationId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  clientSecret?: string;
  createdAt: string;
}
