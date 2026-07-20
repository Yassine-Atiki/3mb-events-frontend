import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, Observable, shareReplay, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthStore } from './auth.store';

/** Single in-flight refresh shared by concurrent 401s. */
let refreshInFlight$: Observable<boolean> | null = null;

function isAuthExemptUrl(url: string): boolean {
  const path = url.replace(environment.apiUrl, '');
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/google') ||
    path.startsWith('/auth/2fa/verify') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/auth/logout') ||
    path.startsWith('/public/') ||
    path.startsWith('/tickets/info')
  );
}

function withBearer(req: HttpRequest<unknown>, accessToken: string | null): HttpRequest<unknown> {
  if (!accessToken) {
    return req;
  }
  return req.clone({
    setHeaders: { Authorization: `Bearer ${accessToken}` }
  });
}

function isAuthChallenge(error: HttpErrorResponse): boolean {
  if (error.status === 401) {
    return true;
  }
  // Legacy/default Spring Security: anonymous AccessDenied → empty 403 body.
  if (error.status === 403) {
    const body = error.error;
    return body == null || body === '' || (typeof body === 'object' && body?.code === 'UNAUTHORIZED');
  }
  return false;
}

/**
 * Production-ready auth interceptor:
 * - Attaches Bearer access token to app API calls only
 * - On 401 (or anonymous 403), refreshes once via opaque refresh token, then retries
 * - Clears session if refresh fails
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  // External services (e.g. Nominatim) must not receive our Bearer token / refresh loop.
  const isAppApi =
    req.url.startsWith(environment.apiUrl) ||
    (environment.apiUrl.startsWith('/') && req.url.startsWith(environment.apiUrl));

  if (!isAppApi) {
    return next(req);
  }

  if (isAuthExemptUrl(req.url)) {
    return next(req);
  }

  const initialReq = withBearer(req, authStore.accessToken());

  return next(initialReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || !isAuthChallenge(error)) {
        return throwError(() => error);
      }

      if (!authStore.refreshToken()) {
        authStore.clearSession();
        return throwError(() => error);
      }

      if (!refreshInFlight$) {
        refreshInFlight$ = authStore.refreshSession().pipe(
          finalize(() => {
            refreshInFlight$ = null;
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
      }

      return refreshInFlight$.pipe(
        switchMap(() => next(withBearer(req, authStore.accessToken()))),
        catchError((refreshError: unknown) => throwError(() => refreshError))
      );
    })
  );
};
