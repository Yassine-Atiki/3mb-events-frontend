import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';

function runGuard(injector: EnvironmentInjector, url: string): Promise<boolean | UrlTree> {
  return runInInjectionContext(injector, () => {
    const result = authGuard({} as never, { url, root: null as never } as never);
    if (!isObservable(result)) {
      return Promise.resolve(result as boolean | UrlTree);
    }
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  });
}

/**
 * Simulates a full page reload: tokens already in localStorage, user not in memory yet.
 */
describe('Auth session restore on reload', () => {
  const ACCESS_KEY = '3mb_access_token';
  const REFRESH_KEY = '3mb_refresh_token';
  const USER_KEY = '3mb_user';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
  });

  it('does not redirect to login while /auth/me is still in flight after reload', async () => {
    localStorage.setItem(ACCESS_KEY, 'access-from-previous-session');
    localStorage.setItem(REFRESH_KEY, 'refresh-from-previous-session');

    const authStore = TestBed.inject(AuthStore);
    const http = TestBed.inject(HttpTestingController);
    const injector = TestBed.inject(EnvironmentInjector);

    expect(authStore.sessionReady()).toBe(false);
    expect(authStore.isAuthenticated()).toBe(false);

    const guardResultPromise = runGuard(injector, '/admin/tableau-de-bord');
    expect(authStore.sessionReady()).toBe(false);

    http.expectOne(`${environment.apiUrl}/auth/me`).flush({
      id: 'usr-1',
      email: 'admin@3mb.com',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z'
    });

    const result = await guardResultPromise;

    expect(authStore.sessionReady()).toBe(true);
    expect(authStore.isAuthenticated()).toBe(true);
    expect(result).toBe(true);
  });

  it('recovers via refresh when /auth/me returns 403 (expired JWT / Spring anonymous)', async () => {
    localStorage.setItem(ACCESS_KEY, 'expired-access');
    localStorage.setItem(REFRESH_KEY, 'valid-refresh');
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: 'usr-1',
        email: 'admin@3mb.com',
        firstName: 'Admin',
        lastName: 'Test',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z'
      })
    );

    const authStore = TestBed.inject(AuthStore);
    const http = TestBed.inject(HttpTestingController);
    const injector = TestBed.inject(EnvironmentInjector);

    const guardResultPromise = runGuard(injector, '/admin/tableau-de-bord');

    // Cached user is available immediately (reload hydration).
    expect(authStore.user()?.email).toBe('admin@3mb.com');

    http.expectOne(`${environment.apiUrl}/auth/me`).flush(null, { status: 403, statusText: 'Forbidden' });
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush({
      accessToken: 'new-access',
      refreshToken: 'valid-refresh',
      user: {
        id: 'usr-1',
        email: 'admin@3mb.com',
        firstName: 'Admin',
        lastName: 'Test',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z'
      }
    });
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({
      id: 'usr-1',
      email: 'admin@3mb.com',
      firstName: 'Admin',
      lastName: 'Test',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z'
    });

    const result = await guardResultPromise;
    expect(result).toBe(true);
    expect(authStore.isAuthenticated()).toBe(true);
    expect(authStore.accessToken()).toBe('new-access');
  });

  it('redirects to login only after restore finishes with no valid session', async () => {
    localStorage.setItem(ACCESS_KEY, 'expired-access');
    localStorage.setItem(REFRESH_KEY, 'expired-refresh');

    const injector = TestBed.inject(EnvironmentInjector);
    TestBed.inject(AuthStore);
    const http = TestBed.inject(HttpTestingController);

    const guardResultPromise = runGuard(injector, '/organisateur/tableau-de-bord');

    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(
      { message: 'Invalid refresh' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const result = await guardResultPromise;
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('/auth/connexion');
  });
});
