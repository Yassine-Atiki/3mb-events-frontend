import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PageRequest, PageResponse, RefundRequest, RefundStatus } from '../models';

export interface CreateRefundRequest {
  registrationId: string;
  reason: string;
}

export interface RefundSearchParams extends PageRequest {
  status?: RefundStatus;
  eventId?: string;
}

@Injectable({ providedIn: 'root' })
export class RefundService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/refunds`;

  create(payload: CreateRefundRequest): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(this.baseUrl, payload);
  }

  search(params: RefundSearchParams): Observable<PageResponse<RefundRequest>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.eventId) httpParams = httpParams.set('eventId', params.eventId);
    return this.http.get<PageResponse<RefundRequest>>(this.baseUrl, { params: httpParams });
  }

  approve(id: string, adminNote?: string): Observable<RefundRequest> {
    return this.http.patch<RefundRequest>(`${this.baseUrl}/${id}/approve`, { adminNote });
  }

  reject(id: string, adminNote?: string): Observable<RefundRequest> {
    return this.http.patch<RefundRequest>(`${this.baseUrl}/${id}/reject`, { adminNote });
  }
}
