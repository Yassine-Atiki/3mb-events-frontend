import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarDays,
  LucideAngularModule,
  Shield,
  Users,
  Wallet
} from 'lucide-angular';

import { StatsService } from '../../core/api/stats.service';
import { AdminStats } from '../../core/models';
import { AdminAreaChartComponent } from '../../shared/admin/admin-area-chart.component';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { MonoCounterComponent } from '../../shared/organizer/mono-counter.component';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { SparklineComponent } from '../../shared/organizer/sparkline.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_REVISION: 'En révision',
  PUBLIE: 'Publié',
  COMPLET: 'Complet',
  ANNULE: 'Annulé',
  ARCHIVE: 'Archivé'
};

@Component({
  selector: 'app-admin-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    SkeletonComponent,
    SparklineComponent,
    MonoCounterComponent,
    OccupancyArcComponent,
    AdminAreaChartComponent,
    AdminDonutChartComponent,
    AdminStatusSpectrumComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.Shield" [size]="12"></lucide-angular>
            <span>Centre de contrôle</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Tableau de bord admin</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Vue mission control de la plateforme 3MB Events — croissance, revenus et santé opérationnelle.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            routerLink="/admin/utilisateurs"
            class="admin-quick-link"
          >
            Utilisateurs
            <lucide-angular [img]="icons.ArrowUpRight" [size]="14"></lucide-angular>
          </a>
          <a routerLink="/admin/moderation" class="admin-quick-link">
            Modération
            <lucide-angular [img]="icons.ArrowUpRight" [size]="14"></lucide-angular>
          </a>
          <a routerLink="/admin/rapports" class="admin-quick-link">
            Rapports
            <lucide-angular [img]="icons.ArrowUpRight" [size]="14"></lucide-angular>
          </a>
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-8" height="320px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="320px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-5" height="280px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-7" height="280px" rounded="2xl" />
        </div>
      } @else if (stats(); as s) {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Utilisateurs</p>
                <p class="admin-command-metric-value">{{ s.totalUsers }}</p>
              </div>
              <app-sparkline class="ml-auto hidden sm:block" [values]="usersTrend()" [width]="88" [height]="30" color="#7BDAC2" ariaLabel="Tendance utilisateurs" />
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Building2" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Organisateurs</p>
                <p class="admin-command-metric-value">{{ s.totalOrganizers }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ organizerShare() }}% de la base</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.CalendarDays" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Événements</p>
                <p class="admin-command-metric-value">{{ s.totalEvents }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ publishedCount() }} publiés</span>
            </article>

            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.Wallet" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Revenu plateforme</p>
                <p class="admin-command-metric-value">
                  {{ s.totalRevenue }}<span class="ml-1 text-sm font-medium text-white/70">MAD</span>
                </p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">{{ avgRevenuePerEvent() }} MAD / evt</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Croissance</p>
                <h2 class="admin-bento-title">Nouveaux utilisateurs</h2>
                <p class="admin-bento-subtitle">Courbe d'acquisition sur les 6 derniers mois</p>
              </div>
              <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 font-mono text-xs font-semibold tabular-nums text-brand-teal-dark">
                +{{ usersGrowthRate() }}% vs M-1
              </div>
            </div>

            <div class="mt-6 h-52">
              <app-admin-area-chart
                [points]="s.usersOverTime"
                [showLabels]="true"
                color="#53B29A"
                ariaLabel="Nouveaux utilisateurs sur 6 mois"
              />
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              @for (point of s.usersOverTime; track point.label) {
                <div class="admin-chart-pill">
                  <span class="admin-chart-pill-value">{{ point.value }}</span>
                  <span class="admin-chart-pill-label">{{ point.label }}</span>
                </div>
              }
            </div>
          </section>

          <section class="admin-bento-tile admin-bento-tile--dark xl:col-span-4">
            <p class="admin-bento-eyebrow text-white/55">Performance</p>
            <h2 class="admin-bento-title text-white">Santé plateforme</h2>
            <p class="admin-bento-subtitle text-white/60">Taux d'événements publiés et actifs</p>

            <div class="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
              <app-occupancy-arc
                [current]="publishedCount()"
                [max]="Math.max(1, s.totalEvents)"
                [size]="168"
                [strokeWidth]="12"
                label="Publiés"
                accent="#7BDAC2"
                track="rgba(255,255,255,0.12)"
              />
              <div class="text-center sm:text-left">
                <app-mono-counter [value]="platformHealth()" size="xl" />
                <p class="mt-1 text-sm font-medium text-white/70">% de couverture live</p>
                <p class="mt-3 max-w-[220px] text-xs leading-relaxed text-white/55">
                  {{ publishedCount() }} événements publiés sur {{ s.totalEvents }} au catalogue global.
                </p>
              </div>
            </div>

            <div class="mt-6 grid grid-cols-2 gap-3">
              <div class="admin-dark-stat">
                <lucide-angular [img]="icons.Activity" [size]="15" class="text-brand-teal-light"></lucide-angular>
                <span class="admin-dark-stat-label">Actifs</span>
                <span class="admin-dark-stat-value">{{ activeEvents() }}</span>
              </div>
              <div class="admin-dark-stat">
                <lucide-angular [img]="icons.Users" [size]="15" class="text-brand-teal-light"></lucide-angular>
                <span class="admin-dark-stat-label">Ratio org.</span>
                <span class="admin-dark-stat-value">{{ organizerShare() }}%</span>
              </div>
            </div>
          </section>

          <section class="admin-bento-tile xl:col-span-5">
            <p class="admin-bento-eyebrow">Catalogue</p>
            <h2 class="admin-bento-title">Événements par catégorie</h2>
            <p class="admin-bento-subtitle">Répartition chromatique du portefeuille</p>
            <div class="mt-6">
              <app-admin-donut-chart [points]="s.eventsByCategory" />
            </div>
          </section>

          <section class="admin-bento-tile xl:col-span-7">
            <p class="admin-bento-eyebrow">Pipeline</p>
            <h2 class="admin-bento-title">Spectre des statuts</h2>
            <p class="admin-bento-subtitle">De la création à la publication — lecture instantanée du flux</p>
            <div class="mt-6">
              <app-admin-status-spectrum [points]="s.eventsByStatus" [labelMap]="statusLabels" />
            </div>
          </section>
        </div>
      }
    </div>
  `
})
export class AdminDashboardPage {
  private readonly statsService = inject(StatsService);

  protected readonly icons = { Shield, Users, Building2, CalendarDays, Wallet, Activity, ArrowUpRight };
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly Math = Math;

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly loading = signal(true);

  protected readonly usersTrend = computed(() => this.stats()?.usersOverTime.map((p) => p.value) ?? []);

  protected readonly publishedCount = computed(
    () => this.stats()?.eventsByStatus.find((point) => point.label === 'PUBLIE')?.value ?? 0
  );

  protected readonly activeEvents = computed(() => {
    const stats = this.stats();
    if (!stats) return 0;
    return stats.eventsByStatus
      .filter((point) => point.label === 'PUBLIE' || point.label === 'COMPLET')
      .reduce((sum, point) => sum + point.value, 0);
  });

  protected readonly platformHealth = computed(() => {
    const stats = this.stats();
    if (!stats || stats.totalEvents === 0) return 0;
    return Math.round((this.publishedCount() / stats.totalEvents) * 100);
  });

  protected readonly organizerShare = computed(() => {
    const stats = this.stats();
    if (!stats || stats.totalUsers === 0) return 0;
    return Math.round((stats.totalOrganizers / stats.totalUsers) * 100);
  });

  protected readonly avgRevenuePerEvent = computed(() => {
    const stats = this.stats();
    if (!stats || stats.totalEvents === 0) return 0;
    return Math.round(stats.totalRevenue / stats.totalEvents);
  });

  protected readonly usersGrowthRate = computed(() => {
    const trend = this.usersTrend();
    if (trend.length < 2) return 0;
    const prev = trend[trend.length - 2];
    const last = trend[trend.length - 1];
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  });

  constructor() {
    this.statsService.getAdminStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
