import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PageRequest, PageResponse, User, UserRole, UserStatus } from '../models';

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  organization?: string;
  avatarUrl?: string;
}

export interface UserSearchParams extends PageRequest {
  query?: string;
  role?: UserRole;
  status?: UserStatus;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  search(params: UserSearchParams): Observable<PageResponse<User>> {
    let httpParams = new HttpParams().set('page', params.page).set('size', params.size);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.role) httpParams = httpParams.set('role', params.role);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<PageResponse<User>>(this.baseUrl, { params: httpParams });
  }

  updateProfile(id: string, payload: UpdateProfileRequest): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}`, payload);
  }

  updateStatus(id: string, status: UserStatus): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}/status`, { status });
  }

  updateRole(id: string, role: UserRole): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}/role`, { role });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
