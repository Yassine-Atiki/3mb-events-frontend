import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Banknote, ClipboardList, LucideAngularModule, Sparkles } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventService } from '../../core/api/event.service';
import { RefundService } from '../../core/api/refund.service';
import { RegistrationService } from '../../core/api/registration.service';
import { Event, RefundRequest, RefundStatus, Registration } from '../../core/models';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { refundStatusBadge } from './utils/status-badges.util';

type RefundFilter = 'all' | 'pending' | 'done' | 'rejected';

interface RefundFilterDef {
  id: RefundFilter;
  label: string;
  accent: string;
}

const REFUND_FILTERS: RefundFilterDef[] = [
  { id: 'all', label: 'Toutes', accent: '#6366F1' },
  { id: 'pending', label: 'En cours', accent: '#F59E0B' },
  { id: 'done', label: 'Remboursées', accent: '#22C55E' },
  { id: 'rejected', label: 'Rejetées', accent: '#F43F5E' }
];

const STATUS_ACCENT: Record<RefundStatus, string> = {
  REQUESTED: '#F59E0B',
  APPROVED: '#53B29A',
  REJECTED: '#F43F5E',
  PROCESSED: '#22C55E'
};

function extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
  const message = (error.error as { message?: string } | null)?.message;
  return message ?? fallback;
}

@Component({
  selector: 'app-refunds-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    BadgeComponent,
    SelectComponent,
    SkeletonComponent
  ],
  template: `
    <div class="participant-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="participant-lounge-badge mb-3">
            <lucide-angular [img]="icons.Banknote" [size]="12"></lucide-angular>
            <span>Portefeuille</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Remboursements</h1>
          <p class="mt-1 max-w-2xl text-base text-text-secondary">
            Demandez un remboursement et suivez chaque étape jusqu'au versement.
          </p>
        </div>
        <a routerLink="/app/mes-inscriptions" class="participant-quick-nav-chip">
          <lucide-angular [img]="icons.ClipboardList" [size]="14"></lucide-angular>
          Mes inscriptions
        </a>
      </header>

      @if (loading()) {
        <div class="flex flex-col gap-4">
          <app-ui-skeleton height="108px" rounded="2xl" />
          <app-ui-skeleton height="220px" rounded="2xl" />
          <app-ui-skeleton height="140px" rounded="2xl" />
        </div>
      } @else {
        <section class="participant-reg-metrics" role="tablist" aria-label="Filtrer les remboursements">
          @for (filter of filters; track filter.id) {
            <button
              type="button"
              role="tab"
              class="participant-reg-metric"
              [class.participant-reg-metric--active]="activeFilter() === filter.id"
              [style.--pass-metric-accent]="filter.accent"
              [attr.aria-selected]="activeFilter() === filter.id"
              (click)="activeFilter.set(filter.id)"
            >
              <span class="participant-reg-metric-label">{{ filter.label }}</span>
              <span class="participant-reg-metric-value">{{ countFor(filter.id) }}</span>
            </button>
          }
        </section>

        @if (eligibleRegistrations().length > 0) {
          <section class="participant-pass-panel participant-refund-compose">
            <p class="participant-pass-panel-eyebrow">Nouvelle demande</p>
            <h2 class="participant-pass-panel-title">Demander un remboursement</h2>
            <form [formGroup]="form" (ngSubmit)="submit()" class="participant-refund-form">
              <app-ui-select
                label="Inscription concernée"
                formControlName="registrationId"
                [options]="registrationOptions()"
                [error]="invalid('registrationId') ? 'Veuillez sélectionner une inscription.' : undefined"
              />
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-text-primary" for="refund-reason">Motif de la demande</label>
                <textarea
                  id="refund-reason"
                  formControlName="reason"
                  rows="4"
                  placeholder="Expliquez la raison de votre demande de remboursement..."
                  class="participant-refund-textarea"
                  [class.participant-refund-textarea--invalid]="invalid('reason')"
                ></textarea>
                @if (invalid('reason')) {
                  <span class="text-xs text-red-500">Merci de préciser un motif d'au moins 10 caractères.</span>
                }
              </div>
              <app-ui-button type="submit" [loading]="submitting()" class="self-start">
                Envoyer la demande
              </app-ui-button>
            </form>
          </section>
        }

        <section>
          <p class="participant-pass-panel-eyebrow">Historique</p>
          <h2 class="participant-pass-panel-title">Mes demandes</h2>

          @if (filteredRefunds().length === 0) {
            <div class="participant-pass-empty mt-6">
              <div class="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/20">
                <lucide-angular [img]="icons.Banknote" [size]="36" class="text-brand-teal"></lucide-angular>
              </div>
              <h3 class="mb-2 text-lg font-semibold text-text-primary">Aucune demande</h3>
              <p class="text-text-secondary">{{ emptyDescription() }}</p>
            </div>
          } @else {
            <div class="participant-refund-stack mt-5" role="tabpanel">
              @for (refund of filteredRefunds(); track refund.id) {
                <article
                  class="participant-refund-card"
                  [class.participant-refund-card--pending]="refund.status === 'REQUESTED' || refund.status === 'APPROVED'"
                  [style.--refund-accent]="accentFor(refund.status)"
                >
                  <div class="participant-refund-card-cover">
                    <span class="participant-refund-card-accent" aria-hidden="true"></span>
                    @if (eventsById()[refund.eventId]?.coverImageUrl; as cover) {
                      <img [src]="cover" alt="" />
                    }
                  </div>

                  <div class="participant-refund-card-main">
                    <app-ui-badge [tone]="statusConfig(refund).tone">{{ statusConfig(refund).label }}</app-ui-badge>
                    <h3 class="participant-refund-card-title">
                      {{ eventsById()[refund.eventId]?.title ?? 'Événement' }}
                    </h3>
                    <p class="participant-refund-card-meta">
                      Demandée le {{ formatDate(refund.requestedAt) }}
                      @if (refund.processedAt) {
                        · Traitée le {{ formatDate(refund.processedAt) }}
                      }
                    </p>
                    <p class="participant-refund-card-reason">« {{ refund.reason }} »</p>
                    @if (refund.adminNote) {
                      <p class="participant-refund-card-note"><strong>Note :</strong> {{ refund.adminNote }}</p>
                    }
                  </div>

                  <div class="participant-refund-card-side">
                    <p class="participant-refund-card-amount">{{ refund.amount }} {{ refund.currency }}</p>
                  </div>
                </article>
              }
            </div>
          }
        </section>
      }
    </div>
  `
})
export class RefundsPage {
  readonly registrationId = input<string>('');

