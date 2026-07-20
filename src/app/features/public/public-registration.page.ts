import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  PublicCreateRegistrationPayload,
  PublicRegistrationInfo,
  PublicRegistrationService
} from '../../core/api/public-registration.service';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

type FieldKey = 'firstName' | 'lastName' | 'email' | 'ticketTypeId';

interface StoredRegistrationMarker {
  firstName: string;
  email: string;
}

@Component({
  selector: 'app-public-registration-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, ButtonComponent, SkeletonComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div class="mx-auto max-w-lg">
        @if (loading()) {
          <app-ui-skeleton height="320px" rounded="2xl" />
        } @else if (error()) {
          <div class="rounded-2xl border border-hairline bg-white p-8 text-center shadow-soft">
            <h1 class="text-xl font-bold text-text-primary">Lien indisponible</h1>
            <p class="mt-2 text-sm text-text-secondary">{{ error() }}</p>
          </div>
        } @else if (alreadyRegistered()) {
          <div class="rounded-2xl border border-hairline bg-white p-8 text-center shadow-soft">
            <h1 class="text-xl font-bold text-text-primary">Vous êtes déjà inscrit</h1>
            <p class="mt-2 text-sm text-text-secondary">
              @if (form.firstName) {
                {{ form.firstName }}, votre place pour
              } @else {
                Votre place pour
              }
              <strong class="text-text-primary">{{ info()?.eventTitle }}</strong>
              est déjà enregistrée.
            </p>
            <p class="mt-3 text-xs text-text-secondary">
              Si vous pensez qu'il s'agit d'une erreur, contactez l'organisateur.
            </p>
          </div>
        } @else if (done()) {
          <div class="rounded-2xl border border-hairline bg-white p-8 text-center shadow-soft">
            <h1 class="text-xl font-bold text-text-primary">Inscription confirmée</h1>
            <p class="mt-2 text-sm text-text-secondary">
              Merci {{ form.firstName }} — votre place pour {{ info()?.eventTitle }} est enregistrée.
            </p>
          </div>
        } @else if (info(); as event) {
          <div class="rounded-2xl border border-hairline bg-white p-6 shadow-soft sm:p-8">
            <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Inscription</p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight text-text-primary">{{ event.eventTitle }}</h1>
            <p class="mt-2 text-sm text-text-secondary">{{ event.shortDescription }}</p>
            <p class="mt-1 text-xs text-text-secondary">
              {{ formatDate(event.startAt) }} · {{ event.city }}
            </p>

            <form class="mt-6 space-y-4" (ngSubmit)="submit()" novalidate>
              <label class="block text-sm">
                <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Prénom</span>
                <input
                  class="mt-1 w-full rounded-lg border px-3 py-2 outline-none transition"
                  [class]="fieldClass('firstName')"
                  [(ngModel)]="form.firstName"
                  name="firstName"
                  autocomplete="given-name"
                  (input)="clearError('firstName')"
                />
                @if (fieldError('firstName'); as msg) {
                  <p class="mt-1.5 text-xs font-medium text-red-600">{{ msg }}</p>
                }
              </label>

              <label class="block text-sm">
                <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Nom</span>
                <input
                  class="mt-1 w-full rounded-lg border px-3 py-2 outline-none transition"
                  [class]="fieldClass('lastName')"
                  [(ngModel)]="form.lastName"
                  name="lastName"
                  autocomplete="family-name"
                  (input)="clearError('lastName')"
                />
                @if (fieldError('lastName'); as msg) {
                  <p class="mt-1.5 text-xs font-medium text-red-600">{{ msg }}</p>
                }
              </label>

              <label class="block text-sm">
                <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</span>
                <input
                  type="email"
                  class="mt-1 w-full rounded-lg border px-3 py-2 outline-none transition"
                  [class]="fieldClass('email')"
                  [(ngModel)]="form.email"
                  name="email"
                  autocomplete="email"
                  (input)="clearError('email')"
                />
                @if (fieldError('email'); as msg) {
                  <p class="mt-1.5 text-xs font-medium text-red-600">{{ msg }}</p>
                }
              </label>

              <label class="block text-sm">
                <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Téléphone</span>
                <input
                  class="mt-1 w-full rounded-lg border border-hairline px-3 py-2 outline-none"
                  [(ngModel)]="form.phone"
                  name="phone"
                  autocomplete="tel"
                />
              </label>

              @if (event.ticketTypes.length > 1) {
                <label class="block text-sm">
                  <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Type de billet</span>
                  <select
                    class="mt-1 w-full rounded-lg border px-3 py-2 outline-none transition"
                    [class]="fieldClass('ticketTypeId')"
                    [(ngModel)]="form.ticketTypeId"
                    name="ticketTypeId"
                    (change)="clearError('ticketTypeId')"
                  >
                    <option value="">Choisir un type</option>
                    @for (type of event.ticketTypes; track type.id) {
                      <option [value]="type.id">{{ type.name }} — {{ type.price }} {{ type.currency }}</option>
                    }
                  </select>
                  @if (fieldError('ticketTypeId'); as msg) {
                    <p class="mt-1.5 text-xs font-medium text-red-600">{{ msg }}</p>
                  }
                </label>
              }

              <app-ui-button type="submit" class="w-full" [disabled]="saving()">
                {{ saving() ? 'Envoi…' : "S'inscrire" }}
              </app-ui-button>
            </form>
          </div>
        }
      </div>
    </div>
  `
})
export class PublicRegistrationPage {
  readonly token = input.required<string>();

  private readonly publicRegistrationService = inject(PublicRegistrationService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly alreadyRegistered = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal<PublicRegistrationInfo | null>(null);
  protected readonly errors = signal<Partial<Record<FieldKey, string>>>({});

  protected form = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ticketTypeId: ''
  };

  constructor() {
    effect(() => {
      const token = this.token();
      if (token) this.load(token);
    });
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected fieldError(key: FieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected fieldClass(key: FieldKey): string {
    return this.errors()[key]
      ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
      : 'border-hairline focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/30';
  }

  protected clearError(key: FieldKey): void {
    if (!this.errors()[key]) return;
    const next = { ...this.errors() };
    delete next[key];
    this.errors.set(next);
  }

  protected submit(): void {
    const token = this.token();
    if (!token) return;

    const nextErrors = this.validate();
    this.errors.set(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    this.saving.set(true);
    const payload: PublicCreateRegistrationPayload = {
      participantFirstName: this.form.firstName.trim(),
      participantLastName: this.form.lastName.trim(),
      participantEmail: this.form.email.trim(),
      participantPhone: this.form.phone.trim() || undefined,
      ticketTypeId: this.form.ticketTypeId || undefined,
      quantity: 1
    };
    this.publicRegistrationService.register(token, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.rememberRegistration(token, {
          firstName: payload.participantFirstName,
          email: payload.participantEmail
        });
        this.done.set(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (this.isAlreadyRegisteredError(err)) {
          this.rememberRegistration(token, {
            firstName: payload.participantFirstName,
            email: payload.participantEmail
          });
          this.alreadyRegistered.set(true);
          return;
        }
        this.toast.error('Inscription impossible. Vérifiez vos informations.');
      }
    });
  }

  private validate(): Partial<Record<FieldKey, string>> {
    const errors: Partial<Record<FieldKey, string>> = {};
    const info = this.info();

    if (!this.form.firstName.trim()) {
      errors.firstName = 'Le prénom est obligatoire.';
    }
    if (!this.form.lastName.trim()) {
      errors.lastName = 'Le nom est obligatoire.';
    }

    const email = this.form.email.trim();
    if (!email) {
      errors.email = "L'email est obligatoire.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Entrez une adresse email valide.';
    }

    if (info && info.ticketTypes.length > 1 && !this.form.ticketTypeId) {
      errors.ticketTypeId = 'Choisissez un type de billet.';
    }

    return errors;
  }

  private load(token: string): void {
    this.loading.set(true);
    this.error.set('');
    this.alreadyRegistered.set(false);
    this.done.set(false);

    const marker = this.readRegistrationMarker(token);
    if (marker) {
      this.form.firstName = marker.firstName;
      this.form.email = marker.email;
    }

    this.publicRegistrationService.getInfo(token).subscribe({
      next: (info) => {
        this.info.set(info);
        const standard = info.ticketTypes.find((t) => t.kind === 'STANDARD') ?? info.ticketTypes[0];
        this.form.ticketTypeId = standard?.id ?? '';
        if (marker) {
          this.alreadyRegistered.set(true);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Ce lien d’inscription est invalide ou a été révoqué.');
        this.loading.set(false);
      }
    });
  }

  private isAlreadyRegisteredError(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 409) {
      return false;
    }
    const code = (err.error as { code?: string } | null)?.code;
    return code === 'ALREADY_REGISTERED';
  }

  private storageKey(token: string): string {
    return `3mb.public-registration.${token}`;
  }

  private rememberRegistration(token: string, marker: StoredRegistrationMarker): void {
    try {
      localStorage.setItem(this.storageKey(token), JSON.stringify(marker));
    } catch {
      // Ignore quota / private mode failures — server check remains authoritative.
    }
  }

  private readRegistrationMarker(token: string): StoredRegistrationMarker | null {
    try {
      const raw = localStorage.getItem(this.storageKey(token));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredRegistrationMarker;
      if (!parsed?.email) return null;
      return {
        firstName: parsed.firstName ?? '',
        email: parsed.email
      };
    } catch {
      return null;
    }
  }
}
