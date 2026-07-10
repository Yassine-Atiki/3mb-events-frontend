import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PaymentIntent } from '../models';

export interface CreatePaymentIntentRequest {
  registrationId: string;
  amount: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/payments`;

  createIntent(payload: CreatePaymentIntentRequest): Observable<PaymentIntent> {
    return this.http.post<PaymentIntent>(`${this.baseUrl}/intents`, payload);
  }

  getIntent(id: string): Observable<PaymentIntent> {
    return this.http.get<PaymentIntent>(`${this.baseUrl}/intents/${id}`);
  }

  confirm(id: string): Observable<PaymentIntent> {
    return this.http.post<PaymentIntent>(`${this.baseUrl}/intents/${id}/confirm`, {});
  }
}
