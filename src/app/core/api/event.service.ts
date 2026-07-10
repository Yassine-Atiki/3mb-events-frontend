import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Event, EventStatus, EventVisibility, PageRequest, PageResponse } from '../models';

export interface EventSearchParams extends PageRequest {
  query?: string;
  categoryId?: string;
  city?: string;
  status?: EventStatus;
  organizerId?: string;
  from?: string;
  to?: string;
  isFree?: boolean;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  shortDescription: string;
  coverImageUrl?: string;
  categoryId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  city: string;
  capacity: number;
  visibility: EventVisibility;
  isFree: boolean;
  priceFrom?: number;
}

export type UpdateEventRequest = Partial<CreateEventRequest>;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  search(params: EventSearchParams): Observable<PageResponse<Event>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.city) httpParams = httpParams.set('city', params.city);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.organizerId) httpParams = httpParams.set('organizerId', params.organizerId);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.isFree !== undefined) httpParams = httpParams.set('isFree', params.isFree);

    return this.http.get<PageResponse<Event>>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<Event> {
    return this.http.get<Event>(`${this.baseUrl}/${id}`);
  }

  getBySlug(slug: string): Observable<Event> {
    return this.http.get<Event>(`${this.baseUrl}/slug/${slug}`);
  }

  create(payload: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateEventRequest): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}`, payload);
  }

  updateStatus(id: string, status: EventStatus): Observable<Event> {
    return this.http.patch<Event>(`${this.baseUrl}/${id}/status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  duplicate(id: string): Observable<Event> {
    return this.http.post<Event>(`${this.baseUrl}/${id}/duplicate`, {});
  }

  getByOrganizer(organizerId: string, params: PageRequest): Observable<PageResponse<Event>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    return this.http.get<PageResponse<Event>>(`${this.baseUrl}/organizer/${organizerId}`, {
      params: httpParams
    });
  }
}
