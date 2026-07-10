import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  organization?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload);
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {});
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  refreshToken(payload: RefreshTokenRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, payload);
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, { token, newPassword });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, { currentPassword, newPassword });
  }
}
