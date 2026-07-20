import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, Observable, take } from 'rxjs';

import { UserRole } from '../models';
import { AuthStore } from './auth.store';
import { needsOrganizationSetup } from './organization.util';

/**
 * Wait until AuthStore finishes hydrating tokens → user after a full page reload.
 * Without this, guards redirect to login while user is still null.
 */
function afterSessionReady(authStore: InstanceType<typeof AuthStore>): Observable<boolean> {
  return toObservable(authStore.sessionReady).pipe(
    filter((ready) => ready),
    take(1)
  );
}

function postAuthHome(user: NonNullable<ReturnType<InstanceType<typeof AuthStore>['user']>>): string[] {
  if (needsOrganizationSetup(user)) {
    return ['/auth/organisation-requise'];
  }
  switch (user.role) {
    case 'ORGANIZER':
      return ['/organisateur/tableau-de-bord'];
    case 'ADMIN':
      return ['/admin/tableau-de-bord'];
    default:
      return ['/403'];
  }
}

export const authGuard: CanActivateFn = (_route, state): Observable<boolean | UrlTree> => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return afterSessionReady(authStore).pipe(
    map(() =>
      authStore.isAuthenticated()
        ? true
        : router.createUrlTree(['/auth/connexion'], { queryParams: { returnUrl: state.url } })
    )
  );
};

export const guestGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return afterSessionReady(authStore).pipe(
    map(() => {
      if (!authStore.isAuthenticated()) {
        return true;
      }

      const user = authStore.user();
      if (!user) {
        return true;
      }
      return router.createUrlTree(postAuthHome(user));
    })
  );
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return (_route, state): Observable<boolean | UrlTree> => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    return afterSessionReady(authStore).pipe(
      map(() => {
        if (!authStore.isAuthenticated()) {
          return router.createUrlTree(['/auth/connexion'], { queryParams: { returnUrl: state.url } });
        }

        const user = authStore.user();
        if (user && roles.includes(user.role)) {
          return true;
        }

        return router.createUrlTree(['/403']);
      })
    );
  };
}

/** Blocks organizer app routes until organization name is set. */
export const organizationRequiredGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return afterSessionReady(authStore).pipe(
    map(() => {
      const user = authStore.user();
      if (needsOrganizationSetup(user)) {
        return router.createUrlTree(['/auth/organisation-requise']);
      }
      return true;
    })
  );
};

/** Allows the blocking setup screen only when organization setup is still required. */
export const organizationSetupGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return afterSessionReady(authStore).pipe(
    map(() => {
      const user = authStore.user();
      if (!user) {
        return router.createUrlTree(['/auth/connexion']);
      }
      if (user.role === 'ADMIN') {
        return router.createUrlTree(['/admin/tableau-de-bord']);
      }
      if (!needsOrganizationSetup(user)) {
        return router.createUrlTree(['/organisateur/tableau-de-bord']);
      }
      return true;
    })
  );
};
