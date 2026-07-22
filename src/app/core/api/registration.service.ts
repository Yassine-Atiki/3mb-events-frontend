import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PageRequest, PageResponse, Registration, RegistrationSource, RegistrationStatus } from '../models';

export interface CreateRegistrationRequest {
  eventId: string;
  ticketTypeId: string;
  /** Always 1 — one participant = one registration. */
  quantity?: 1;
  /** MANUAL (default) or IMPORT — not a public sale. */
  source?: Exclude<RegistrationSource, 'PUBLIC'>;
  participantFirstName: string;
  participantLastName: string;
  participantEmail: string;
  participantPhone?: string;
}

export interface RegistrationSearchParams extends PageRequest {
  eventId?: string;
  participantEmail?: string;
  status?: RegistrationStatus;
}

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/registrations`;

  search(params: RegistrationSearchParams): Observable<PageResponse<Registration>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.eventId) httpParams = httpParams.set('eventId', params.eventId);
    if (params.participantEmail) httpParams = httpParams.set('participantEmail', params.participantEmail);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<PageResponse<Registration>>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<Registration> {
    return this.http.get<Registration>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateRegistrationRequest): Observable<Registration> {
    return this.http.post<Registration>(this.baseUrl, payload);
  }

  cancel(id: string): Observable<Registration> {
    return this.http.patch<Registration>(`${this.baseUrl}/${id}/cancel`, {});
  }

  checkIn(id: string): Observable<Registration> {
    return this.http.patch<Registration>(`${this.baseUrl}/${id}/check-in`, {});
  }

  updateStatus(id: string, status: RegistrationStatus): Observable<Registration> {
    return this.http.patch<Registration>(`${this.baseUrl}/${id}/status`, { status });
  }

  changeTicketType(id: string, ticketTypeId: string): Observable<Registration> {
    return this.http.patch<Registration>(`${this.baseUrl}/${id}/ticket-type`, { ticketTypeId });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  sendTicketEmail(id: string): Observable<TicketEmailSendResult> {
    return this.http.post<TicketEmailSendResult>(`${this.baseUrl}/${id}/send-ticket`, {});
  }
}

export interface TicketEmailSendResult {
  sent: number;
  skipped: number;
  message: string;
}
