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

/** Login / Google can return either a session or a 2FA challenge (same HTTP 200). */
export interface AuthFlowResponse {
  requires2fa?: boolean;
  preAuthToken?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

export type AuthLoginResult = AuthFlowResponse;

export interface TwoFactorChallenge {
  requires2fa: true;
  preAuthToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface GoogleAuthRequest {
  idToken: string;
  role?: UserRole;
  organization?: string;
}

export interface TotpSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TotpEnableResponse {
  recoveryCodes: string[];
}

export interface TotpStatusResponse {
  enabled: boolean;
}

/**
 * Backend may return a full AuthResponse or a minimal refresh payload.
 * Optional fields keep the previous session values when omitted.
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  user?: User;
}

export function isTwoFactorChallenge(result: AuthFlowResponse | null | undefined): result is TwoFactorChallenge {
  return (
    !!result &&
    result.requires2fa === true &&
    typeof result.preAuthToken === 'string' &&
    result.preAuthToken.length > 0
  );
}

export function isAuthResponse(result: AuthFlowResponse | null | undefined): result is AuthResponse {
  return (
    !!result &&
    typeof result.accessToken === 'string' &&
    result.accessToken.length > 0 &&
    !!result.user &&
    typeof result.refreshToken === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(payload: LoginRequest): Observable<AuthFlowResponse> {
    return this.http.post<AuthFlowResponse>(`${this.baseUrl}/login`, payload);
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload);
  }

  googleLogin(payload: GoogleAuthRequest): Observable<AuthFlowResponse> {
    return this.http.post<AuthFlowResponse>(`${this.baseUrl}/google`, payload);
  }

  verify2fa(preAuthToken: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/2fa/verify`, { preAuthToken, code });
  }

  setup2fa(): Observable<TotpSetupResponse> {
    return this.http.post<TotpSetupResponse>(`${this.baseUrl}/2fa/setup`, {});
  }

  enable2fa(code: string): Observable<TotpEnableResponse> {
    return this.http.post<TotpEnableResponse>(`${this.baseUrl}/2fa/enable`, { code });
  }

  disable2fa(code: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/2fa/disable`, { code });
  }

  totpStatus(): Observable<TotpStatusResponse> {
    return this.http.get<TotpStatusResponse>(`${this.baseUrl}/2fa/status`);
  }

  logout(refreshToken?: string | null): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/logout`,
      refreshToken ? { refreshToken } : {}
    );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  refreshToken(payload: RefreshTokenRequest): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.baseUrl}/refresh`, payload);
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
