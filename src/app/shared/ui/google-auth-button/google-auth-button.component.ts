import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { finalize, from, switchMap } from 'rxjs';

import { AuthService, GoogleAuthRequest, isAuthResponse } from '../../../core/api/auth.service';
import { AuthLoginFlowService } from '../../../core/auth/auth-login-flow.service';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';
import { UserRole } from '../../../core/models';
import { ToastService } from '../toast/toast.service';

@Component({
  selector: 'app-google-auth-button',
  standalone: true,
  template: `
    @if (showDivider()) {
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-surface-white px-4 font-medium text-text-secondary">ou</span>
        </div>
      </div>
    }

    <button
      type="button"
      class="group flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:shadow-sm"
      [disabled]="disabled() || loading()"
      (click)="signIn()"
    >
      @if (loading()) {
        <span
          class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-teal"
          aria-hidden="true"
        ></span>
        <span>Connexion Google…</span>
      } @else {
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>{{ label() }}</span>
      }
    </button>

    @if (disabledHint()) {
      <p class="mt-2 text-center text-xs text-text-secondary">{{ disabledHint() }}</p>
    }
  `
})
export class GoogleAuthButtonComponent {
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly authService = inject(AuthService);
  private readonly loginFlow = inject(AuthLoginFlowService);
  private readonly toast = inject(ToastService);

  /** When set, creates/signs in with this role (ORGANIZER requires organization). */
  readonly role = input<UserRole | undefined>(undefined);
  readonly organization = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly disabledHint = input<string | undefined>(undefined);
  readonly showDivider = input(true);
  readonly label = input('Continuer avec Google');
  readonly successMessage = input<string | undefined>(undefined);

  readonly completed = output<void>();

  protected readonly loading = signal(false);

  protected readonly canSubmit = computed(() => !this.disabled() && !this.loading());

  protected signIn(): void {
    if (!this.canSubmit()) return;

    const role = this.role();
    if (role === 'ORGANIZER' && !this.organization()?.trim()) {
      this.toast.error('Indiquez votre organisation avant de continuer avec Google.');
      return;
    }

    this.loading.set(true);

    from(this.googleAuth.requestIdToken())
      .pipe(
        switchMap((idToken) => {
          const payload: GoogleAuthRequest = { idToken };
          if (role) {
            payload.role = role;
          }
          const org = this.organization()?.trim();
          if (org) {
            payload.organization = org;
          }
          return this.authService.googleLogin(payload);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (result) => {
          const completed = this.loginFlow.handleLoginResult(result, {
            preferQueryReturnUrl: true
          });
          if (completed && isAuthResponse(result)) {
            const msg = this.successMessage();
            if (msg) {
              this.toast.success(msg);
            }
            this.completed.emit();
          }
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            this.toast.error(this.extractErrorMessage(error, 'Échec de la connexion Google.'));
            return;
          }
          const message = error instanceof Error ? error.message : 'Échec de la connexion Google.';
          this.toast.error(message);
        }
      });
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return (error.error as { message?: string } | null)?.message ?? fallback;
  }
}
