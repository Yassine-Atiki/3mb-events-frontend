import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PageRequest, PageResponse, Registration, RegistrationStatus } from '../models';

export interface CreateRegistrationRequest {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
}

export interface RegistrationSearchParams extends PageRequest {
  eventId?: string;
  userId?: string;
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
    if (params.userId) httpParams = httpParams.set('userId', params.userId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<PageResponse<Registration>>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<Registration> {
    return this.http.get<Registration>(`${this.baseUrl}/${id}`);
  }

  getMine(): Observable<Registration[]> {
    return this.http.get<Registration[]>(`${this.baseUrl}/me`);
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
}
