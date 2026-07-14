import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditLogEntry, PageRequest, PageResponse, User } from '../models';

export type AdminReportType = 'users' | 'events' | 'refunds' | 'audit';
export type AdminReportFormat = 'pdf' | 'excel';

export interface AuditLogSearchParams extends PageRequest {
  actorUserId?: string;
  targetType?: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getAuditLogs(params: AuditLogSearchParams): Observable<PageResponse<AuditLogEntry>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.actorUserId) httpParams = httpParams.set('actorUserId', params.actorUserId);
    if (params.targetType) httpParams = httpParams.set('targetType', params.targetType);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    return this.http.get<PageResponse<AuditLogEntry>>(`${this.baseUrl}/audit-logs`, {
      params: httpParams
    });
  }

  /**
   * Download a generated admin report as a file blob.
   * Backend must return Content-Disposition: attachment; filename="..."
   */
  exportReport(type: AdminReportType, format: AdminReportFormat): Observable<HttpResponse<Blob>> {
    const params = new HttpParams().set('format', format);
    return this.http.get(`${this.baseUrl}/reports/${type}`, {
      params,
      observe: 'response',
      responseType: 'blob'
    });
  }

  impersonate(userId: string): Observable<{ accessToken: string }> {
    return this.http.post<{ accessToken: string }>(`${this.baseUrl}/impersonate/${userId}`, {});
  }

  suspendUser(userId: string, reason: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/users/${userId}/suspend`, { reason });
  }

  reactivateUser(userId: string): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/users/${userId}/reactivate`, {});
  }
}
