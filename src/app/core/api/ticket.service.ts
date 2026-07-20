import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EventScanStats, Ticket, TicketType } from '../models';

export type CreateTicketTypeRequest = Omit<TicketType, 'id' | 'quantitySold'>;
export type UpdateTicketTypeRequest = Partial<CreateTicketTypeRequest>;

export type TicketInfoMode = 'PARTICIPANT_VIEW' | 'ORGANIZER_VIEW';

export interface TicketInfo {
  mode: TicketInfoMode;
  eventId: string;
  eventTitle: string;
  city?: string;
  ticketId: string;
  participantFirstName: string;
  participantLastName: string;
  participantEmail?: string;
  ticketTypeName?: string;
  status: Ticket['status'];
  issuedAt: string;
  usedAt?: string | null;
  eventStartAt?: string;
  eventEndAt?: string;
  canValidate: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  getTicketTypesByEvent(eventId: string): Observable<TicketType[]> {
    return this.http.get<TicketType[]>(`${environment.apiUrl}/events/${eventId}/ticket-types`);
  }

  getScanStats(eventId: string): Observable<EventScanStats> {
    return this.http.get<EventScanStats>(`${environment.apiUrl}/events/${eventId}/scan-stats`);
  }

  /** Read-only ticket info (public). Does not mark the ticket as used. Requires eventId. */
  getInfo(qrCode: string, eventId: string): Observable<TicketInfo> {
    const params = new HttpParams().set('qrCode', qrCode).set('eventId', eventId);
    return this.http.get<TicketInfo>(`${this.baseUrl}/info`, { params });
  }

  createTicketType(eventId: string, payload: CreateTicketTypeRequest): Observable<TicketType> {
    return this.http.post<TicketType>(
      `${environment.apiUrl}/events/${eventId}/ticket-types`,
      payload
    );
  }

  updateTicketType(id: string, payload: UpdateTicketTypeRequest): Observable<TicketType> {
    return this.http.patch<TicketType>(`${this.baseUrl}/types/${id}`, payload);
  }

  deleteTicketType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/types/${id}`);
  }

  getById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  /** Organizer door validation — requires the scan context eventId. */
  validateByQrCode(qrCode: string, eventId: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.baseUrl}/validate`, { qrCode, eventId });
  }
}
