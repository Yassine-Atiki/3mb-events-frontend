import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { AuthLoginFlowService } from '../../core/auth/auth-login-flow.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-two-factor-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent],
  template: `
    <div class="mb-7 text-center">
      <span class="page-header-badge">Sécurité</span>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary">Vérification en deux étapes</h1>
      <p class="mt-2 text-sm text-text-secondary">
        Saisissez le code à 6 chiffres de votre application d’authentification, ou un code de récupération.
      </p>
    </div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
      <app-ui-input
        label="Code"
        placeholder="123456 ou XXXX-XXXX"
        formControlName="code"
        [error]="form.controls.code.invalid && form.controls.code.touched ? 'Code requis.' : undefined"
      />

      <app-ui-button type="submit" [fullWidth]="true" [loading]="loading()">Vérifier</app-ui-button>
    </form>

    <p class="mt-6 text-center text-sm text-text-secondary">
      <a routerLink="/auth/connexion" class="font-semibold text-brand-teal-dark hover:underline">
        Retour à la connexion
      </a>
    </p>
  `
})
export class TwoFactorPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly loginFlow = inject(AuthLoginFlowService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void {
    if (!this.loginFlow.readPreAuth()) {
      this.toast.error('Session 2FA expirée. Reconnectez-vous.');
      void this.router.navigate(['/auth/connexion']);
    }
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const preAuthToken = this.loginFlow.readPreAuth();
    if (!preAuthToken) {
      this.toast.error('Session 2FA expirée. Reconnectez-vous.');
      void this.router.navigate(['/auth/connexion']);
      return;
    }

    const { code } = this.form.getRawValue();
    this.loading.set(true);

    this.authService
      .verify2fa(preAuthToken, code.trim())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.loginFlow.completeVerifiedSession(response, returnUrl);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 401) {
            const code = (error.error as { code?: string } | null)?.code;
            if (code === 'INVALID_PRE_AUTH_TOKEN') {
              this.loginFlow.clearPreAuth();
              this.toast.error('Session 2FA expirée. Reconnectez-vous.');
              void this.router.navigate(['/auth/connexion']);
              return;
            }
          }
          this.toast.error(this.extractErrorMessage(error, 'Code invalide.'));
        }
      });
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return (error.error as { message?: string } | null)?.message ?? fallback;
  }
}
