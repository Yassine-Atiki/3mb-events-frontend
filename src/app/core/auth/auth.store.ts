import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  catchError,
  EMPTY,
  finalize,
  Observable,
  of,
  pipe,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import { AuthService, isAuthResponse, LoginRequest, RegisterRequest } from '../api/auth.service';
import { User } from '../models';

const ACCESS_TOKEN_KEY = '3mb_access_token';
const REFRESH_TOKEN_KEY = '3mb_refresh_token';
const USER_KEY = '3mb_user';

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  /**
   * False until bootstrap restore finishes (or confirms there is no session).
   * Route guards MUST wait for this before redirecting to login.
   */
  sessionReady: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
  sessionReady: false
};

function extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const message = (error.error as { message?: string } | null)?.message;
  return message ?? fallback;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user, accessToken }) => ({
    isAuthenticated: computed(() => !!accessToken() && !!user()),
    isAdmin: computed(() => user()?.role === 'ADMIN'),
    isOrganizer: computed(() => user()?.role === 'ORGANIZER')
  })),
  withMethods((store) => ({
    setSession(user: User, accessToken: string, refreshToken: string): void {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      writeCachedUser(user);
      patchState(store, {
        user,
        accessToken,
        refreshToken,
        loading: false,
        error: null,
        sessionReady: true
      });
    },
    setUser(user: User): void {
      writeCachedUser(user);
      patchState(store, { user, loading: false, error: null, sessionReady: true });
    },
    clearSession(): void {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      writeCachedUser(null);
      patchState(store, {
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null,
        sessionReady: true
      });
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setError(error: string | null): void {
      patchState(store, { error, loading: false });
    },
    markSessionReady(): void {
      patchState(store, { sessionReady: true, loading: false });
    }
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    /**
     * Exchange the opaque refresh token for a new access token.
     * Used by the HTTP interceptor on 401 and by bootstrap recovery.
     */
    refreshSession(): Observable<boolean> {
      const refreshToken = store.refreshToken();
      if (!refreshToken) {
        store.clearSession();
        return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'No refresh token' }));
      }

      return authService.refreshToken({ refreshToken }).pipe(
        tap((response) => {
          const nextRefresh = response.refreshToken ?? refreshToken;
          localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, nextRefresh);
          patchState(store, {
            accessToken: response.accessToken,
            refreshToken: nextRefresh,
            user: response.user ?? store.user(),
            error: null
          });
          if (response.user) {
            writeCachedUser(response.user);
          } else if (store.user()) {
            writeCachedUser(store.user()!);
          }
        }),
        switchMap(() => of(true)),
        catchError((error: unknown) => {
          store.clearSession();
          return throwError(() => error);
        })
      );
    }
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    /**
     * Restore session after a full page reload from tokens in localStorage.
     * Resolves (and sets sessionReady) whether restore succeeds or fails.
     */
    restoreSession(): Observable<boolean> {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const cachedUser = readCachedUser();

      if (!accessToken && !refreshToken) {
        writeCachedUser(null);
        store.markSessionReady();
        return of(false);
      }

      // Hydrate cached user immediately so guards don't treat a valid session as logged-out
      // while /auth/me (or refresh) is in flight.
      patchState(store, {
        accessToken,
        refreshToken,
        user: cachedUser,
        loading: true,
        sessionReady: false
      });

      const loadUser = (): Observable<boolean> =>
        authService.me().pipe(
          tap((user) => store.setUser(user)),
          switchMap(() => of(true)),
          catchError((error: unknown) => {
            // Spring used to return 403 for missing/expired JWT (anonymous AccessDenied).
            // Always attempt refresh when we still have a refresh token.
            if (!store.refreshToken()) {
              store.clearSession();
              return of(false);
            }
            const status = error instanceof HttpErrorResponse ? error.status : 0;
            if (status !== 401 && status !== 403) {
              // Network/5xx: keep tokens + cached user, mark ready (don't hard-logout on blips).
              if (store.user()) {
                store.markSessionReady();
                return of(true);
              }
              store.markSessionReady();
              return of(false);
            }
            return store.refreshSession().pipe(
              switchMap(() =>
                authService.me().pipe(
                  tap((user) => store.setUser(user)),
                  switchMap(() => of(true)),
                  catchError(() => {
                    store.clearSession();
                    return of(false);
                  })
                )
              ),
              catchError(() => of(false))
            );
          })
        );

      const restore$ = accessToken
        ? loadUser()
        : store.refreshSession().pipe(
            switchMap(() => loadUser()),
            catchError(() => of(false))
          );

      return restore$.pipe(
        finalize(() => {
          if (!store.sessionReady()) {
            store.markSessionReady();
          }
        })
      );
    },

    login: rxMethod<LoginRequest>(
      pipe(
        tap(() => store.setLoading(true)),
        switchMap((credentials) =>
          authService.login(credentials).pipe(
            tap((result) => {
              if (isAuthResponse(result)) {
                store.setSession(result.user, result.accessToken, result.refreshToken);
              } else {
                store.setLoading(false);
                store.setError('Une vérification 2FA est requise. Utilisez la page de connexion.');
              }
            }),
            catchError((error: HttpErrorResponse) => {
              store.setError(extractErrorMessage(error, 'Échec de la connexion.'));
              return EMPTY;
            })
          )
        )
      )
    ),
    register: rxMethod<RegisterRequest>(
      pipe(
        tap(() => store.setLoading(true)),
        switchMap((payload) =>
          authService.register(payload).pipe(
            tap(({ user, accessToken, refreshToken }) => store.setSession(user, accessToken, refreshToken)),
            catchError((error: HttpErrorResponse) => {
              store.setError(extractErrorMessage(error, "Échec de l'inscription."));
              return EMPTY;
            })
          )
        )
      )
    ),
    loadMe: rxMethod<void>(
      pipe(
        tap(() => store.setLoading(true)),
        switchMap(() =>
          authService.me().pipe(
            tap((user) => store.setUser(user)),
            catchError((error: HttpErrorResponse) => {
              if ((error.status === 401 || error.status === 403) && store.refreshToken()) {
                return store.refreshSession().pipe(
                  switchMap(() =>
                    authService.me().pipe(
                      tap((user) => store.setUser(user)),
                      catchError(() => {
                        store.clearSession();
                        return EMPTY;
                      })
                    )
                  ),
                  catchError(() => EMPTY)
                );
              }
              if (error.status === 401 || error.status === 403) {
                store.clearSession();
              } else {
                store.setLoading(false);
              }
              return EMPTY;
            })
          )
        )
      )
    ),
    logout(): void {
      const refreshToken = store.refreshToken();
      // Clear locally first so guestGuard / login cannot reuse a stale session
      // while the logout HTTP call is still in flight.
      store.clearSession();
      if (refreshToken) {
        authService
          .logout(refreshToken)
          .pipe(catchError(() => of(null)))
          .subscribe();
      }
    }
  })),
  withHooks({
    onInit(store) {
      store.restoreSession().subscribe();
    }
  })
);
