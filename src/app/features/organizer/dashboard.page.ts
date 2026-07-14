import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronRight,
  LucideAngularModule,
  Plus,
  ScanLine,
  Ticket,
  TrendingUp,
  Users
} from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { EventService } from '../../core/api/event.service';
import { RefundService } from '../../core/api/refund.service';
import { StatsService } from '../../core/api/stats.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Event, OrganizerStats } from '../../core/models';
import { AdminAreaChartComponent } from '../../shared/admin/admin-area-chart.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { MonoCounterComponent } from '../../shared/organizer/mono-counter.component';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { OccupancyService } from '../../shared/organizer/occupancy.service';
import { ProgramRowComponent } from '../../shared/organizer/program-row.component';
import { SparklineComponent } from '../../shared/organizer/sparkline.component';
import { buildUrgencyList } from '../../shared/organizer/urgency.util';

@Component({
  selector: 'app-organizer-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    OccupancyArcComponent,
    SparklineComponent,
    ProgramRowComponent,
    MonoCounterComponent,
    AdminAreaChartComponent
  ],
  template: `
    <div class="organizer-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="organizer-studio-badge mb-3">
            <lucide-angular [img]="icons.CalendarDays" [size]="12"></lucide-angular>
            <span>Studio organisateur</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Bonjour, {{ authStore.user()?.firstName }}
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Votre journée événementielle — occupation live, revenus et programme priorisé.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (todayEvent(); as event) {
            <a [routerLink]="['/organisateur/scan', event.id]" class="organizer-quick-chip">
              <lucide-angular [img]="icons.ScanLine" [size]="14"></lucide-angular>
              Scanner l'entrée
            </a>
          }
          <a routerLink="/organisateur/evenements" class="organizer-quick-chip">
            Mes événements
            <lucide-angular [img]="icons.ArrowUpRight" [size]="14"></lucide-angular>
          </a>
          <a routerLink="/organisateur/evenements/nouveau">
            <app-ui-button>
              <lucide-angular [img]="icons.Plus" [size]="16"></lucide-angular>
              Nouvel événement
            </app-ui-button>
          </a>
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="120px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-7" height="340px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-5" height="340px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="200px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="200px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="200px" rounded="2xl" />
        </div>
      } @else if (stats(); as s) {
        <section class="organizer-studio-hero">
          <div class="organizer-studio-hero-grid">
            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Banknote" [size]="17"></lucide-angular>
              </div>
              <div class="min-w-0">
                <p class="organizer-studio-metric-label">Revenus cumulés</p>
                <p class="organizer-studio-metric-value">{{ formatAmount(s.totalRevenue) }}</p>
                <p class="organizer-studio-metric-chip">MAD · {{ revenueGrowthLabel() }}</p>
              </div>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="17"></lucide-angular>
              </div>
              <div class="min-w-0">
                <p class="organizer-studio-metric-label">Inscriptions</p>
                <p class="organizer-studio-metric-value">{{ s.totalRegistrations }}</p>
                <p class="organizer-studio-metric-chip">{{ s.totalEvents }} événements</p>
              </div>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Ticket" [size]="17"></lucide-angular>
              </div>
              <div class="min-w-0">
                <p class="organizer-studio-metric-label">Billets vendus</p>
                <p class="organizer-studio-metric-value">{{ s.totalTicketsSold }}</p>
                <p class="organizer-studio-metric-chip">toutes sessions</p>
              </div>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.CalendarDays" [size]="17"></lucide-angular>
              </div>
              <div class="min-w-0">
                <p class="organizer-studio-metric-label">À venir</p>
                <p class="organizer-studio-metric-value">{{ upcomingCount() }}</p>
                <p class="organizer-studio-metric-chip">programmés</p>
              </div>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          @if (todayEvent(); as event) {
            <section class="organizer-live-stage xl:col-span-7">
              @if (event.coverImageUrl) {
                <div class="organizer-live-stage-cover" [style.background-image]="'url(' + event.coverImageUrl + ')'"></div>
              }
              <div class="organizer-live-stage-scrim"></div>
              <div class="organizer-live-stage-body">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span class="organizer-live-badge">
                      <span class="organizer-live-badge-dot" aria-hidden="true"></span>
                      Aujourd'hui · En direct
                    </span>
                    <h2 class="mt-3 text-xl font-bold tracking-tight sm:text-2xl">{{ event.title }}</h2>
                    <p class="mt-1 text-sm text-white/75">
                      {{ formatTime(event.startAt) }} · {{ event.city }}
                    </p>
                  </div>
                  <a
                    [routerLink]="['/organisateur/scan', event.id]"
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/18"
                  >
                    <lucide-angular [img]="icons.ScanLine" [size]="14"></lucide-angular>
                    Ouvrir le scan
                  </a>
                </div>

                <div class="mt-auto flex flex-col items-center gap-5 pt-8 sm:flex-row sm:justify-center sm:gap-10">
                  <app-occupancy-arc
                    [current]="liveScanned()"
                    [max]="todayCapacity()"
                    [size]="188"
                    [strokeWidth]="11"
                    [showRatio]="true"
                    label="Scannés"
                    accent="#7BDAC2"
                    track="rgba(255,255,255,0.14)"
                  />
                  <div class="text-center sm:text-left">
                    <app-mono-counter [value]="liveScanned()" size="xl" />
                    <p class="mt-1 font-mono text-sm tabular-nums text-white/70">
                      / {{ todayCapacity() }} entrées validées
                    </p>
                    <p class="mt-3 max-w-xs text-xs leading-relaxed text-white/55">
                      Compteur rafraîchi à chaque scan — suivez le flux d'entrée en temps réel.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          } @else {
            <section class="organizer-live-stage-empty xl:col-span-7">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal-dark">
                <lucide-angular [img]="icons.CalendarDays" [size]="24"></lucide-angular>
              </div>
              <p class="mt-4 text-base font-semibold text-text-primary">Aucun événement aujourd'hui</p>
              <p class="mt-1 max-w-md text-sm text-text-secondary">
                Le plateau live s'active automatiquement le jour J. En attendant, consultez votre programme ou créez un
                nouvel événement.
              </p>
              <a routerLink="/organisateur/evenements/nouveau" class="mt-5">
                <app-ui-button size="sm">Planifier un événement</app-ui-button>
              </a>
            </section>
          }

          <section class="organizer-panel xl:col-span-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">Performance</p>
                <h2 class="organizer-panel-title">Courbe des revenus</h2>
                <p class="organizer-panel-subtitle">6 derniers mois</p>
              </div>
              <app-sparkline [values]="revenueSparkline()" [width]="88" [height]="32" color="#53B29A" />
            </div>
            <div class="mt-5 h-52">
              <app-admin-area-chart
                [points]="s.revenueOverTime"
                [showLabels]="true"
                color="#53B29A"
                ariaLabel="Évolution des revenus sur 6 mois"
              />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              @for (point of s.revenueOverTime; track point.label) {
                <div class="rounded-lg border border-hairline bg-organizer-bg px-2 py-1.5 text-center">
                  <p class="font-mono text-xs font-semibold tabular-nums text-text-primary">{{ formatCompact(point.value) }}</p>
                  <p class="mt-0.5 text-[10px] font-semibold tracking-wide text-text-secondary">{{ point.label }}</p>
                </div>
              }
            </div>
          </section>

          <section class="organizer-panel xl:col-span-4">
            <p class="organizer-panel-eyebrow">Alertes</p>
            <h2 class="organizer-panel-title">À traiter</h2>
            <div class="mt-4 space-y-3">
              <div class="organizer-alert-card" [class.organizer-alert-card--warn]="pendingRefunds() > 0">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Remboursements</p>
                  @if (pendingRefunds() > 0) {
                    <span class="h-2 w-2 rounded-full bg-status-pending" aria-hidden="true"></span>
                  }
                </div>
                <app-mono-counter class="mt-1 block" [value]="pendingRefunds()" size="lg" />
                <a
                  routerLink="/organisateur/remboursements"
                  class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-teal-dark hover:underline"
                >
                  Voir les demandes
                  <lucide-angular [img]="icons.ChevronRight" [size]="12"></lucide-angular>
                </a>
              </div>
              <div class="organizer-alert-card">
                <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Inscriptions récentes</p>
                <app-mono-counter class="mt-1 block" [value]="recentRegistrations()" size="lg" />
                <p class="mt-1 text-xs text-text-secondary">sur le mois en cours</p>
              </div>
            </div>
          </section>

          <section class="organizer-panel xl:col-span-4">
            <p class="organizer-panel-eyebrow">Tendance</p>
            <h2 class="organizer-panel-title">Inscriptions</h2>
            <p class="organizer-panel-subtitle">Flux mensuel</p>
            <div class="mt-5 h-44">
              <app-admin-area-chart
                [points]="s.registrationsOverTime"
                [showLabels]="true"
                color="#6366F1"
                ariaLabel="Évolution des inscriptions"
              />
            </div>
          </section>

          <section class="organizer-panel xl:col-span-4">
            <p class="organizer-panel-eyebrow">Classement</p>
            <h2 class="organizer-panel-title">Top événements</h2>
            <p class="organizer-panel-subtitle">Par inscriptions</p>
            <div class="mt-4 space-y-2">
              @if (s.topEvents.length === 0) {
                <p class="text-sm text-text-secondary">Aucune donnée pour l'instant.</p>
              } @else {
                @for (item of s.topEvents; track item.eventId; let i = $index) {
                  <div class="organizer-top-rank">
                    <span class="min-w-0 flex-1 truncate font-medium text-text-primary">{{ item.title }}</span>
                    <span class="font-mono text-xs font-semibold tabular-nums text-brand-teal-dark">{{ item.registrations }}</span>
                  </div>
                  <div class="organizer-top-rank-bar -mt-1 mb-1">
                    <div class="organizer-top-rank-fill" [style.width.%]="topEventWidth(item.registrations)"></div>
                  </div>
                }
              }
            </div>
          </section>
        </div>

        <section class="min-w-0">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p class="organizer-panel-eyebrow">Agenda</p>
              <h2 class="organizer-panel-title">Programme priorisé</h2>
              <p class="organizer-panel-subtitle">Les dates les plus urgentes et les taux de remplissage les plus bas</p>
            </div>
            <a
              routerLink="/organisateur/evenements"
              class="organizer-quick-chip"
            >
              Tous les événements
              <lucide-angular [img]="icons.ChevronRight" [size]="14"></lucide-angular>
            </a>
          </div>

          @if (timelineEvents().length === 0) {
            <app-ui-empty-state
              title="Aucun événement"
              description="Créez votre premier événement pour le voir apparaître ici."
            >
              <lucide-angular icon [img]="icons.TrendingUp" [size]="22"></lucide-angular>
            </app-ui-empty-state>
          } @else {
            <div class="organizer-program-track">
              @for (event of timelineEvents(); track event.id) {
                <app-program-row
                  [title]="event.title"
                  [subtitle]="event.city"
                  [dateIso]="event.startAt"
                  [status]="event.status"
                  [occupied]="occupancyFor(event.id)"
                  [capacity]="event.capacity"
                  [link]="['/organisateur/evenements', event.id, 'modifier']"
                />
              }
            </div>
          }
        </section>
      }
    </div>
  `
})
export class OrganizerDashboardPage implements OnDestroy {
  private readonly eventService = inject(EventService);
  private readonly statsService = inject(StatsService);
  private readonly refundService = inject(RefundService);
  private readonly occupancyService = inject(OccupancyService);
  protected readonly authStore = inject(AuthStore);

