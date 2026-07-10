import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  BarChart3,
  LucideAngularModule,
  TrendingUp,
  Users
} from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { StatsService } from '../../core/api/stats.service';
import { TicketService } from '../../core/api/ticket.service';
import { Event, OrganizerStats, TicketType } from '../../core/models';
import { AdminAreaChartComponent } from '../../shared/admin/admin-area-chart.component';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

const TICKET_BAR_COLORS = ['#53B29A', '#6366F1', '#3B82F6', '#F59E0B', '#8B5CF6', '#F43F5E'];

@Component({
  selector: 'app-organizer-event-stats-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    EmptyStateComponent,
    SkeletonComponent,
    AdminAreaChartComponent,
    OccupancyArcComponent
  ],
  template: `
    <div class="organizer-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4">
        <a
          routerLink="/organisateur/evenements"
          class="flex w-fit items-center gap-1 text-xs font-medium text-brand-teal-dark hover:underline"
        >
          <lucide-angular [img]="icons.ArrowLeft" [size]="13"></lucide-angular>
          Retour aux événements
        </a>
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div class="organizer-studio-badge mb-3">
              <lucide-angular [img]="icons.BarChart3" [size]="12"></lucide-angular>
              <span>Performance</span>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Statistiques</h1>
            <p class="mt-1 max-w-2xl text-sm text-text-secondary">{{ event()?.title ?? 'Chargement…' }}</p>
          </div>
          @if (event(); as ev) {
            <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
              Capacité {{ ev.capacity }} places
            </div>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-6" height="220px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-6" height="220px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-12" height="200px" rounded="2xl" />
        </div>
      } @else if (!event()) {
        <app-ui-empty-state title="Événement introuvable" description="Impossible de charger les statistiques." />
      } @else {
        <section class="organizer-studio-hero">
          <div class="organizer-studio-hero-grid">
            <article class="organizer-stat-kpi" style="--stat-kpi-accent: #53B29A">
              <p class="organizer-stat-kpi-label">Inscriptions</p>
              <p class="organizer-stat-kpi-value">{{ stats()?.totalRegistrations ?? 0 }}</p>
            </article>
            <article class="organizer-stat-kpi" style="--stat-kpi-accent: #F59E0B">
              <p class="organizer-stat-kpi-label">Revenus</p>
              <p class="organizer-stat-kpi-value">{{ formatAmount(stats()?.totalRevenue ?? 0) }}</p>
            </article>
            <article class="organizer-stat-kpi" style="--stat-kpi-accent: #6366F1">
              <p class="organizer-stat-kpi-label">Billets émis</p>
              <p class="organizer-stat-kpi-value">{{ soldCount() }}</p>
            </article>
            <article class="organizer-stat-kpi" style="--stat-kpi-accent: #3B82F6">
              <p class="organizer-stat-kpi-label">Taux de remplissage</p>
              <p class="organizer-stat-kpi-value">{{ fillRate() }}%</p>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="organizer-panel xl:col-span-5">
            <p class="organizer-panel-eyebrow">Vue d'ensemble</p>
            <h2 class="organizer-panel-title">Occupation live</h2>
            <p class="organizer-panel-subtitle">Billets vendus sur la capacité totale</p>
            <div class="mt-5 flex justify-center py-2">
              <app-occupancy-arc
                [current]="soldCount()"
                [max]="event()!.capacity"
                [size]="156"
                label="Remplissage"
                [showRatio]="true"
                accent="#3B82F6"
              />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-center">
              <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Inscriptions</p>
                <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#53B29A]">
                  {{ stats()?.totalRegistrations ?? 0 }}
                </p>
              </div>
              <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Revenus</p>
                <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#F59E0B]">
                  {{ formatAmount(stats()?.totalRevenue ?? 0) }}
                </p>
              </div>
            </div>
          </section>

          <section class="organizer-panel xl:col-span-7">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">Tendance</p>
                <h2 class="organizer-panel-title">Inscriptions (6 mois)</h2>
                <p class="organizer-panel-subtitle">Flux mensuel des inscriptions</p>
              </div>
              <span
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: color-mix(in srgb, #6366F1 14%, white); color: #6366F1"
              >
                <lucide-angular [img]="icons.Users" [size]="17"></lucide-angular>
              </span>
            </div>
            @if (hasData(stats()?.registrationsOverTime)) {
              <div class="mt-5 h-40">
                <app-admin-area-chart
                  [points]="stats()!.registrationsOverTime"
                  color="#6366F1"
                  ariaLabel="Évolution des inscriptions sur 6 mois"
                />
              </div>
            } @else {
              <p class="mt-8 rounded-xl border border-dashed border-hairline bg-white/60 py-10 text-center text-sm text-text-secondary">
                Aucune donnée pour le moment.
              </p>
            }
          </section>

          <section class="organizer-panel xl:col-span-6">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">Finance</p>
                <h2 class="organizer-panel-title">Revenus (6 mois)</h2>
                <p class="organizer-panel-subtitle">Courbe des encaissements</p>
              </div>
              <span
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: color-mix(in srgb, #F59E0B 14%, white); color: #b45309"
              >
                <lucide-angular [img]="icons.TrendingUp" [size]="17"></lucide-angular>
              </span>
            </div>
            @if (hasData(stats()?.revenueOverTime)) {
              <div class="mt-5 h-40">
                <app-admin-area-chart
                  [points]="stats()!.revenueOverTime"
                  color="#F59E0B"
                  ariaLabel="Évolution des revenus sur 6 mois"
                />
              </div>
            } @else {
              <p class="mt-8 rounded-xl border border-dashed border-hairline bg-white/60 py-10 text-center text-sm text-text-secondary">
                Aucune donnée pour le moment.
              </p>
            }
          </section>

          <section class="organizer-panel xl:col-span-6">
            <p class="organizer-panel-eyebrow">Billetterie</p>
            <h2 class="organizer-panel-title">Ventes par type</h2>
            <p class="organizer-panel-subtitle">Répartition des billets vendus</p>
            @if (ticketTypes().length === 0) {
              <p class="mt-6 text-sm text-text-secondary">Aucun type de billet configuré.</p>
            } @else {
              <div class="mt-5 space-y-4">
                @for (tt of ticketTypes(); track tt.id; let i = $index) {
                  <div>
                    <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="h-2 w-2 shrink-0 rounded-full"
                          [style.background]="ticketBarColor(i)"
                        ></span>
                        <span class="truncate font-medium text-text-primary">{{ tt.name }}</span>
                      </div>
                      <span class="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                        {{ tt.quantitySold }} / {{ tt.quantityTotal }}
                      </span>
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded-full bg-organizer-bg">
                      <div
                        class="organizer-stat-ticket-bar h-full"
                        [style.width.%]="soldPercent(tt)"
                        [style.--ticket-bar-accent]="ticketBarColor(i)"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </section>
        </div>
      }
    </div>
  `
})
export class EventStatsPage {
  readonly id = input<string>();

