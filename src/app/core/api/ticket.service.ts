import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Ticket, TicketType } from '../models';

export type CreateTicketTypeRequest = Omit<TicketType, 'id' | 'quantitySold'>;
export type UpdateTicketTypeRequest = Partial<CreateTicketTypeRequest>;

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  getTicketTypesByEvent(eventId: string): Observable<TicketType[]> {
    return this.http.get<TicketType[]>(`${environment.apiUrl}/events/${eventId}/ticket-types`);
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

  getMyTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.baseUrl}/me`);
  }

  getById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  validateByQrCode(qrCode: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.baseUrl}/validate`, { qrCode });
  }
}
