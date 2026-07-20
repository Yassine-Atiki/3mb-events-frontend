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
  quantity?: number;
}

@Injectable({ providedIn: 'root' })
export class PublicRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/public/registrations`;

  getInfo(token: string): Observable<PublicRegistrationInfo> {
    return this.http.get<PublicRegistrationInfo>(`${this.baseUrl}/${token}`);
  }

  register(token: string, payload: PublicCreateRegistrationPayload): Observable<Registration> {
    return this.http.post<Registration>(`${this.baseUrl}/${token}`, payload);
  }
}
