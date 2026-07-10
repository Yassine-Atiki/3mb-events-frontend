import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { passwordsMatchValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent],
  template: `
    <div class="mb-7 text-center">
      <h1 class="text-2xl font-bold tracking-tight text-text-primary">Réinitialiser le mot de passe</h1>
      <p class="mt-2 text-sm text-text-secondary">Choisissez un nouveau mot de passe pour votre compte.</p>
    </div>

    @if (done()) {
      <div class="rounded-2xl border border-brand-teal/20 bg-brand-teal/8 p-5 text-center text-sm font-medium text-brand-teal-dark shadow-card">
        Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.
      </div>
      <a routerLink="/auth/connexion" class="mt-6 block">
        <app-ui-button class="w-full">Se connecter</app-ui-button>
      </a>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <app-ui-input
          label="Nouveau mot de passe"
          type="password"
          formControlName="password"
          [error]="form.controls.password.invalid && form.controls.password.touched ? '8 caractères minimum.' : undefined"
        />
        <app-ui-input
          label="Confirmer le mot de passe"
          type="password"
          formControlName="confirmPassword"
          [error]="form.errors?.['passwordsMismatch'] && form.controls.confirmPassword.touched ? 'Les mots de passe ne correspondent pas.' : undefined"
        />
        <app-ui-button type="submit" [loading]="loading()" class="mt-2">Réinitialiser</app-ui-button>
      </form>
    }
  `
})
export class ResetPasswordPage {
  readonly token = input<string>('');

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatchValidator('password', 'confirmPassword') }
  );

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    this.authService
      .resetPassword(this.token(), this.form.getRawValue().password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.done.set(true);
          setTimeout(() => this.router.navigate(['/auth/connexion']), 2500);
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(
            (error.error as { message?: string } | null)?.message ?? 'Lien invalide ou expiré.'
          );
        }
      });
  }
}
