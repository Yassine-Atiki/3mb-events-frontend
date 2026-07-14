import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, map, startWith } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { GoogleAuthButtonComponent } from '../../shared/ui/google-auth-button/google-auth-button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { passwordsMatchValidator } from '../../shared/utils/validators';

@Component({
  selector: 'app-register-organizer-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, GoogleAuthButtonComponent],
  template: `
    <div class="mb-7 text-center">
      <span class="page-header-badge">Organisateur</span>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary">Devenez organisateur</h1>
      <p class="mt-2 text-sm text-text-secondary">Créez, publiez et gérez vos événements sur 3MB Events.</p>
    </div>

    <app-ui-input
      label="Organisation"
      placeholder="Nom de votre entreprise ou association"
      [formControl]="organizationControl"
      [error]="organizationInvalid() ? 'Requis' : undefined"
    />

    <app-google-auth-button
      class="mt-4 block"
      role="ORGANIZER"
      [organization]="organizationValue()"
      [disabled]="!organizationReady()"
      disabledHint="Renseignez votre organisation pour activer Continuer avec Google."
      [showDivider]="false"
      successMessage="Compte organisateur créé avec succès."
    />

    <div class="relative my-6">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-200"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="bg-surface-white px-4 font-medium text-text-secondary">ou</span>
      </div>
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

      <div class="mt-2 flex justify-center">
        <app-ui-button type="submit" [loading]="loading()">Créer mon compte organisateur</app-ui-button>
      </div>
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
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  /** Shared organization field — above Google button and mirrored into the form. */
  protected readonly organizationControl = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.minLength(2)
  ]);

  private readonly organizationRaw = toSignal(
    this.organizationControl.valueChanges.pipe(
      startWith(this.organizationControl.value),
      map((v) => v ?? '')
    ),
    { initialValue: '' }
  );

  protected readonly organizationValue = computed(() => this.organizationRaw().trim());
  protected readonly organizationReady = computed(() => this.organizationValue().length >= 2);

  protected organizationInvalid(): boolean {
    return this.organizationControl.invalid && this.organizationControl.touched;
  }

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
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
    this.organizationControl.markAsTouched();
    this.form.markAllAsTouched();
    if (this.organizationControl.invalid || this.form.invalid || this.loading()) return;

    const { firstName, lastName, email, phone, password } = this.form.getRawValue();
    const organization = this.organizationValue();
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
        next: (response) => {
          this.toast.success('Compte organisateur créé avec succès.');
          this.authSession.completeAuthSession(response, { preferQueryReturnUrl: false });
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