  private readonly fb = inject(FormBuilder);
  private readonly refundService = inject(RefundService);
  private readonly registrationService = inject(RegistrationService);
  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Banknote, Sparkles, ClipboardList };
  protected readonly filters = REFUND_FILTERS;

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly activeFilter = signal<RefundFilter>('all');
  protected readonly refunds = signal<RefundRequest[]>([]);
  protected readonly registrations = signal<Registration[]>([]);
  protected readonly eventsById = signal<Record<string, Event>>({});

  protected readonly form = this.fb.nonNullable.group({
    registrationId: ['', Validators.required],
    reason: ['', [Validators.required, Validators.minLength(10)]]
  });

  protected readonly eligibleRegistrations = computed<Registration[]>(() => {
    const nonRefundableIds = new Set(
      this.refunds()
        .filter((refund) => refund.status !== 'REJECTED')
        .map((refund) => refund.registrationId)
    );
    return this.registrations().filter(
      (registration) =>
        (registration.status === 'CONFIRMED' || registration.status === 'ATTENDED') &&
        !nonRefundableIds.has(registration.id)
    );
  });

  protected readonly registrationOptions = computed<SelectOption[]>(() =>
    this.eligibleRegistrations().map((registration) => {
      const event = this.eventsById()[registration.eventId];
      const label = event ? event.title : registration.eventId;
      return { value: registration.id, label: `${label} — ${registration.totalPrice} ${registration.currency}` };
    })
  );

  protected readonly filteredRefunds = computed(() => {
    const filter = this.activeFilter();
    const list = this.refunds();
    switch (filter) {
      case 'pending':
        return list.filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED');
      case 'done':
        return list.filter((r) => r.status === 'PROCESSED');
      case 'rejected':
        return list.filter((r) => r.status === 'REJECTED');
      default:
        return list;
    }
  });

  constructor() {
    effect(() => {
      const id = this.registrationId();
      if (id) this.form.patchValue({ registrationId: id });
    });

    this.load();
  }

  protected countFor(filter: RefundFilter): number {
    switch (filter) {
      case 'pending':
        return this.refunds().filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED').length;
      case 'done':
        return this.refunds().filter((r) => r.status === 'PROCESSED').length;
      case 'rejected':
        return this.refunds().filter((r) => r.status === 'REJECTED').length;
      default:
        return this.refunds().length;
    }
  }

  protected accentFor(status: RefundStatus): string {
    return STATUS_ACCENT[status];
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected statusConfig(refund: RefundRequest) {
    return refundStatusBadge(refund.status);
  }

  protected emptyDescription(): string {
    switch (this.activeFilter()) {
      case 'pending':
        return "Aucune demande en cours de traitement.";
      case 'done':
        return "Aucun remboursement n'a encore été versé.";
      case 'rejected':
        return "Aucune demande rejetée.";
      default:
        return "Vos demandes de remboursement apparaîtront ici.";
    }
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const { registrationId, reason } = this.form.getRawValue();
    this.submitting.set(true);

    this.refundService.create({ registrationId, reason }).subscribe({
      next: (refund) => {
        this.refunds.update((list) => [refund, ...list]);
        this.submitting.set(false);
        this.form.reset({ registrationId: '', reason: '' });
        this.activeFilter.set('all');
        this.toast.success('Votre demande de remboursement a été envoyée.');
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.toast.error(extractErrorMessage(error, 'Impossible de créer la demande de remboursement.'));
      }
    });
  }

  private load(): void {
    this.loading.set(true);

    forkJoin({
      refunds: this.refundService.getMine(),
      registrations: this.registrationService.getMine()
    }).subscribe(({ refunds, registrations }) => {
      this.refunds.set(refunds);
      this.registrations.set(registrations);

      const eventIds = [...new Set([...refunds.map((r) => r.eventId), ...registrations.map((r) => r.eventId)])];

      if (eventIds.length === 0) {
        this.loading.set(false);
        return;
      }

      forkJoin(eventIds.map((id) => this.eventService.getById(id).pipe(catchError(() => of(null))))).subscribe(
        (events) => {
          const map: Record<string, Event> = {};
          events.forEach((event) => {
            if (event) map[event.id] = event;
          });
          this.eventsById.set(map);
          this.loading.set(false);
        }
      );
    });
  }
}
