import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AdminStats, EventAudit, OrganizerStats } from '../models';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/stats`;

  getOrganizerStats(organizerId: string): Observable<OrganizerStats> {
    return this.http.get<OrganizerStats>(`${this.baseUrl}/organizer/${organizerId}`);
  }

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/admin`);
  }

  getEventStats(eventId: string): Observable<OrganizerStats> {
    return this.http.get<OrganizerStats>(`${this.baseUrl}/events/${eventId}`);
  }

  getEventAudit(eventId: string): Observable<EventAudit> {
    return this.http.get<EventAudit>(`${this.baseUrl}/events/${eventId}/audit`);
  }
}
