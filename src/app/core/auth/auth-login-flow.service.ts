import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { AuthFlowResponse, AuthResponse, isAuthResponse, isTwoFactorChallenge } from '../api/auth.service';
import { AuthSessionService } from './auth-session.service';

export const PRE_AUTH_STORAGE_KEY = '3mb_2fa_pre_auth';

/**
 * Routes login/Google results: either complete the session or start the 2FA challenge.
 */
@Injectable({ providedIn: 'root' })
export class AuthLoginFlowService {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  handleLoginResult(
    result: AuthFlowResponse,
    options?: { returnUrl?: string | null; successMessage?: string; preferQueryReturnUrl?: boolean }
  ): boolean {
    if (isTwoFactorChallenge(result)) {
      sessionStorage.setItem(PRE_AUTH_STORAGE_KEY, result.preAuthToken);
      const queryParams: Record<string, string> = {};
      const returnUrl =
        options?.returnUrl ??
        (options?.preferQueryReturnUrl !== false
          ? new URLSearchParams(window.location.search).get('returnUrl')
          : null);
      if (returnUrl) {
        queryParams['returnUrl'] = returnUrl;
      }
      void this.router.navigate(['/auth/2fa'], { queryParams });
      return false;
    }

    if (isAuthResponse(result)) {
      this.authSession.completeAuthSession(result, {
        returnUrl: options?.returnUrl,
        preferQueryReturnUrl: options?.preferQueryReturnUrl
      });
      return true;
    }

    return false;
  }

  clearPreAuth(): void {
    sessionStorage.removeItem(PRE_AUTH_STORAGE_KEY);
  }

  readPreAuth(): string | null {
    return sessionStorage.getItem(PRE_AUTH_STORAGE_KEY);
  }

  completeVerifiedSession(response: AuthResponse, returnUrl?: string | null): void {
    this.clearPreAuth();
    this.authSession.completeAuthSession(response, {
      returnUrl: returnUrl ?? null,
      preferQueryReturnUrl: false
    });
  }
}