  private readonly eventService = inject(EventService);
  private readonly statsService = inject(StatsService);
  private readonly ticketService = inject(TicketService);

  protected readonly icons = { ArrowLeft, TrendingUp, Users, BarChart3 };

  protected readonly loading = signal(true);
  protected readonly event = signal<Event | null>(null);
  protected readonly stats = signal<OrganizerStats | null>(null);
  protected readonly ticketTypes = signal<TicketType[]>([]);

  protected readonly soldCount = computed(() =>
    this.ticketTypes().reduce((sum, ticketType) => sum + ticketType.quantitySold, 0)
  );

  protected readonly fillRate = computed(() => {
    const capacity = this.event()?.capacity ?? 0;
    const sold = this.soldCount();
    if (capacity <= 0) return 0;
    return Math.min(100, Math.round((sold / capacity) * 100));
  });

  constructor() {
    effect(() => {
      const eventId = this.id();
      if (eventId) this.load(eventId);
    });
  }

  protected hasData(points: { value: number }[] | undefined): boolean {
    return !!points && points.some((point) => point.value > 0);
  }

  protected soldPercent(ticketType: TicketType): number {
    if (ticketType.quantityTotal <= 0) return 0;
    return Math.min(100, Math.round((ticketType.quantitySold / ticketType.quantityTotal) * 100));
  }

  protected ticketBarColor(index: number): string {
    return TICKET_BAR_COLORS[index % TICKET_BAR_COLORS.length];
  }

  protected formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' MAD';
  }

  private load(eventId: string): void {
    this.loading.set(true);

    this.eventService.getById(eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
      },
      error: () => {
        this.event.set(null);
        this.loading.set(false);
      }
    });

    this.statsService.getEventStats(eventId).subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.stats.set(null)
    });

    this.ticketService.getTicketTypesByEvent(eventId).subscribe({
      next: (types) => this.ticketTypes.set(types),
      error: () => this.ticketTypes.set([])
    });
  }
}
