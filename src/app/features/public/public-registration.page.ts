import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  PublicCreateRegistrationPayload,
  PublicRegistrationInfo,
  PublicRegistrationService
} from '../../core/api/public-registration.service';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
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
  imports: [FormsModule, SkeletonComponent, SelectComponent],
  template: `
    <div class="public-reg-page">
      <div class="public-reg-shell">
        @if (loading()) {
          <app-ui-skeleton height="360px" rounded="2xl" />
        } @else if (error()) {
          <div class="public-reg-panel public-reg-status">
            <div class="public-reg-status-icon is-error" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9l-6 6M9 9l6 6" stroke-linecap="round" />
              </svg>
            </div>
            <h1 class="public-reg-title">Lien indisponible</h1>
            <p class="public-reg-lead">{{ error() }}</p>
          </div>
        } @else if (confirmingPayment()) {
          <div class="public-reg-panel public-reg-status">
            <div class="public-reg-spinner mx-auto" aria-hidden="true"></div>
            <h1 class="public-reg-title">Confirmation du paiement</h1>
            <p class="public-reg-lead">Vérification de votre paiement Stripe en cours…</p>
          </div>
        } @else if (alreadyRegistered()) {
          <div class="public-reg-panel public-reg-status">
            <div class="public-reg-status-icon is-warn" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" stroke-linecap="round" />
                <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h1 class="public-reg-title">Vous êtes déjà inscrit</h1>
            <p class="public-reg-lead">
              @if (form.firstName) {
                {{ form.firstName }}, votre place pour
              } @else {
                Votre place pour
              }
              <strong>{{ info()?.eventTitle }}</strong>
              est déjà enregistrée.
            </p>
            <div class="public-reg-ticket-note">
              <strong>Billet</strong>
              Votre billet vous sera envoyé plus tard par l’organisateur.
            </div>
            <p class="public-reg-footnote">
              Si vous pensez qu’il s’agit d’une erreur, contactez l’organisateur.
            </p>
          </div>
        } @else if (done()) {
          <div class="public-reg-panel public-reg-status">
            <div class="public-reg-status-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.4 2.4 4.6-5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h1 class="public-reg-title">Inscription confirmée</h1>
            <p class="public-reg-lead">
              Merci {{ form.firstName }} — votre place pour
              <strong>{{ info()?.eventTitle }}</strong>
              est enregistrée.
            </p>
            <div class="public-reg-ticket-note">
              <strong>Billet</strong>
              Votre billet vous sera envoyé plus tard par l’organisateur.
            </div>
          </div>
        } @else if (info(); as event) {
          <div class="public-reg-panel">
            <p class="public-reg-kicker">Inscription</p>
            <h1 class="public-reg-title">{{ event.eventTitle }}</h1>
            @if (event.shortDescription) {
              <p class="public-reg-lead">{{ event.shortDescription }}</p>
            }
            <div class="public-reg-meta">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15" rx="2" />
                  <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke-linecap="round" />
                </svg>
                {{ formatDate(event.startAt) }}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21z" />
                  <circle cx="12" cy="10.8" r="2.1" />
                </svg>
                {{ event.city }}
              </span>
            </div>

            @if (cancelledPayment()) {
              <div class="public-reg-alert">
                Paiement annulé. Vous pouvez réessayer votre inscription.
              </div>
            }

            <form class="public-reg-form" (ngSubmit)="submit()" novalidate>
              <div class="public-reg-row two">
                <label class="public-reg-field">
                  <span class="public-reg-label">Prénom</span>
                  <input
                    class="public-reg-input"
                    [class.is-invalid]="!!fieldError('firstName')"
                    [(ngModel)]="form.firstName"
                    name="firstName"
                    autocomplete="given-name"
                    (input)="clearError('firstName')"
                  />
                  @if (fieldError('firstName'); as msg) {
                    <p class="public-reg-error">{{ msg }}</p>
                  }
                </label>

                <label class="public-reg-field">
                  <span class="public-reg-label">Nom</span>
                  <input
                    class="public-reg-input"
                    [class.is-invalid]="!!fieldError('lastName')"
                    [(ngModel)]="form.lastName"
                    name="lastName"
                    autocomplete="family-name"
                    (input)="clearError('lastName')"
                  />
                  @if (fieldError('lastName'); as msg) {
                    <p class="public-reg-error">{{ msg }}</p>
                  }
                </label>
              </div>

              <label class="public-reg-field">
                <span class="public-reg-label">Email</span>
                <input
                  type="email"
                  class="public-reg-input"
                  [class.is-invalid]="!!fieldError('email')"
                  [(ngModel)]="form.email"
                  name="email"
                  autocomplete="email"
                  (input)="clearError('email')"
                />
                @if (fieldError('email'); as msg) {
                  <p class="public-reg-error">{{ msg }}</p>
                }
              </label>

              <label class="public-reg-field">
                <span class="public-reg-label">Téléphone</span>
                <input
                  class="public-reg-input"
                  [(ngModel)]="form.phone"
                  name="phone"
                  autocomplete="tel"
                />
              </label>

              @if (event.ticketTypes.length > 1) {
                <app-ui-select
                  label="Type de billet"
                  [options]="ticketTypeOptions()"
                  placeholder="Choisir un type"
                  [(ngModel)]="form.ticketTypeId"
                  name="ticketTypeId"
                  [clearable]="false"
                  [error]="fieldError('ticketTypeId') ?? undefined"
                  (ngModelChange)="clearError('ticketTypeId')"
                />
              } @else if (selectedTicket(); as ticket) {
                <div class="public-reg-fare">
                  <span class="public-reg-fare-label">Tarif</span>
                  <span class="public-reg-fare-value">
                    @if (ticket.price > 0) {
                      {{ ticket.price }} {{ ticket.currency }}
                    } @else {
                      Gratuit
                    }
                  </span>
                </div>
              }

              <button type="submit" class="public-reg-submit" [disabled]="saving()">
                {{ submitLabel() }}
              </button>
              <p class="public-reg-footnote">
                En vous inscrivant, vous confirmez vos informations pour cet événement.
              </p>
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly confirmingPayment = signal(false);
  protected readonly done = signal(false);
  protected readonly alreadyRegistered = signal(false);
  protected readonly cancelledPayment = signal(false);
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

  protected selectedTicket() {
    const info = this.info();
    if (!info) return null;
    return info.ticketTypes.find((t) => t.id === this.form.ticketTypeId) ?? info.ticketTypes[0] ?? null;
  }

  protected ticketTypeOptions(): SelectOption[] {
    const info = this.info();
    if (!info) return [];
    return info.ticketTypes.map((type) => ({
      value: type.id,
      label: `${type.name} — ${type.price} ${type.currency}`
    }));
  }

  protected submitLabel(): string {
    if (this.saving()) return 'Envoi…';
    const ticket = this.selectedTicket();
    if (ticket && ticket.price > 0) {
      return `Payer ${ticket.price} ${ticket.currency}`;
    }
    return "S'inscrire";
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
      ticketTypeId: this.form.ticketTypeId || undefined
    };
    this.publicRegistrationService.register(token, payload).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
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
        this.toast.error(this.extractErrorMessage(err, 'Inscription impossible. Vérifiez vos informations.'));
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
    this.cancelledPayment.set(false);
    this.confirmingPayment.set(false);

    const query = this.route.snapshot.queryParamMap;
    const sessionId = query.get('session_id');
    const cancelled = query.get('cancelled') === '1';

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

        if (sessionId) {
          this.loading.set(false);
          this.confirmCheckout(token, sessionId);
          return;
        }

        if (cancelled) {
          this.cancelledPayment.set(true);
          this.clearCheckoutQueryParams();
        }

        if (marker && !cancelled) {
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

  private confirmCheckout(token: string, sessionId: string): void {
    this.confirmingPayment.set(true);
    this.publicRegistrationService.confirmCheckout(token, sessionId).subscribe({
      next: (registration) => {
        this.confirmingPayment.set(false);
        this.form.firstName = registration.participantFirstName;
        this.form.email = registration.participantEmail;
        this.rememberRegistration(token, {
          firstName: registration.participantFirstName,
          email: registration.participantEmail
        });
        this.clearCheckoutQueryParams();
        this.done.set(true);
        this.toast.success('Paiement confirmé — inscription validée.');
      },
      error: (err: unknown) => {
        this.confirmingPayment.set(false);
        this.clearCheckoutQueryParams();
        this.toast.error(
          this.extractErrorMessage(err, 'Le paiement n’a pas pu être confirmé. Réessayez ou contactez l’organisateur.')
        );
      }
    });
  }

  private clearCheckoutQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  private isAlreadyRegisteredError(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 409) {
      return false;
    }
    const code = (err.error as { code?: string } | null)?.code;
    return code === 'ALREADY_REGISTERED';
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const message = (err.error as { message?: string } | null)?.message;
      if (message?.trim()) return message;
    }
    return fallback;
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
