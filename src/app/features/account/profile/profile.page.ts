import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Camera,
  LayoutDashboard,
  LucideAngularModule,
  Shield,
  Sparkles,
  Trash2,
  UserRound
} from 'lucide-angular';

import { AuthService, TotpSetupResponse } from '../../../core/api/auth.service';
import { UserService } from '../../../core/api/user.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { passwordsMatchValidator } from '../../../shared/utils/validators';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const message = (error.error as { message?: string } | null)?.message;
  return message ?? fallback;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
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
            Photo, informations personnelles et sécurité de votre compte, au même endroit.
          </p>
        </div>
        <a [routerLink]="dashboardLink()" class="participant-quick-nav-chip">
          <lucide-angular [img]="icons.LayoutDashboard" [size]="14"></lucide-angular>
          Tableau de bord
        </a>
      </header>

      <section class="participant-profile-hero" aria-label="Identité du compte">
        <div class="participant-profile-hero-scrim" aria-hidden="true"></div>
        <div class="participant-profile-hero-content">
          <div class="participant-profile-avatar-block">
            <div class="participant-profile-avatar-ring">
              <app-ui-avatar [name]="displayName()" [url]="user()?.avatarUrl" size="lg" />
            </div>

            <div class="participant-profile-avatar-actions">
              <input
                #avatarInput
                type="file"
                class="sr-only"
                accept="image/jpeg,image/png,image/webp,image/gif"
                (change)="onAvatarSelected($event)"
              />
              <button
                type="button"
                class="participant-profile-avatar-btn"
                [disabled]="uploadingAvatar()"
                (click)="openAvatarPicker()"
              >
                <lucide-angular [img]="icons.Camera" [size]="14"></lucide-angular>
                {{ uploadingAvatar() ? 'Envoi…' : user()?.avatarUrl ? 'Changer la photo' : 'Ajouter une photo' }}
              </button>
              @if (user()?.avatarUrl) {
                <button
                  type="button"
                  class="participant-profile-avatar-btn participant-profile-avatar-btn--ghost"
                  [disabled]="uploadingAvatar()"
                  (click)="removeAvatar()"
                >
                  <lucide-angular [img]="icons.Trash2" [size]="14"></lucide-angular>
                  Retirer
                </button>
              }
            </div>
            <p class="participant-profile-avatar-hint">JPG, PNG ou WebP — 2 Mo max.</p>
          </div>

          <div>
            <h2 class="participant-profile-identity-name">{{ displayName() }}</h2>
            <p class="participant-profile-identity-email">{{ user()?.email }}</p>
            <app-ui-badge class="mt-2.5 inline-block" tone="teal">{{ roleLabel() }}</app-ui-badge>
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

      <div class="participant-profile-2fa-row">
        <section class="participant-pass-panel participant-profile-security participant-profile-2fa">
          <p class="participant-pass-panel-eyebrow">
            <lucide-angular [img]="icons.Shield" [size]="12" class="mr-1 inline"></lucide-angular>
            Authentification à deux facteurs
          </p>
          <h2 class="participant-pass-panel-title">Application TOTP</h2>
          <p class="mt-2 text-sm text-text-secondary">
            Compatible avec Google Authenticator, Authy, Microsoft Authenticator et toute app TOTP.
          </p>

          @if (user()?.totpEnabled) {
            <div class="mt-4 mb-3 flex flex-wrap items-center gap-2">
              <app-ui-badge tone="teal">Activée</app-ui-badge>
            </div>
            <form [formGroup]="disable2faForm" (ngSubmit)="disable2fa()" class="flex flex-col gap-3">
              <app-ui-input
                label="Code pour désactiver"
                placeholder="123456 ou code de récupération"
                formControlName="code"
                [error]="
                  disable2faForm.controls.code.invalid && disable2faForm.controls.code.touched
                    ? 'Requis'
                    : undefined
                "
              />
              <app-ui-button type="submit" variant="secondary" [loading]="disabling2fa()" class="self-start">
                Désactiver la 2FA
              </app-ui-button>
            </form>
          } @else if (recoveryCodes()?.length) {
            <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <p class="text-sm font-semibold text-amber-900">Codes de récupération</p>
              <p class="mt-1 text-xs text-amber-800">
                Conservez-les en lieu sûr. Chaque code ne fonctionne qu’une fois. Ils ne seront plus réaffichés.
              </p>
              <ul class="mt-3 grid gap-1 font-mono text-sm text-amber-950 sm:grid-cols-2">
                @for (code of recoveryCodes(); track code) {
                  <li>{{ code }}</li>
                }
              </ul>
              <div class="mt-4 flex flex-wrap gap-2">
                <app-ui-button type="button" variant="secondary" (clicked)="copyRecoveryCodes()">
                  Copier
                </app-ui-button>
                <app-ui-button type="button" (clicked)="dismissRecoveryCodes()">
                  J’ai sauvegardé mes codes
                </app-ui-button>
              </div>
            </div>
          } @else if (setup()) {
            <div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <img
                [src]="setup()!.qrCodeDataUrl"
                alt="QR code 2FA"
                class="mx-auto h-40 w-40 shrink-0 rounded-xl border border-gray-200 bg-white p-2 sm:mx-0"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-3">
                <p class="text-sm text-text-secondary">
                  Scannez le QR code, ou saisissez ce secret manuellement&nbsp;:
                </p>
                <code class="break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-text-primary">{{
                  setup()!.secret
                }}</code>
                <form [formGroup]="enable2faForm" (ngSubmit)="confirmEnable2fa()" class="flex flex-col gap-3">
                  <app-ui-input
                    label="Code de confirmation"
                    placeholder="123456"
                    formControlName="code"
                    [error]="
                      enable2faForm.controls.code.invalid && enable2faForm.controls.code.touched
                        ? '6 chiffres requis'
                        : undefined
                    "
                  />
                  <div class="flex flex-wrap gap-2">
                    <app-ui-button type="submit" [loading]="enabling2fa()">Activer</app-ui-button>
                    <app-ui-button type="button" variant="secondary" (clicked)="cancelSetup()">
                      Annuler
                    </app-ui-button>
                  </div>
                </form>
              </div>
            </div>
          } @else {
            <div class="mt-4">
              <app-ui-button type="button" [loading]="starting2fa()" (clicked)="start2faSetup()">
                Activer la 2FA
              </app-ui-button>
            </div>
          }
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

  private readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');

  protected readonly icons = { Sparkles, LayoutDashboard, UserRound, Shield, Camera, Trash2 };

  protected readonly user = this.authStore.user;
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly uploadingAvatar = signal(false);
  protected readonly starting2fa = signal(false);
  protected readonly enabling2fa = signal(false);
  protected readonly disabling2fa = signal(false);
  protected readonly setup = signal<TotpSetupResponse | null>(null);
  protected readonly recoveryCodes = signal<string[] | null>(null);

  protected readonly enable2faForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  protected readonly disable2faForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly displayName = computed(() => {
    const user = this.user();
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  });

  protected readonly roleLabel = computed(() => {
    switch (this.user()?.role) {
      case 'ORGANIZER':
        return 'Organisateur';
      case 'ADMIN':
        return 'Administrateur';
      default:
        return 'Participant';
    }
  });

  protected readonly dashboardLink = computed(() => {
    switch (this.user()?.role) {
      case 'ORGANIZER':
        return '/organisateur/tableau-de-bord';
      case 'ADMIN':
        return '/admin/tableau-de-bord';
      default:
        return '/403';
    }
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

  protected openAvatarPicker(): void {
    this.avatarInput()?.nativeElement.click();
  }

  protected async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.toast.error('Format non supporté. Utilisez JPG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.toast.error('La photo doit faire 2 Mo maximum.');
      return;
    }

    const userId = this.user()?.id;
    if (!userId) return;

    this.uploadingAvatar.set(true);
    try {
      const avatarUrl = await readFileAsDataUrl(file);
      this.userService.updateProfile(userId, { avatarUrl }).subscribe({
        next: (user) => {
          this.authStore.setUser(user);
          this.uploadingAvatar.set(false);
          this.toast.success('Photo de profil mise à jour.');
        },
        error: (error: HttpErrorResponse) => {
          this.uploadingAvatar.set(false);
          this.toast.error(extractErrorMessage(error, 'Impossible de mettre à jour la photo.'));
        }
      });
    } catch {
      this.uploadingAvatar.set(false);
      this.toast.error('Impossible de lire cette image.');
    }
  }

  protected removeAvatar(): void {
    const userId = this.user()?.id;
    if (!userId) return;

    this.uploadingAvatar.set(true);
    this.userService.updateProfile(userId, { avatarUrl: '' }).subscribe({
      next: (user) => {
        this.authStore.setUser({ ...user, avatarUrl: undefined });
        this.uploadingAvatar.set(false);
        this.toast.success('Photo de profil retirée.');
      },
      error: (error: HttpErrorResponse) => {
        this.uploadingAvatar.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de retirer la photo.'));
      }
    });
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

  protected start2faSetup(): void {
    this.starting2fa.set(true);
    this.authService.setup2fa().subscribe({
      next: (setup) => {
        this.setup.set(setup);
        this.enable2faForm.reset();
        this.starting2fa.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.starting2fa.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de démarrer la 2FA.'));
      }
    });
  }

  protected cancelSetup(): void {
    this.setup.set(null);
    this.enable2faForm.reset();
  }

  protected confirmEnable2fa(): void {
    this.enable2faForm.markAllAsTouched();
    if (this.enable2faForm.invalid) return;

    const { code } = this.enable2faForm.getRawValue();
    this.enabling2fa.set(true);
    this.authService.enable2fa(code).subscribe({
      next: (res) => {
        this.enabling2fa.set(false);
        this.setup.set(null);
        this.recoveryCodes.set(res.recoveryCodes);
        this.authService.me().subscribe({
          next: (user) => this.authStore.setUser(user),
          error: () => {
            const cached = this.user();
            if (cached) {
              this.authStore.setUser({ ...cached, totpEnabled: true });
            }
          }
        });
        this.toast.success('Authentification à deux facteurs activée.');
      },
      error: (error: HttpErrorResponse) => {
        this.enabling2fa.set(false);
        this.toast.error(extractErrorMessage(error, 'Code invalide.'));
      }
    });
  }

  protected copyRecoveryCodes(): void {
    const codes = this.recoveryCodes();
    if (!codes?.length) return;
    void navigator.clipboard.writeText(codes.join('\n')).then(
      () => this.toast.success('Codes copiés.'),
      () => this.toast.error('Impossible de copier automatiquement.')
    );
  }

  protected dismissRecoveryCodes(): void {
    this.recoveryCodes.set(null);
  }

  protected disable2fa(): void {
    this.disable2faForm.markAllAsTouched();
    if (this.disable2faForm.invalid) return;

    const { code } = this.disable2faForm.getRawValue();
    this.disabling2fa.set(true);
    this.authService.disable2fa(code.trim()).subscribe({
      next: () => {
        this.disabling2fa.set(false);
        this.disable2faForm.reset();
        this.authService.me().subscribe({
          next: (user) => this.authStore.setUser(user),
          error: () => {
            const cached = this.user();
            if (cached) {
              this.authStore.setUser({ ...cached, totpEnabled: false });
            }
          }
        });
        this.toast.success('Authentification à deux facteurs désactivée.');
      },
      error: (error: HttpErrorResponse) => {
        this.disabling2fa.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de désactiver la 2FA.'));
      }
    });
  }
}
