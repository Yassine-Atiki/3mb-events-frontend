import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CircleCheck, LucideAngularModule, Minus, Plus } from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { PaymentService } from '../../core/api/payment.service';
import { RegistrationService } from '../../core/api/registration.service';
import { TicketService } from '../../core/api/ticket.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Event, PaymentIntent, Registration, TicketType } from '../../core/models';
import { StripePaymentPlaceholderComponent } from '../../shared/participant/stripe-payment-placeholder.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { CardComponent } from '../../shared/ui/card/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface StepDef {
  id: string;
  label: string;
}

const STEPS: StepDef[] = [
  { id: 'ticket', label: 'Billet' },
  { id: 'info', label: 'Informations' },
  { id: 'paiement', label: 'Paiement' },
  { id: 'confirmation', label: 'Confirmation' }
];

function extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const message = (error.error as { message?: string } | null)?.message;
  return message ?? fallback;
}

@Component({
  selector: 'app-reservation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    LucideAngularModule,
    ButtonComponent,
    CardComponent,
    InputComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StripePaymentPlaceholderComponent
  ],
  template: `
    <div class="mx-auto max-w-4xl space-y-8">
      @if (loading()) {
        <div class="space-y-4">
          <app-ui-skeleton height="1.5rem" width="50%" />
          <app-ui-skeleton height="200px" rounded="2xl" />
        </div>
      } @else if (!event()) {
        <app-ui-empty-state title="Événement introuvable" description="Cet événement n'existe pas ou a été retiré." />
      } @else {
        <div class="space-y-8">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">Réservation</h1>
          <p class="mt-1 text-sm text-text-secondary">
            {{ event()!.title }} · {{ formatDateTime(event()!.startAt) }} · {{ event()!.city }}
          </p>
        </div>

        <!-- Detached step stubs -->
        <div class="flex flex-col gap-3 sm:flex-row sm:gap-4">
          @for (step of steps; track step.id; let i = $index) {
            <div
              class="booking-stub"
              [class.booking-stub-active]="currentIndex() === i"
              [class.booking-stub-done]="currentIndex() > i"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                    Étape {{ i + 1 }}
                  </div>
                  <div class="truncate text-sm font-semibold text-text-primary">{{ step.label }}</div>
                </div>
                @if (currentIndex() > i) {
                  <span
                    class="ink-stamp inline-flex shrink-0 items-center justify-center rounded-md border-2 border-brand-teal-dark px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-teal-dark"
                  >
                    Validé
                  </span>
                } @else {
                  <span
                    class="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold tabular-nums"
                    [class.bg-brand-teal]="currentIndex() === i"
                    [class.text-white]="currentIndex() === i"
                    [class.bg-surface-muted]="currentIndex() !== i"
                    [class.text-text-secondary]="currentIndex() !== i"
                  >
                    {{ i + 1 }}
                  </span>
                }
              </div>
            </div>
          }
        </div>

        @if (submitting()) {
          <p class="mt-3 text-center text-sm font-medium text-brand-teal-dark">Traitement de votre réservation...</p>
        }

        <div>
          @switch (currentIndex()) {
            @case (0) {
              <app-ui-card title="Choisissez votre billet">
                @if (ticketTypes().length === 0) {
                  <p class="text-sm text-text-secondary">Aucun billet disponible pour cet événement.</p>
                } @else {
                  <div class="space-y-2">
                    @for (tt of ticketTypes(); track tt.id) {
                      <button
                        type="button"
                        class="w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-150"
                        [class]="
                          selectedTicketId() === tt.id
                            ? 'border-brand-teal bg-brand-teal/5'
                            : 'border-gray-200 hover:border-brand-teal/40 hover:bg-surface-light'
                        "
                        [disabled]="remaining(tt) <= 0"
                        (click)="selectTicket(tt.id)"
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-sm font-semibold text-text-primary">{{ tt.name }}</span>
                          <span class="text-sm font-bold text-brand-teal-dark">
                            {{ tt.price === 0 ? 'Gratuit' : tt.price + ' ' + tt.currency }}
                          </span>
                        </div>
                        <div class="mt-1 text-xs text-text-secondary">
                          {{ remaining(tt) > 0 ? remaining(tt) + ' places restantes' : 'Épuisé' }}
                        </div>
                      </button>
                    }
                  </div>

                  @if (selectedTicket(); as tt) {
                    <div class="mt-5 flex items-center justify-between rounded-xl bg-surface-light p-3">
                      <span class="text-sm font-medium text-text-primary">Quantité</span>
                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-text-primary transition-colors hover:border-brand-teal/40 hover:bg-brand-teal/5 disabled:cursor-not-allowed disabled:opacity-40"
                          [disabled]="quantity() <= 1"
                          (click)="changeQuantity(-1)"
                        >
                          <lucide-angular [img]="icons.Minus" [size]="14"></lucide-angular>
                        </button>
                        <span class="w-4 text-center text-sm font-semibold">{{ quantity() }}</span>
                        <button
                          type="button"
                          class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-text-primary transition-colors hover:border-brand-teal/40 hover:bg-brand-teal/5 disabled:cursor-not-allowed disabled:opacity-40"
                          [disabled]="quantity() >= maxQuantity(tt)"
                          (click)="changeQuantity(1)"
                        >
                          <lucide-angular [img]="icons.Plus" [size]="14"></lucide-angular>
                        </button>
                      </div>
                    </div>

                    <div class="mt-4 flex items-center justify-between text-sm">
                      <span class="text-text-secondary">Total</span>
                      <span class="text-lg font-bold text-text-primary">{{ totalPrice() }} {{ tt.currency }}</span>
                    </div>
                  }
                }
              </app-ui-card>
            }
            @case (1) {
              <app-ui-card title="Vos informations">
                <form [formGroup]="participantForm" class="grid gap-4 sm:grid-cols-2">
                  <app-ui-input
                    label="Prénom"
                    formControlName="firstName"
                    [error]="participantInvalid('firstName') ? 'Requis' : undefined"
                  />
                  <app-ui-input
                    label="Nom"
                    formControlName="lastName"
                    [error]="participantInvalid('lastName') ? 'Requis' : undefined"
                  />
                  <app-ui-input
                    label="Adresse email"
                    type="email"
                    formControlName="email"
                    [error]="participantInvalid('email') ? 'Adresse email invalide.' : undefined"
                  />
                  <app-ui-input label="Téléphone" type="tel" hint="Optionnel" formControlName="phone" />
                </form>
              </app-ui-card>
            }
            @case (2) {
              <!-- Summary, with the Stripe placeholder step attached beneath it (same dashed edge) -->
              <div class="overflow-hidden rounded-t-2xl border border-b-0 border-hairline bg-surface-white">
                <div class="border-b border-hairline px-5 py-4">
                  <h2 class="text-base font-semibold text-text-primary">Récapitulatif</h2>
                </div>
                <div class="space-y-2 px-5 py-4 text-sm">
                  <div class="flex justify-between">
                    <span class="text-text-secondary">{{ selectedTicket()?.name }} × {{ quantity() }}</span>
                    <span class="font-mono tabular-nums text-text-primary">{{ totalPrice() }} {{ selectedTicket()?.currency }}</span>
                  </div>
                  <div class="flex items-center justify-between border-t border-hairline pt-2">
                    <span class="font-medium text-text-primary">Total à payer</span>
                    <span class="font-mono text-lg font-bold tabular-nums text-brand-teal-dark">
                      {{ totalPrice() }} {{ selectedTicket()?.currency }}
                    </span>
                  </div>
                </div>
              </div>

              <app-stripe-payment-placeholder
                [amount]="totalPrice()"
                [currency]="selectedTicket()?.currency ?? 'MAD'"
                [processing]="submitting()"
                (confirm)="submitReservation()"
              />
            }
            @case (3) {
              <app-ui-card>
                <div class="flex flex-col items-center gap-3 py-6 text-center">
                  <div class="grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-600">
                    <lucide-angular [img]="icons.CircleCheck" [size]="32"></lucide-angular>
                  </div>
                  <h2 class="text-xl font-bold text-text-primary">Réservation confirmée !</h2>
                  <p class="max-w-md text-sm text-text-secondary">
                    Votre réservation pour <strong>{{ event()!.title }}</strong> a bien été enregistrée.
                    @if (registration()?.status === 'PENDING') {
                      Elle est en attente de confirmation du paiement.
                    }
                  </p>

                  @if (registration(); as reg) {
                    <div class="mt-2 w-full max-w-sm space-y-2 rounded-xl bg-surface-light p-4 text-left text-sm">
                      <div class="flex justify-between">
                        <span class="text-text-secondary">Référence</span>
                        <span class="font-semibold text-text-primary">{{ reg.id }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-text-secondary">Quantité</span>
                        <span class="font-semibold text-text-primary">{{ reg.quantity }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-text-secondary">Total</span>
                        <span class="font-semibold text-text-primary">{{ reg.totalPrice }} {{ reg.currency }}</span>
                      </div>
                      @if (paymentIntent(); as intent) {
                        <div class="flex justify-between">
                          <span class="text-text-secondary">Paiement</span>
                          <span class="font-semibold text-text-primary">{{ intent.status }}</span>
                        </div>
                      }
                    </div>
                  }

                  <div class="mt-4 flex flex-wrap justify-center gap-3">
                    <a routerLink="/app/mes-inscriptions"><app-ui-button>Voir mes inscriptions</app-ui-button></a>
                    <a routerLink="/app/tableau-de-bord"><app-ui-button variant="secondary">Tableau de bord</app-ui-button></a>
                  </div>
                </div>
              </app-ui-card>
            }
          }
        </div>

        @if (currentIndex() < 3) {
          <div class="flex items-center justify-between border-t border-hairline pt-5">
            <app-ui-button
              type="button"
              variant="secondary"
              [disabled]="currentIndex() === 0 || submitting()"
              (clicked)="handlePrev()"
            >
              Précédent
            </app-ui-button>
            @if (currentIndex() < 2) {
              <app-ui-button type="button" (clicked)="handleNext()">Continuer</app-ui-button>
            }
          </div>
        }
        </div>
      }
    </div>
  `
})
export class ReservationPage {
  readonly eventId = input<string>('');

  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly registrationService = inject(RegistrationService);
  private readonly paymentService = inject(PaymentService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Minus, Plus, CircleCheck };
  protected readonly steps = STEPS;

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly event = signal<Event | null>(null);
  protected readonly ticketTypes = signal<TicketType[]>([]);
  protected readonly selectedTicketId = signal<string | null>(null);
  protected readonly quantity = signal(1);
  protected readonly currentIndex = signal(0);
  protected readonly registration = signal<Registration | null>(null);
  protected readonly paymentIntent = signal<PaymentIntent | null>(null);

