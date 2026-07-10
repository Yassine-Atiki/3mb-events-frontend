import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LayoutDashboard, LucideAngularModule, Shield, Sparkles, UserRound } from 'lucide-angular';

import { AuthService } from '../../core/api/auth.service';
import { UserService } from '../../core/api/user.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { passwordsMatchValidator } from '../../shared/utils/validators';

function extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const message = (error.error as { message?: string } | null)?.message;
  return message ?? fallback;
}

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    AvatarComponent,
    BadgeComponent
  ],
  template: `
    <div class="participant-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="participant-lounge-badge mb-3">
            <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
            <span>Compte</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Mon profil</h1>
          <p class="mt-1 max-w-2xl text-base text-text-secondary">
            Vos informations personnelles et la sécurité de votre compte, au même endroit.
          </p>
        </div>
        <a routerLink="/app" class="participant-quick-nav-chip">
          <lucide-angular [img]="icons.LayoutDashboard" [size]="14"></lucide-angular>
          Tableau de bord
        </a>
      </header>

      <section class="participant-profile-hero" aria-label="Identité du compte">
        <div class="participant-profile-hero-scrim" aria-hidden="true"></div>
        <div class="participant-profile-hero-content">
          <div class="participant-profile-avatar-ring">
            <app-ui-avatar [name]="displayName()" size="lg" />
          </div>

          <div>
            <h2 class="participant-profile-identity-name">{{ displayName() }}</h2>
            <p class="participant-profile-identity-email">{{ user()?.email }}</p>
            <app-ui-badge class="mt-2.5 inline-block" tone="teal">Participant</app-ui-badge>
          </div>

          <div class="participant-profile-hero-chips">
            <span class="participant-profile-hero-chip">Compte actif</span>
            <span class="participant-profile-hero-chip">3MB Events</span>
          </div>
        </div>
      </section>

      <div class="participant-profile-bento">
        <section class="participant-pass-panel">
          <p class="participant-pass-panel-eyebrow">
            <lucide-angular [img]="icons.UserRound" [size]="12" class="mr-1 inline"></lucide-angular>
            Identité
          </p>
          <h2 class="participant-pass-panel-title">Informations personnelles</h2>
          <form [formGroup]="profileForm" (ngSubmit)="submitProfile()" class="participant-profile-form">
            <app-ui-input
              label="Prénom"
              formControlName="firstName"
              [error]="profileInvalid('firstName') ? 'Requis' : undefined"
            />
            <app-ui-input
              label="Nom"
              formControlName="lastName"
              [error]="profileInvalid('lastName') ? 'Requis' : undefined"
            />
            <app-ui-input label="Email" type="email" formControlName="email" hint="Non modifiable" />
            <app-ui-input label="Téléphone" type="tel" hint="Optionnel" formControlName="phone" />
            <app-ui-button type="submit" [loading]="savingProfile()" class="self-start">Enregistrer</app-ui-button>
          </form>
        </section>

        <section class="participant-pass-panel participant-profile-security">
          <p class="participant-pass-panel-eyebrow">
            <lucide-angular [img]="icons.Shield" [size]="12" class="mr-1 inline"></lucide-angular>
            Sécurité
          </p>
          <h2 class="participant-pass-panel-title">Changer le mot de passe</h2>
          <form [formGroup]="passwordForm" (ngSubmit)="submitPassword()" class="participant-profile-form">
            <app-ui-input
              label="Mot de passe actuel"
              type="password"
              formControlName="currentPassword"
              [error]="passwordInvalid('currentPassword') ? 'Requis' : undefined"
            />
            <app-ui-input
              label="Nouveau mot de passe"
              type="password"
              formControlName="newPassword"
              [error]="passwordInvalid('newPassword') ? '8 caractères minimum.' : undefined"
            />
            <app-ui-input
              label="Confirmer le nouveau mot de passe"
              type="password"
              formControlName="confirmPassword"
              [error]="
                passwordForm.errors?.['passwordsMismatch'] && passwordForm.controls.confirmPassword.touched
                  ? 'Les mots de passe ne correspondent pas.'
                  : undefined
              "
            />
            <app-ui-button type="submit" variant="secondary" [loading]="savingPassword()" class="self-start">
              Mettre à jour le mot de passe
            </app-ui-button>
          </form>
        </section>
      </div>
    </div>
  `
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Sparkles, LayoutDashboard, UserRound, Shield };

  protected readonly user = this.authStore.user;
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);

  protected readonly displayName = computed(() => {
    const user = this.user();
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  });

  protected readonly profileForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    email: [{ value: '', disabled: true }]
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') }
  );

  constructor() {
    effect(() => {
      const user = this.user();
      if (user) {
        this.profileForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? '',
          email: user.email
        });
      }
    });
  }

  protected profileInvalid(name: keyof typeof this.profileForm.controls): boolean {
    const control = this.profileForm.controls[name];
    return control.invalid && control.touched;
  }

  protected passwordInvalid(name: keyof typeof this.passwordForm.controls): boolean {
    const control = this.passwordForm.controls[name];
    return control.invalid && control.touched;
  }

  protected submitProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) return;

    const userId = this.user()?.id;
    if (!userId) return;

    const { firstName, lastName, phone } = this.profileForm.getRawValue();
    this.savingProfile.set(true);

    this.userService.updateProfile(userId, { firstName, lastName, phone: phone || undefined }).subscribe({
      next: (user) => {
        this.authStore.setUser(user);
        this.savingProfile.set(false);
        this.toast.success('Profil mis à jour avec succès.');
      },
      error: (error: HttpErrorResponse) => {
        this.savingProfile.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de mettre à jour le profil.'));
      }
    });
  }

  protected submitPassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success('Mot de passe mis à jour avec succès.');
      },
      error: (error: HttpErrorResponse) => {
        this.savingPassword.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de mettre à jour le mot de passe.'));
      }
    });
  }
}
