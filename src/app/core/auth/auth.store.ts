import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, of, pipe, switchMap, tap } from 'rxjs';

import { AuthService, LoginRequest, RegisterRequest } from '../api/auth.service';
import { User } from '../models';

const ACCESS_TOKEN_KEY = '3mb_access_token';
const REFRESH_TOKEN_KEY = '3mb_refresh_token';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null
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
    isOrganizer: computed(() => user()?.role === 'ORGANIZER'),
    isParticipant: computed(() => user()?.role === 'PARTICIPANT')
  })),
  withMethods((store) => ({
    setSession(user: User, accessToken: string, refreshToken: string): void {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      patchState(store, { user, accessToken, refreshToken, loading: false, error: null });
    },
    setUser(user: User): void {
      patchState(store, { user, loading: false, error: null });
    },
    clearSession(): void {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      patchState(store, initialState);
    },
    setLoading(loading: boolean): void {
      patchState(store, { loading });
    },
    setError(error: string | null): void {
      patchState(store, { error, loading: false });
    }
  })),
  withMethods((store, authService = inject(AuthService)) => ({
    login: rxMethod<LoginRequest>(
      pipe(
        tap(() => store.setLoading(true)),
        switchMap((credentials) =>
          authService.login(credentials).pipe(
            tap(({ user, accessToken, refreshToken }) => store.setSession(user, accessToken, refreshToken)),
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
            catchError(() => {
              store.clearSession();
              return EMPTY;
            })
          )
        )
      )
    ),
    logout(): void {
      authService
        .logout()
        .pipe(
          catchError(() => of(null)),
          tap(() => store.clearSession())
        )
        .subscribe();
    }
  })),
  withHooks({
    onInit(store) {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (accessToken) {
        patchState(store, { accessToken, refreshToken });
        store.loadMe();
      }
    }
  })
);
