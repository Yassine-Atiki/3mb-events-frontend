import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent],
  template: `
    <div class="mb-7 text-center">
      <h1 class="text-2xl font-bold tracking-tight text-text-primary">Mot de passe oublié</h1>
      <p class="mt-2 text-sm text-text-secondary">
        Indiquez votre adresse email, nous vous enverrons un lien de réinitialisation.
      </p>
    </div>

    @if (sent()) {
      <div class="rounded-2xl border border-brand-teal/20 bg-brand-teal/8 p-5 text-center text-sm font-medium text-brand-teal-dark shadow-card">
        Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé.
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <app-ui-input
          label="Adresse email"
          type="email"
          placeholder="vous@exemple.com"
          formControlName="email"
          [error]="form.controls.email.invalid && form.controls.email.touched ? 'Adresse email invalide.' : undefined"
        />
        <app-ui-button type="submit" [loading]="loading()" class="mt-2">Envoyer le lien</app-ui-button>
      </form>
    }

    <p class="mt-6 text-center text-sm text-text-secondary">
      <a routerLink="/auth/connexion" class="font-semibold text-brand-teal-dark hover:underline">
        ← Retour à la connexion
      </a>
    </p>
  `
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly sent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.authService
      .forgotPassword(this.form.getRawValue().email)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.sent.set(true),
        error: (error: HttpErrorResponse) => {
          this.toast.error(
            (error.error as { message?: string } | null)?.message ?? "Une erreur est survenue. Réessayez."
          );
        }
      });
  }
}
