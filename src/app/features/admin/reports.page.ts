import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Banknote,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  LucideAngularModule,
  ScrollText,
  Users
} from 'lucide-angular';
import { catchError, forkJoin, Observable, of } from 'rxjs';

import { AdminService } from '../../core/api/admin.service';
import { EventService } from '../../core/api/event.service';
import { RefundService } from '../../core/api/refund.service';
import { StatsService } from '../../core/api/stats.service';
import { UserService } from '../../core/api/user.service';
import { AdminStats, ChartPoint } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

type ExportFormat = 'pdf' | 'excel';

interface ReportCounts {
  users: number;
  events: number;
  refunds: number;
  audit: number;
}

interface ReportDefinition {
  id: keyof ReportCounts;
  code: string;
  title: string;
  description: string;
  accent: string;
  icon: typeof FileText;
  fetch: () => Observable<unknown>;
}

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel (.xlsx)' }
];

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF',
  excel: 'Excel'
};

const FORMAT_COLORS: Record<ExportFormat, string> = {
  pdf: '#F43F5E',
  excel: '#22C55E'
};

@Component({
  selector: 'app-admin-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    SelectComponent,
    SkeletonComponent,
    AdminDonutChartComponent,
    AdminStatusSpectrumComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.FileText" [size]="12"></lucide-angular>
            <span>Exports documentaires</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Rapports</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Générez des exports PDF ou Excel de l'activité plateforme — utilisateurs, événements, remboursements et audit.
          </p>
        </div>
        <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
          {{ sessionExports() }} export{{ sessionExports() > 1 ? 's' : '' }} cette session
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="520px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="520px" rounded="2xl" />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.FileText" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Modèles disponibles</p>
                <p class="admin-command-metric-value">{{ reports.length }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">types de rapports</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Download" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Enregistrements exportables</p>
                <p class="admin-command-metric-value">{{ totalRecords() }}</p>
              </div>
              <span class="admin-command-metric-chip">lignes cumulées</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Base utilisateurs</p>
                <p class="admin-command-metric-value">{{ stats()?.totalUsers ?? counts().users }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ stats()?.totalOrganizers ?? 0 }} organisateurs</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.CalendarDays" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Événements catalogue</p>
                <p class="admin-command-metric-value">{{ stats()?.totalEvents ?? counts().events }}</p>
              </div>
              <span class="admin-command-metric-chip">
                {{ formatRevenue(stats()?.totalRevenue ?? 0) }} MAD revenus
              </span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div>
              <p class="admin-bento-eyebrow">Catalogue</p>
              <h2 class="admin-bento-title">Modèles d'export</h2>
              <p class="admin-bento-subtitle">Choisissez le format puis lancez la génération — livraison par e-mail</p>
            </div>

            <div class="admin-report-grid mt-5">
              @for (report of reports; track report.id) {
                <article class="admin-report-card" [style.--report-accent]="report.accent">
                  <div class="admin-report-card-header">
                    <div class="flex items-start justify-between gap-3">
                      <span class="admin-report-card-icon">
                        <lucide-angular [img]="report.icon" [size]="17"></lucide-angular>
                      </span>
                      <span class="admin-report-card-count">{{ recordCount(report.id) }} lignes</span>
                    </div>
                    <p class="relative z-[1] mt-3 text-base font-semibold text-white">{{ report.title }}</p>
                    <span class="admin-report-card-code">Réf. {{ report.code }}</span>
                  </div>

                  <div class="admin-report-card-body">
                    <p class="text-sm leading-relaxed text-text-secondary">{{ report.description }}</p>
                    <app-ui-select
                      class="mt-auto"
                      [clearable]="false"
                      [options]="formatOptions"
                      [ngModel]="formats()[report.id] ?? 'pdf'"
                      (ngModelChange)="setFormat(report.id, $event)"
                    />
                  </div>

                  <div class="admin-report-card-footer">
                    <span class="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                      @if ((formats()[report.id] ?? 'pdf') === 'pdf') {
                        <lucide-angular [img]="icons.FileText" [size]="12"></lucide-angular>
                      } @else {
                        <lucide-angular [img]="icons.FileSpreadsheet" [size]="12"></lucide-angular>
                      }
                      {{ (formats()[report.id] ?? 'pdf') === 'pdf' ? 'PDF' : 'XLSX' }}
                    </span>
                    <app-ui-button size="sm" [loading]="loadingId() === report.id" (clicked)="launchExport(report)">
                      Générer
                    </app-ui-button>
                  </div>
                </article>
              }
            </div>
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Volume</p>
              <h2 class="admin-bento-title">Données par rapport</h2>
              <div class="mt-5">
                <app-admin-donut-chart [points]="recordChart()" ariaLabel="Volume de données par type de rapport" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Formats</p>
              <h2 class="admin-bento-title">Préférences d'export</h2>
              <div class="mt-5">
                <app-admin-status-spectrum
                  [points]="formatChart()"
                  [labelMap]="formatLabels"
                  [colorMap]="formatColors"
                  ariaLabel="Répartition des formats d'export sélectionnés"
                />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Guide</p>
              <h2 class="admin-bento-title">Bonnes pratiques</h2>
              <div class="mt-4 space-y-2">
                <p class="admin-report-tip">
                  Les exports volumineux (&gt; 1 000 lignes) sont traités en arrière-plan et envoyés par e-mail.
                </p>
                <p class="admin-report-tip">
                  Le journal d'audit conserve la traçabilité des actions sensibles — exportez-le mensuellement.
                </p>
                <p class="admin-report-tip">
                  Excel convient aux analyses ; PDF pour l'archivage et le partage formel.
                </p>
              </div>
            </section>
          </div>
        </div>
      }
    </div>
  `
})
export class AdminReportsPage {
  private readonly userService = inject(UserService);
  private readonly eventService = inject(EventService);
  private readonly refundService = inject(RefundService);
  private readonly adminService = inject(AdminService);
  private readonly statsService = inject(StatsService);
  private readonly toast = inject(ToastService);

  protected readonly icons = {
    FileText,
    FileSpreadsheet,
    Users,
    CalendarDays,
    Banknote,
    ScrollText,
    Download
  };
  protected readonly formatOptions = FORMAT_OPTIONS;
  protected readonly formatLabels = FORMAT_LABELS;
  protected readonly formatColors = FORMAT_COLORS;

  protected readonly reports: ReportDefinition[] = [
    {
      id: 'users',
      code: 'USR-01',
      title: 'Utilisateurs',
      description: "Liste complète des utilisateurs avec rôle, statut et date d'inscription.",
      accent: '#6366F1',
      icon: Users,
      fetch: () => this.userService.search({ page: 0, size: 1 })
    },
    {
      id: 'events',
      code: 'EVT-01',
      title: 'Événements',
      description: 'Tous les événements, tous statuts, avec organisateurs et lieux associés.',
      accent: '#53B29A',
      icon: CalendarDays,
      fetch: () => this.eventService.search({ page: 0, size: 1 })
    },
    {
      id: 'refunds',
      code: 'RFD-01',
      title: 'Remboursements',
      description: 'Historique des demandes de remboursement et leur traitement administratif.',
      accent: '#F59E0B',
      icon: Banknote,
      fetch: () => this.refundService.search({ page: 0, size: 1 })
    },
    {
      id: 'audit',
      code: 'AUD-01',
      title: "Journal d'audit",
      description: 'Historique complet des actions administratives sur la plateforme.',
      accent: '#3B82F6',
      icon: ScrollText,
      fetch: () => this.adminService.getAuditLogs({ page: 0, size: 1 })
    }
  ];

  protected readonly loading = signal(true);
  protected readonly counts = signal<ReportCounts>({ users: 0, events: 0, refunds: 0, audit: 0 });
  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly formats = signal<Record<string, ExportFormat | undefined>>({});
  protected readonly loadingId = signal<string | null>(null);
  protected readonly sessionExports = signal(0);

  protected readonly totalRecords = computed(() => {
    const counts = this.counts();
    return counts.users + counts.events + counts.refunds + counts.audit;
  });

  protected readonly recordChart = computed<ChartPoint[]>(() => {
    const counts = this.counts();
    return [
      { label: 'Utilisateurs', value: counts.users },
      { label: 'Événements', value: counts.events },
      { label: 'Remboursements', value: counts.refunds },
      { label: 'Audit', value: counts.audit }
    ].filter((point) => point.value > 0);
  });

  protected readonly formatChart = computed<ChartPoint[]>(() => {
    const formats = this.formats();
    let pdf = 0;
    let excel = 0;
    for (const report of this.reports) {
      if ((formats[report.id] ?? 'pdf') === 'pdf') pdf += 1;
      else excel += 1;
    }
    return [
      { label: 'pdf', value: pdf },
      { label: 'excel', value: excel }
    ];
  });

  constructor() {
    this.loadOverview();
  }

  protected recordCount(id: keyof ReportCounts): number {
    return this.counts()[id];
  }

  protected setFormat(reportId: string, format: ExportFormat): void {
    this.formats.update((current) => ({ ...current, [reportId]: format }));
  }

  protected launchExport(report: ReportDefinition): void {
    this.loadingId.set(report.id);
    const format = this.formats()[report.id] ?? 'pdf';

    report.fetch().subscribe({
      next: () => {
        this.loadingId.set(null);
        this.sessionExports.update((count) => count + 1);
        this.toast.success(`Document généré : ${report.title} (${format.toUpperCase()}). Vous le recevrez par e-mail.`);
      },
      error: () => {
        this.loadingId.set(null);
        this.toast.error(`Impossible de générer le rapport "${report.title}".`);
      }
    });
  }

  protected formatRevenue(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  private loadOverview(): void {
    this.loading.set(true);

    forkJoin({
      users: this.userService.search({ page: 0, size: 1 }).pipe(catchError(() => of(null))),
      events: this.eventService.search({ page: 0, size: 1 }).pipe(catchError(() => of(null))),
      refunds: this.refundService.search({ page: 0, size: 1 }).pipe(catchError(() => of(null))),
      audit: this.adminService.getAuditLogs({ page: 0, size: 1 }).pipe(catchError(() => of(null))),
      stats: this.statsService.getAdminStats().pipe(catchError(() => of(null)))
    }).subscribe(({ users, events, refunds, audit, stats }) => {
      this.counts.set({
        users: users?.totalElements ?? 0,
        events: events?.totalElements ?? 0,
        refunds: refunds?.totalElements ?? 0,
        audit: audit?.totalElements ?? 0
      });
      this.stats.set(stats);
      this.loading.set(false);
    });
  }
}
