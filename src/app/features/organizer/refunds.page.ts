import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Banknote,
  Clock,
  LucideAngularModule,
  Search,
  TrendingUp,
  Wallet
} from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';

import { EventService } from '../../core/api/event.service';
import { RefundService } from '../../core/api/refund.service';
import { UserService } from '../../core/api/user.service';
import { AuthStore } from '../../core/auth/auth.store';
import { ChartPoint, Event, RefundRequest, RefundStatus } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { refundStatusBadge } from '../participant/utils/status-badges.util';

const STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'En cours',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
  PROCESSED: 'Remboursée'
};

const STATUS_COLORS: Record<RefundStatus, string> = {
  REQUESTED: '#F59E0B',
  APPROVED: '#53B29A',
  REJECTED: '#F43F5E',
  PROCESSED: '#22C55E'
};

type StatusFilter = 'all' | RefundStatus;

@Component({
  selector: 'app-organizer-refunds-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    BadgeComponent,
    InputComponent,
    SkeletonComponent,
    EmptyStateComponent,
    AdminDonutChartComponent,
    AdminStatusSpectrumComponent
  ],
  template: `
    <div class="organizer-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="organizer-studio-badge mb-3">
            <lucide-angular [img]="icons.Banknote" [size]="12"></lucide-angular>
            <span>Flux financier</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Remboursements</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Suivez les demandes de vos participants — statuts, montants et motifs en un coup d'œil.
          </p>
        </div>
        <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
          {{ filteredRefunds().length }} / {{ refunds().length }} demandes
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="480px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="480px" rounded="2xl" />
        </div>
      } @else {
        <section class="organizer-studio-hero">
          <div class="organizer-studio-hero-grid">
            <article class="organizer-studio-metric" [class.organizer-studio-metric--warn]="pendingCount() > 0">
              <div class="organizer-studio-metric-icon organizer-studio-metric-icon--warn">
                <lucide-angular [img]="icons.Clock" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">En attente</p>
                <p class="organizer-studio-metric-value">{{ pendingCount() }}</p>
              </div>
              <span class="organizer-studio-metric-chip">à suivre</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Wallet" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Montant en attente</p>
                <p class="organizer-studio-metric-value text-base">{{ formatAmount(pendingAmount()) }}</p>
              </div>
              <span class="organizer-studio-metric-chip">MAD cumulés</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.TrendingUp" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Traités</p>
                <p class="organizer-studio-metric-value">{{ processedCount() }}</p>
              </div>
              <span class="organizer-studio-metric-chip">{{ formatAmount(processedAmount()) }} MAD</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Banknote" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Volume total</p>
                <p class="organizer-studio-metric-value text-base">{{ formatAmount(totalAmount()) }}</p>
              </div>
              <span class="organizer-studio-metric-chip">{{ refunds().length }} demandes</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="organizer-panel xl:col-span-8">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">File d'attente</p>
                <h2 class="organizer-panel-title">Demandes de remboursement</h2>
                <p class="organizer-panel-subtitle">Consultez le détail de chaque demande de vos participants</p>
              </div>
            </div>

            <div class="mt-5 flex flex-col gap-4">
              <app-ui-input
                type="search"
                placeholder="Rechercher motif, événement ou participant…"
                [leadingIcon]="icons.Search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />

              <div class="organizer-refund-filter">
                @for (chip of statusChips; track chip.value) {
                  <button
                    type="button"
                    class="organizer-refund-filter-chip"
                    [class.organizer-refund-filter-chip--active]="statusFilter() === chip.value"
                    [style.--refund-chip-accent]="chipAccent(chip.value)"
                    (click)="statusFilter.set(chip.value)"
                  >
                    {{ chip.label }}
                    <span class="ml-1 font-mono tabular-nums opacity-70">({{ statusCount(chip.value) }})</span>
                  </button>
                }
              </div>
            </div>

            @if (filteredRefunds().length === 0) {
              <div class="mt-8">
                <app-ui-empty-state
                  title="Aucune demande"
                  description="Les demandes de remboursement apparaîtront ici."
                >
                  <lucide-angular icon [img]="icons.Banknote" [size]="22"></lucide-angular>
                </app-ui-empty-state>
              </div>
            } @else {
              <div class="organizer-refund-grid mt-5">
                @for (refund of filteredRefunds(); track refund.id) {
                  <article
                    class="organizer-refund-card"
                    [class.organizer-refund-card--pending]="refund.status === 'REQUESTED'"
                    [style.--refund-accent]="statusColor(refund.status)"
                  >
                    <div class="organizer-refund-thumb">
                      @if (eventsById()[refund.eventId]?.coverImageUrl; as cover) {
                        <img [src]="cover" alt="" />
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="organizer-refund-amount">{{ refund.amount }} {{ refund.currency }}</p>
                        <app-ui-badge [tone]="badgeConfig(refund).tone">{{ badgeConfig(refund).label }}</app-ui-badge>
                      </div>
                      <p class="mt-1 truncate text-sm font-semibold text-text-primary">
                        {{ eventTitles()[refund.eventId] || 'Événement' }}
                      </p>
                      <p class="mt-0.5 text-xs text-text-secondary">
                        {{ userNames()[refund.userId] || 'Participant' }} · {{ formatDate(refund.requestedAt) }}
                      </p>
                      <p class="mt-2 line-clamp-2 text-xs italic text-text-secondary">"{{ refund.reason }}"</p>
                      @if (refund.adminNote) {
                        <p class="mt-2 rounded-lg border border-hairline bg-organizer-bg/60 px-2.5 py-1.5 text-[11px] text-text-secondary">
                          Note : {{ refund.adminNote }}
                        </p>
                      }
                    </div>
                  </article>
                }
              </div>
            }
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="organizer-panel">
              <p class="organizer-panel-eyebrow">Répartition</p>
              <h2 class="organizer-panel-title">Par statut</h2>
              <div class="mt-5">
                @if (refunds().length > 0) {
                  <app-admin-donut-chart
                    [points]="statusChart()"
                    ariaLabel="Répartition des remboursements par statut"
                  />
                } @else {
                  <p class="text-sm text-text-secondary">Aucune donnée pour l'instant.</p>
                }
              </div>
            </section>

            <section class="organizer-panel">
              <p class="organizer-panel-eyebrow">Pipeline</p>
              <h2 class="organizer-panel-title">Spectre des statuts</h2>
              @if (refunds().length > 0) {
                <div class="mt-5">
                  <app-admin-status-spectrum
                    [points]="statusChart()"
                    [labelMap]="statusLabels"
                    [colorMap]="statusColors"
                    ariaLabel="Spectre des statuts de remboursement"
                  />
                </div>
              } @else {
                <p class="mt-4 text-sm text-text-secondary">Aucune demande enregistrée.</p>
              }
            </section>

            <section class="organizer-panel">
              <p class="organizer-panel-eyebrow">Priorité</p>
              <h2 class="organizer-panel-title">En attente de traitement</h2>
              <div class="mt-4 space-y-2">
                @if (pendingQueue().length === 0) {
                  <p class="text-sm text-text-secondary">Aucune demande en attente.</p>
                } @else {
                  @for (refund of pendingQueue(); track refund.id) {
                    <div class="organizer-refund-queue-item">
                      <div class="min-w-0">
                        <p class="truncate font-medium text-text-primary">
                          {{ userNames()[refund.userId] || 'Participant' }}
                        </p>
                        <p class="truncate text-[11px] text-text-secondary">
                          {{ eventTitles()[refund.eventId] || 'Événement' }}
                        </p>
                      </div>
                      <span class="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-700">
                        {{ refund.amount }} MAD
                      </span>
                    </div>
                  }
                }
              </div>
            </section>
          </div>
        </div>
      }
    </div>
  `
})
export class OrganizerRefundsPage {
  private readonly refundService = inject(RefundService);
  private readonly eventService = inject(EventService);
  private readonly userService = inject(UserService);
  private readonly authStore = inject(AuthStore);

