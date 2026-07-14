import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/api/auth.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { GoogleAuthButtonComponent } from '../../shared/ui/google-auth-button/google-auth-button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, GoogleAuthButtonComponent],
  template: `
    <div class="relative">
      <!-- Decorative background elements -->
      <div class="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/10 blur-3xl"></div>
      <div class="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-brand-forest/15 to-brand-teal-dark/10 blur-3xl"></div>
      
      <div class="relative mb-8 text-center">
        <div class="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-teal/20 to-brand-teal-light/20 px-4 py-2 ring-1 ring-brand-teal/30">
          <div class="h-2 w-2 rounded-full bg-brand-teal animate-pulse"></div>
          <span class="text-xs font-bold uppercase tracking-wider text-brand-teal-dark">Espace membre</span>
        </div>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-text-primary">
          Bon retour <span class="gradient-text">parmi nous</span>
        </h1>
        <p class="mt-3 text-base text-text-secondary">
          Connectez-vous pour accéder à votre espace 3MB Events.
        </p>
      </div>

      <app-google-auth-button [showDivider]="false" />

      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-surface-white px-4 font-medium text-text-secondary">ou</span>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-6">
        <div class="flex flex-col gap-7">
          <app-ui-input
            label="Adresse email"
            type="email"
            placeholder="vous@exemple.com"
            formControlName="email"
            [error]="form.controls.email.invalid && form.controls.email.touched ? 'Adresse email invalide.' : undefined"
          />
          <app-ui-input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            formControlName="password"
            [error]="form.controls.password.invalid && form.controls.password.touched ? 'Mot de passe requis (6 caractères min.).' : undefined"
          />
        </div>

        <div class="flex items-center justify-between gap-6 text-sm">
          <label class="flex items-center gap-2.5 text-text-secondary hover:text-text-primary cursor-pointer transition-colors group">
            <input
              type="checkbox"
              formControlName="rememberMe"
              class="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-2 focus:ring-brand-teal/50 focus:ring-offset-2 transition-all"
            />
            <span class="font-medium">Se souvenir de moi</span>
          </label>
          <a 
            routerLink="/auth/mot-de-passe-oublie" 
            class="font-semibold text-brand-teal-dark hover:text-brand-teal transition-colors relative group"
          >
            <span>Mot de passe oublié ?</span>
            <span class="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-brand-teal transition-all group-hover:w-full"></span>
          </a>
        </div>

        <app-ui-button
          type="submit"
          size="lg"
          [fullWidth]="true"
          [loading]="loading()"
          extraClass="rounded-xl shadow-glow-teal hover:shadow-card-hover"
        >
          <span class="inline-flex items-center justify-center gap-2">
            <span>Se connecter</span>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </span>
        </app-ui-button>
      </form>

      <div class="relative mt-8">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-surface-white px-4 text-text-secondary font-medium">Pas encore de compte ?</span>
        </div>
      </div>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <a 
          routerLink="/auth/inscription/participant" 
          class="group relative flex items-center justify-center gap-2 rounded-xl border-2 border-brand-teal/30 bg-brand-teal/5 px-4 py-3 text-sm font-semibold text-brand-teal-dark transition-all hover:border-brand-teal hover:bg-brand-teal/10 hover:scale-[1.02]"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <span>Compte participant</span>
          <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </a>
        
        <a 
          routerLink="/auth/inscription/organisateur" 
          class="group relative flex items-center justify-center gap-2 rounded-xl border-2 border-brand-forest/30 bg-brand-forest/5 px-4 py-3 text-sm font-semibold text-brand-forest-deep transition-all hover:border-brand-forest hover:bg-brand-forest/10 hover:scale-[1.02]"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span>Devenir organisateur</span>
          <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </div>
  `
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true]
  });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const { email, password } = this.form.getRawValue();
    this.loading.set(true);

    this.authService
      .login({ email, password })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.authSession.completeAuthSession(response, {
            returnUrl: this.route.snapshot.queryParamMap.get('returnUrl')
          });
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(this.extractErrorMessage(error, 'Échec de la connexion.'));
        }
      });
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    return (error.error as { message?: string } | null)?.message ?? fallback;
  }
}
