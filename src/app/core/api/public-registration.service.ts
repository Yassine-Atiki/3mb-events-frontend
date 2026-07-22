import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Registration, TicketType } from '../models';

export interface PublicRegistrationInfo {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  shortDescription: string;
  startAt: string;
  endAt: string;
  city: string;
  isFree: boolean;
  ticketTypes: TicketType[];
}

export interface PublicCreateRegistrationPayload {
  participantFirstName: string;
  participantLastName: string;
  participantEmail: string;
  participantPhone?: string;
  ticketTypeId?: string;
  /** Always 1 — one participant = one registration. */
  quantity?: 1;
}

/** Registration create result — checkoutUrl present when payment is required. */
export interface PublicRegistrationResult extends Registration {
  checkoutUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PublicRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/public/registrations`;

  getInfo(token: string): Observable<PublicRegistrationInfo> {
    return this.http.get<PublicRegistrationInfo>(`${this.baseUrl}/${token}`);
  }

  register(token: string, payload: PublicCreateRegistrationPayload): Observable<PublicRegistrationResult> {
    return this.http.post<PublicRegistrationResult>(`${this.baseUrl}/${token}`, payload);
  }

  confirmCheckout(token: string, sessionId: string): Observable<Registration> {
    return this.http.get<Registration>(`${this.baseUrl}/${token}/checkout/confirm`, {
      params: { session_id: sessionId }
    });
  }
}
