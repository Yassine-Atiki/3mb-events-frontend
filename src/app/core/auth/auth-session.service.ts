import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthResponse } from '../api/auth.service';
import { AuthStore } from './auth.store';

/**
 * Shared post-login/register/Google flow: persist session and redirect by role / returnUrl.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  completeAuthSession(
    response: AuthResponse,
    options?: { returnUrl?: string | null; preferQueryReturnUrl?: boolean }
  ): void {
    const { user, accessToken, refreshToken } = response;
    this.authStore.setSession(user, accessToken, refreshToken);

    const returnUrl =
      options?.returnUrl ??
      (options?.preferQueryReturnUrl !== false
        ? this.route.snapshot.queryParamMap.get('returnUrl')
        : null);

    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }

    switch (user.role) {
      case 'ORGANIZER':
        void this.router.navigate(['/organisateur/tableau-de-bord']);
        break;
      case 'ADMIN':
        void this.router.navigate(['/admin/tableau-de-bord']);
        break;
      default:
        void this.router.navigate(['/app/tableau-de-bord']);
    }
  }
}
