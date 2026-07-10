import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from '../models';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/connexion'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  // Already signed in: send to the correct workspace instead of bouncing to `/`
  // (which made landing CTAs look completely unresponsive).
  switch (authStore.user()?.role) {
    case 'ORGANIZER':
      return router.createUrlTree(['/organisateur/tableau-de-bord']);
    case 'ADMIN':
      return router.createUrlTree(['/admin/tableau-de-bord']);
    default:
      return router.createUrlTree(['/app/tableau-de-bord']);
  }
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return (_route, state) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (!authStore.isAuthenticated()) {
      return router.createUrlTree(['/auth/connexion'], { queryParams: { returnUrl: state.url } });
    }

    const user = authStore.user();
    if (user && roles.includes(user.role)) {
      return true;
    }

    return router.createUrlTree(['/403']);
  };
}
