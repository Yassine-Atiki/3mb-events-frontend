import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { ChartPoint, Event, RefundRequest, RefundStatus } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { refundStatusBadge } from '../participant/utils/status-badges.util';

const STATUS_LABELS: Record<RefundStatus, string> = {
  REQUESTED: 'Demandé',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  PROCESSED: 'Traité'
};

const STATUS_COLORS: Record<RefundStatus, string> = {
  REQUESTED: '#F59E0B',
  APPROVED: '#53B29A',
  REJECTED: '#F43F5E',
  PROCESSED: '#22C55E'
};

type StatusFilter = 'all' | RefundStatus;

@Component({
  selector: 'app-admin-refunds-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    BadgeComponent,
    ButtonComponent,
    InputComponent,
    ModalComponent,
    SkeletonComponent,
    EmptyStateComponent,
    AdminDonutChartComponent,
    AdminStatusSpectrumComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.Banknote" [size]="12"></lucide-angular>
            <span>Flux financier</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Remboursements</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Supervisez les demandes de remboursement — validez, rejetez et suivez les montants en attente.
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
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.Clock" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">En attente</p>
                <p class="admin-command-metric-value">{{ pendingCount() }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">à traiter</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Wallet" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Montant en attente</p>
                <p class="admin-command-metric-value text-base">{{ formatAmount(pendingAmount()) }}</p>
              </div>
              <span class="admin-command-metric-chip">MAD cumulés</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.TrendingUp" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Traités</p>
                <p class="admin-command-metric-value">{{ processedCount() }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ formatAmount(processedAmount()) }} MAD</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Banknote" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Volume total</p>
                <p class="admin-command-metric-value text-base">{{ formatAmount(totalAmount()) }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ refunds().length }} demandes</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">File d'attente</p>
                <h2 class="admin-bento-title">Demandes de remboursement</h2>
                <p class="admin-bento-subtitle">Cliquez sur une carte pour examiner et décider</p>
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

              <div class="admin-city-filter">
                @for (chip of statusChips; track chip.value) {
                  <button
                    type="button"
                    class="admin-city-filter-chip"
                    [class.admin-city-filter-chip--active]="statusFilter() === chip.value"
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
                  description="Aucun remboursement ne correspond à ces critères."
                />
              </div>
            } @else {
              <div class="admin-refund-grid mt-5">
                @for (refund of filteredRefunds(); track refund.id) {
                  <button
                    type="button"
                    class="admin-refund-card"
                    [class.admin-refund-card--pending]="refund.status === 'REQUESTED'"
                    [style.--refund-accent]="statusColor(refund.status)"
                    (click)="openRefund(refund)"
                  >
                    <div class="admin-refund-thumb">
                      @if (eventsById()[refund.eventId]?.coverImageUrl; as cover) {
                        <img [src]="cover" alt="" />
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="admin-refund-amount">{{ refund.amount }} {{ refund.currency }}</p>
                        <app-ui-badge [tone]="badgeConfig(refund).tone">{{ badgeConfig(refund).label }}</app-ui-badge>
                      </div>
                      <p class="mt-1 truncate text-sm font-semibold text-text-primary">
                        {{ eventTitles()[refund.eventId] || 'Événement' }}
                      </p>
                      <p class="mt-0.5 text-xs text-text-secondary">
                        {{ userNames()[refund.userId] || 'Participant' }} · {{ formatDate(refund.requestedAt) }}
                      </p>
                      <p class="mt-2 line-clamp-2 text-xs italic text-text-secondary">"{{ refund.reason }}"</p>
                    </div>
                  </button>
                }
              </div>
            }
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Répartition</p>
              <h2 class="admin-bento-title">Par statut</h2>
              <div class="mt-5">
                <app-admin-donut-chart [points]="statusChart()" ariaLabel="Répartition des remboursements par statut" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Pipeline</p>
              <h2 class="admin-bento-title">Spectre des statuts</h2>
              <div class="mt-5">
                <app-admin-status-spectrum
                  [points]="statusChart()"
                  [labelMap]="statusLabels"
                  [colorMap]="statusColors"
                  ariaLabel="Spectre des statuts de remboursement"
                />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Priorité</p>
              <h2 class="admin-bento-title">À traiter en premier</h2>
              <div class="mt-4 space-y-2">
                @if (pendingQueue().length === 0) {
                  <p class="text-sm text-text-secondary">Aucune demande en attente.</p>
                } @else {
                  @for (refund of pendingQueue(); track refund.id) {
                    <button
                      type="button"
                      class="admin-refund-queue-item w-full text-left"
                      (click)="openRefund(refund)"
                    >
                      <span class="truncate font-medium text-text-primary">
                        {{ userNames()[refund.userId] || 'Participant' }}
                      </span>
                      <span class="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-700">
                        {{ refund.amount }} MAD
                      </span>
                    </button>
                  }
                }
              </div>
            </section>
          </div>
        </div>
      }
    </div>

    <app-ui-modal [open]="selectedRefund() !== null" title="Demande de remboursement" (close)="closeModal()">
      @if (selectedRefund(); as refund) {
        <div class="flex flex-col gap-4">
          <div class="admin-modal-hero">
            <p class="font-mono text-2xl font-bold tabular-nums text-white">
              {{ refund.amount }} {{ refund.currency }}
            </p>
            <p class="mt-2 text-sm text-white/80">
              {{ eventTitles()[refund.eventId] || 'Événement' }} · {{ userNames()[refund.userId] || 'Participant' }}
            </p>
            <p class="mt-1 font-mono text-xs text-white/60">Demandé le {{ formatDate(refund.requestedAt) }}</p>
            <div class="mt-3">
              <app-ui-badge [tone]="badgeConfig(refund).tone">{{ badgeConfig(refund).label }}</app-ui-badge>
            </div>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Motif du participant</p>
            <p class="mt-1.5 rounded-xl border border-hairline bg-surface-light/60 p-3 text-sm text-text-primary">
              {{ refund.reason }}
            </p>
          </div>

          @if (refund.adminNote) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Note administrateur</p>
              <p class="mt-1.5 text-sm text-text-primary">{{ refund.adminNote }}</p>
            </div>
          }

          @if (refund.status === 'REQUESTED') {
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-text-primary">Note (optionnelle)</label>
              <textarea
                rows="3"
                class="w-full rounded-xl border border-gray-200 bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
                placeholder="Ajoutez une note interne…"
                [ngModel]="adminNote()"
                (ngModelChange)="adminNote.set($event)"
              ></textarea>
            </div>

            <div class="ui-modal-footer">
              <app-ui-button variant="danger" [loading]="rejecting()" (clicked)="reject(refund)">Rejeter</app-ui-button>
              <app-ui-button variant="primary" [loading]="approving()" (clicked)="approve(refund)">Approuver</app-ui-button>
            </div>
          }
        </div>
      }
    </app-ui-modal>
  `
})
export class AdminRefundsPage {
  private readonly refundService = inject(RefundService);
  private readonly eventService = inject(EventService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Banknote, Clock, Wallet, TrendingUp, Search };
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusColors = STATUS_COLORS;

  protected readonly statusChips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'REQUESTED', label: 'Demandés' },
    { value: 'APPROVED', label: 'Approuvés' },
    { value: 'REJECTED', label: 'Rejetés' },
    { value: 'PROCESSED', label: 'Traités' }
  ];

  protected readonly refunds = signal<RefundRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly eventTitles = signal<Record<string, string>>({});
  protected readonly eventsById = signal<Record<string, Event>>({});
  protected readonly userNames = signal<Record<string, string>>({});

  protected readonly selectedRefund = signal<RefundRequest | null>(null);
  protected readonly adminNote = signal('');
  protected readonly approving = signal(false);
  protected readonly rejecting = signal(false);

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
    this.fetchRefunds();
  }

  protected statusCount(filter: StatusFilter): number {
    if (filter === 'all') return this.refunds().length;
    return this.refunds().filter((refund) => refund.status === filter).length;
  }

  protected badgeConfig(refund: RefundRequest) {
    return refundStatusBadge(refund.status);
  }

  protected statusColor(status: RefundStatus): string {
    return STATUS_COLORS[status];
  }

  protected openRefund(refund: RefundRequest): void {
    this.selectedRefund.set(refund);
    this.adminNote.set('');
  }

  protected closeModal(): void {
    this.selectedRefund.set(null);
  }

  protected approve(refund: RefundRequest): void {
    this.approving.set(true);
    this.refundService.approve(refund.id, this.adminNote().trim() || undefined).subscribe({
      next: (updated) => {
        this.approving.set(false);
        this.replaceRefund(updated);
        this.toast.success('Remboursement approuvé.');
        this.closeModal();
      },
      error: () => {
        this.approving.set(false);
        this.toast.error("Impossible d'approuver ce remboursement.");
      }
    });
  }

  protected reject(refund: RefundRequest): void {
    this.rejecting.set(true);
    this.refundService.reject(refund.id, this.adminNote().trim() || undefined).subscribe({
      next: (updated) => {
        this.rejecting.set(false);
        this.replaceRefund(updated);
        this.toast.success('Remboursement rejeté.');
        this.closeModal();
      },
      error: () => {
        this.rejecting.set(false);
        this.toast.error('Impossible de rejeter ce remboursement.');
      }
    });
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  private replaceRefund(updated: RefundRequest): void {
    this.refunds.update((list) => list.map((refund) => (refund.id === updated.id ? updated : refund)));
  }

  private fetchRefunds(): void {
    this.loading.set(true);
    this.refundService.search({ page: 0, size: 200, sort: 'requestedAt,desc' }).subscribe({
      next: (res) => {
        this.refunds.set(res.content);
        this.loading.set(false);
        this.loadLookups(res.content);
      },
      error: () => {
        this.refunds.set([]);
        this.loading.set(false);
        this.toast.error('Impossible de charger les demandes de remboursement.');
      }
    });
  }

  private loadLookups(refunds: RefundRequest[]): void {
    const uniqueEventIds = Array.from(new Set(refunds.map((refund) => refund.eventId)));
    const uniqueUserIds = Array.from(new Set(refunds.map((refund) => refund.userId)));

    if (uniqueEventIds.length > 0) {
      forkJoin(
        uniqueEventIds.map((id) => this.eventService.getById(id).pipe(catchError(() => of(null))))
      ).subscribe((events) => {
        const titles: Record<string, string> = {};
        const byId: Record<string, Event> = {};
        events.forEach((event, index) => {
          if (event) {
            titles[event.id] = event.title;
            byId[event.id] = event;
          } else {
            titles[uniqueEventIds[index]] = 'Événement';
          }
        });
        this.eventTitles.set(titles);
        this.eventsById.set(byId);
      });
    }

    if (uniqueUserIds.length > 0) {
      forkJoin(
        uniqueUserIds.map((id) => this.userService.getById(id).pipe(catchError(() => of(null))))
      ).subscribe((users) => {
        const map: Record<string, string> = {};
        users.forEach((user, index) => {
          if (user) map[uniqueUserIds[index]] = `${user.firstName} ${user.lastName}`;
        });
        this.userNames.set(map);
      });
    }
  }
}
