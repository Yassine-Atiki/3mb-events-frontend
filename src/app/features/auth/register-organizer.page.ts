import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { passwordsMatchValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-register-organizer-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent],
  template: `
    <div class="mb-7 text-center">
      <span class="page-header-badge">Organisateur</span>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary">Devenez organisateur</h1>
      <p class="mt-2 text-sm text-text-secondary">Créez, publiez et gérez vos événements sur 3MB Events.</p>
    </div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3">
        <app-ui-input
          label="Prénom"
          formControlName="firstName"
          [error]="invalid('firstName') ? 'Requis' : undefined"
        />
        <app-ui-input label="Nom" formControlName="lastName" [error]="invalid('lastName') ? 'Requis' : undefined" />
      </div>

      <app-ui-input
        label="Organisation"
        placeholder="Nom de votre entreprise ou association"
        formControlName="organization"
        [error]="invalid('organization') ? 'Requis' : undefined"
      />

      <app-ui-input
        label="Adresse email professionnelle"
        type="email"
        formControlName="email"
        [error]="invalid('email') ? 'Adresse email invalide.' : undefined"
      />
      <app-ui-input label="Téléphone" type="tel" hint="Optionnel" formControlName="phone" />

      <app-ui-input
        label="Mot de passe"
        type="password"
        formControlName="password"
        [error]="invalid('password') ? '8 caractères minimum.' : undefined"
      />
      <app-ui-input
        label="Confirmer le mot de passe"
        type="password"
        formControlName="confirmPassword"
        [error]="form.errors?.['passwordsMismatch'] && form.controls.confirmPassword.touched ? 'Les mots de passe ne correspondent pas.' : undefined"
      />

      <label class="flex items-start gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          formControlName="acceptTerms"
          class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
        />
        J'accepte les conditions d'utilisation et la politique de confidentialité.
      </label>

      <app-ui-button type="submit" [loading]="loading()" class="mt-2">Créer mon compte organisateur</app-ui-button>
    </form>

    <p class="mt-6 text-center text-sm text-text-secondary">
      Déjà inscrit ?
      <a routerLink="/auth/connexion" class="font-semibold text-brand-teal-dark hover:underline">Se connecter</a>
      <br />
      Vous souhaitez simplement réserver une place ?
      <a routerLink="/auth/inscription/participant" class="font-semibold text-brand-teal-dark hover:underline">
        Inscription participant
      </a>
    </p>
  `
})
export class RegisterOrganizerPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      organization: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    },
    { validators: passwordsMatchValidator('password', 'confirmPassword') }
  );

  protected invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const { firstName, lastName, organization, email, phone, password } = this.form.getRawValue();
    this.loading.set(true);

    this.authService
      .register({
        firstName,
        lastName,
        email,
        organization,
        phone: phone || undefined,
        password,
        role: 'ORGANIZER'
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ user, accessToken, refreshToken }) => {
          this.authStore.setSession(user, accessToken, refreshToken);
          this.toast.success('Compte organisateur créé avec succès.');
          this.router.navigate(['/organisateur/tableau-de-bord']);
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(this.extractErrorMessage(error, "Échec de l'inscription."));
        }
      });
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return (error.error as { message?: string } | null)?.message ?? fallback;
  }
}
