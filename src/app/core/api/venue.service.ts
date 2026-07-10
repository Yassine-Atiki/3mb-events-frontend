import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Venue } from '../models';

export type CreateVenueRequest = Omit<Venue, 'id'>;
export type UpdateVenueRequest = Partial<CreateVenueRequest>;

@Injectable({ providedIn: 'root' })
export class VenueService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/venues`;

  getAll(city?: string): Observable<Venue[]> {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    return this.http.get<Venue[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Venue> {
    return this.http.get<Venue>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateVenueRequest): Observable<Venue> {
    return this.http.post<Venue>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateVenueRequest): Observable<Venue> {
    return this.http.patch<Venue>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