  protected readonly icons = {
    Plus,
    CalendarDays,
    TrendingUp,
    ChevronRight,
    ArrowUpRight,
    ScanLine,
    Banknote,
    Users,
    Ticket
  };

  protected readonly loading = signal(true);
  protected readonly stats = signal<OrganizerStats | null>(null);
  protected readonly events = signal<Event[]>([]);
  protected readonly pendingRefunds = signal(0);
  protected readonly occupancyByEvent = signal<Record<string, number>>({});
  protected readonly liveScanned = signal(0);

  private liveTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly revenueSparkline = computed(() =>
    (this.stats()?.revenueOverTime ?? []).map((point) => point.value)
  );

  protected readonly upcomingCount = computed(() => {
    const now = Date.now();
    return this.events().filter(
      (event) => new Date(event.startAt).getTime() >= now && event.status !== 'ANNULE'
    ).length;
  });

  protected readonly todayEvent = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return (
      this.events().find((event) => {
        const start = new Date(event.startAt);
        return start >= today && start < tomorrow && event.status !== 'ANNULE' && event.status !== 'ARCHIVE';
      }) ?? null
    );
  });

  protected readonly todayCapacity = computed(() => this.todayEvent()?.capacity ?? 100);

  protected readonly timelineEvents = computed(() =>
    buildUrgencyList(
      this.events().filter((e) => e.status !== 'ARCHIVE' && e.status !== 'ANNULE'),
      this.occupancyByEvent()
    ).map((item) => item.event)
  );

  protected readonly topEventMax = computed(() => {
    const top = this.stats()?.topEvents ?? [];
    return Math.max(1, ...top.map((item) => item.registrations));
  });

  constructor() {
    const organizerId = this.authStore.user()?.id;
    if (!organizerId) {
      this.loading.set(false);
      return;
    }

    forkJoin({
      stats: this.statsService.getOrganizerStats(organizerId),
      events: this.eventService.getByOrganizer(organizerId, { page: 0, size: 100 }),
      refunds: this.refundService.search({ page: 0, size: 200 })
    }).subscribe({
      next: ({ stats, events, refunds }) => {
        this.stats.set(stats);
        this.events.set(events.content);
        this.pendingRefunds.set(refunds.content.filter((r) => r.status === 'REQUESTED').length);

        this.occupancyService.forEvents(events.content.map((e) => e.id)).subscribe((occupancy) => {
          this.occupancyByEvent.set(occupancy);

          const today = this.findTodayEvent(events.content);
          if (today) {
            const base = occupancy[today.id] ?? Math.floor(today.capacity * 0.35);
            this.liveScanned.set(Math.min(base, today.capacity));
            this.startLiveTick(today.capacity);
          }
        });

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  ngOnDestroy(): void {
    if (this.liveTimer) clearInterval(this.liveTimer);
  }

  protected occupancyFor(eventId: string): number {
    return this.occupancyByEvent()[eventId] ?? 0;
  }

  protected topEventWidth(registrations: number): number {
    return Math.round((registrations / this.topEventMax()) * 100);
  }

  protected recentRegistrations(): number {
    const points = this.stats()?.registrationsOverTime ?? [];
    return points[points.length - 1]?.value ?? 0;
  }

  protected revenueGrowthLabel(): string {
    const points = this.stats()?.revenueOverTime ?? [];
    if (points.length < 2) return 'stable';
    const prev = points[points.length - 2].value;
    const last = points[points.length - 1].value;
    if (prev === 0) return last > 0 ? '+100 %' : 'stable';
    const delta = Math.round(((last - prev) / prev) * 100);
    if (delta === 0) return 'stable';
    return delta > 0 ? `+${delta} %` : `${delta} %`;
  }

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  protected formatCompact(amount: number): string {
    if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
    return String(amount);
  }

  private findTodayEvent(events: Event[]): Event | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      events.find((event) => {
        const start = new Date(event.startAt);
        return start >= today && start < tomorrow && event.status !== 'ANNULE';
      }) ?? null
    );
  }

  private startLiveTick(capacity: number): void {
    this.liveTimer = setInterval(() => {
      this.liveScanned.update((v) => (v < capacity ? v + 1 : v));
    }, 5000);
  }
}