  protected readonly participantForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['']
  });

  protected selectedTicket(): TicketType | null {
    return this.ticketTypes().find((tt) => tt.id === this.selectedTicketId()) ?? null;
  }

  protected totalPrice(): number {
    const tt = this.selectedTicket();
    return tt ? tt.price * this.quantity() : 0;
  }

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.load(id);
    });

    effect(() => {
      const user = this.authStore.user();
      if (user) {
        this.participantForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ?? ''
        });
      }
    });
  }

  protected remaining(tt: TicketType): number {
    return tt.quantityTotal - tt.quantitySold;
  }

  protected maxQuantity(tt: TicketType): number {
    return Math.max(1, Math.min(tt.maxPerOrder ?? 10, this.remaining(tt)));
  }

  protected selectTicket(id: string): void {
    this.selectedTicketId.set(id);
    this.quantity.set(1);
  }

  protected changeQuantity(delta: number): void {
    const tt = this.selectedTicket();
    if (!tt) return;
    const next = this.quantity() + delta;
    this.quantity.set(Math.min(Math.max(next, 1), this.maxQuantity(tt)));
  }

  protected participantInvalid(name: keyof typeof this.participantForm.controls): boolean {
    const control = this.participantForm.controls[name];
    return control.invalid && control.touched;
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected handleNext(): void {
    if (this.submitting() || this.registration()) return;

    const idx = this.currentIndex();

    if (idx === 0) {
      if (!this.selectedTicket()) {
        this.toast.error('Veuillez sélectionner un billet.');
        return;
      }
      this.currentIndex.set(1);
      return;
    }

    if (idx === 1) {
      this.participantForm.markAllAsTouched();
      if (this.participantForm.invalid) return;
      this.currentIndex.set(2);
    }
  }

  protected handlePrev(): void {
    if (this.submitting() || this.registration()) return;
    this.currentIndex.update((i) => Math.max(0, i - 1));
  }

  protected submitReservation(): void {
    if (this.submitting() || this.registration()) return;

    const event = this.event();
    const ticketType = this.selectedTicket();
    if (!event || !ticketType) return;

    this.submitting.set(true);

    this.registrationService
      .create({ eventId: event.id, ticketTypeId: ticketType.id, quantity: this.quantity() })
      .subscribe({
        next: (registration) => {
          this.registration.set(registration);

          if (registration.totalPrice > 0) {
            this.paymentService
              .createIntent({
                registrationId: registration.id,
                amount: registration.totalPrice,
                currency: registration.currency
              })
              .subscribe({
                next: (intent) => {
                  this.paymentIntent.set(intent);
                  this.finishSubmission();
                },
                error: () => {
                  this.finishSubmission();
                  this.toast.error("Votre réservation est enregistrée, mais le paiement n'a pas pu être initié.");
                }
              });
          } else {
            this.finishSubmission();
          }
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.toast.error(extractErrorMessage(error, 'Impossible de finaliser la réservation.'));
        }
      });
  }

  private finishSubmission(): void {
    this.submitting.set(false);
    this.currentIndex.set(3);
    this.toast.success('Réservation confirmée !');
  }

  private load(id: string): void {
    this.loading.set(true);
    this.eventService.getById(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);

        this.ticketService.getTicketTypesByEvent(event.id).subscribe((types) => {
          this.ticketTypes.set(types);
          const firstAvailable = types.find((tt) => this.remaining(tt) > 0);
          if (firstAvailable) this.selectTicket(firstAvailable.id);
        });
      },
      error: () => {
        this.event.set(null);
        this.loading.set(false);
      }
    });
  }
}