  protected readonly icons = { Banknote, Clock, Wallet, TrendingUp, Search };
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusColors = STATUS_COLORS;

  protected readonly statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'REQUESTED', label: 'En cours' },
    { value: 'APPROVED', label: 'Approuvées' },
    { value: 'REJECTED', label: 'Rejetées' },
    { value: 'PROCESSED', label: 'Remboursées' }
  ];

  protected readonly loading = signal(true);
  protected readonly refunds = signal<RefundRequest[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly eventTitles = signal<Record<string, string>>({});
  protected readonly eventsById = signal<Record<string, Event>>({});
  protected readonly userNames = signal<Record<string, string>>({});

  protected readonly filteredRefunds = computed(() => {
    const term = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.refunds()
      .filter((refund) => {
        if (status !== 'all' && refund.status !== status) return false;
        if (!term) return true;
        const haystack = [
          refund.reason,
          refund.amount,
          refund.currency,
          this.eventTitles()[refund.eventId],
          this.userNames()[refund.userId],
          STATUS_LABELS[refund.status]
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  });

  protected readonly pendingCount = computed(
    () => this.refunds().filter((refund) => refund.status === 'REQUESTED').length
  );

  protected readonly processedCount = computed(
    () => this.refunds().filter((refund) => refund.status === 'PROCESSED' || refund.status === 'APPROVED').length
  );

  protected readonly pendingAmount = computed(() =>
    this.refunds()
      .filter((refund) => refund.status === 'REQUESTED')
      .reduce((sum, refund) => sum + refund.amount, 0)
  );

  protected readonly processedAmount = computed(() =>
    this.refunds()
      .filter((refund) => refund.status === 'PROCESSED' || refund.status === 'APPROVED')
      .reduce((sum, refund) => sum + refund.amount, 0)
  );

  protected readonly totalAmount = computed(() =>
    this.refunds().reduce((sum, refund) => sum + refund.amount, 0)
  );

  protected readonly statusChart = computed<ChartPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const refund of this.refunds()) {
      counts.set(refund.status, (counts.get(refund.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  });

  protected readonly pendingQueue = computed(() =>
    this.refunds()
      .filter((refund) => refund.status === 'REQUESTED')
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
      .slice(0, 5)
  );

  constructor() {
    this.load();
  }

  protected statusCount(filter: StatusFilter): number {
    if (filter === 'all') return this.refunds().length;
    return this.refunds().filter((refund) => refund.status === filter).length;
  }

  protected chipAccent(filter: StatusFilter): string {
    if (filter === 'all') return '#53B29A';
    return STATUS_COLORS[filter];
  }

  protected badgeConfig(refund: RefundRequest) {
    return refundStatusBadge(refund.status);
  }

  protected statusColor(status: RefundStatus): string {
    return STATUS_COLORS[status];
  }

  protected formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' MAD';
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  private load(): void {
    this.loading.set(true);

    this.refundService.search({ page: 0, size: 200 }).subscribe({
      next: (res) => {
        this.refunds.set(res.content);
        this.loading.set(false);
        this.loadLookups(res.content);
      },
      error: () => {
        this.refunds.set([]);
        this.loading.set(false);
      }
    });

    const organizerId = this.authStore.user()?.id;
    if (organizerId) {
      this.eventService.getByOrganizer(organizerId, { page: 0, size: 100 }).subscribe((res) => {
        const titles: Record<string, string> = {};
        const byId: Record<string, Event> = {};
        res.content.forEach((event) => {
          titles[event.id] = event.title;
          byId[event.id] = event;
        });
        this.eventTitles.set(titles);
        this.eventsById.set(byId);
      });
    }
  }

  private loadLookups(refunds: RefundRequest[]): void {
    const uniqueUserIds = Array.from(new Set(refunds.map((refund) => refund.userId)));
    if (uniqueUserIds.length === 0) return;

    forkJoin(uniqueUserIds.map((id) => this.userService.getById(id).pipe(catchError(() => of(null))))).subscribe(
      (users) => {
        const map: Record<string, string> = {};
        users.forEach((user, index) => {
          if (user) map[uniqueUserIds[index]] = `${user.firstName} ${user.lastName}`;
        });
        this.userNames.set(map);
      }
    );
  }
}
