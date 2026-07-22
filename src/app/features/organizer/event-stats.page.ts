import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  LucideAngularModule,
  PieChart,
  Users,
  Wallet
} from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { StatsService } from '../../core/api/stats.service';
import { Event, EventAudit, EventAuditBreakdown } from '../../core/models';
import {
  downloadEventAudit,
  EventAuditExportFormat
} from '../../shared/organizer/event-audit-export.util';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

const TICKET_BAR_COLORS = ['#53B29A', '#6366F1', '#3B82F6', '#F59E0B', '#8B5CF6', '#F43F5E'];

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'excel', label: 'Excel (.xlsx)' }
];

interface CompositionRow {
  label: string;
  value: number;
  hint: string;
  color: string;
  percent: number;
}

@Component({
  selector: 'app-organizer-event-stats-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LucideAngularModule,
    EmptyStateComponent,
    SkeletonComponent,
    OccupancyArcComponent,
    ButtonComponent,
    SelectComponent
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
              <span>{{ isAfter() ? 'Audit post-événement' : 'Audit pré-événement' }}</span>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Statistiques</h1>
            <p class="mt-1 max-w-2xl text-sm text-text-secondary">{{ event()?.title ?? 'Chargement…' }}</p>
          </div>
          @if (audit(); as a) {
            <div class="produced-doc w-full max-w-sm p-4 pb-10">
              <div class="produced-doc-notch" style="left: -11px"></div>
              <div class="produced-doc-notch" style="right: -11px"></div>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-mono text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    Rapport généré
                  </p>
                  <p class="mt-1 text-sm font-semibold text-text-primary">
                    {{ exportFormat() === 'pdf' ? 'Audit PDF' : 'Audit Excel' }}
                  </p>
                  <p class="mt-0.5 text-xs text-text-secondary">
                    {{ isAfter() ? 'Bilan de présence & revenus' : 'Occupation & inscriptions' }}
                  </p>
                </div>
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal-dark"
                >
                  <lucide-angular
                    [img]="exportFormat() === 'pdf' ? icons.FileText : icons.FileSpreadsheet"
                    [size]="17"
                  ></lucide-angular>
                </span>
              </div>
              <div class="mt-4 space-y-3">
                <app-ui-select
                  [clearable]="false"
                  [options]="formatOptions"
                  [ngModel]="exportFormat()"
                  (ngModelChange)="setExportFormat($event)"
                />
                <app-ui-button size="sm" [loading]="exporting()" (clicked)="exportAudit()">
                  <lucide-angular [img]="icons.Download" [size]="14"></lucide-angular>
                  Exporter le rapport
                </app-ui-button>
              </div>
            </div>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-5" height="260px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-7" height="260px" rounded="2xl" />
        </div>
      } @else if (!event() || !audit()) {
        <app-ui-empty-state
          [title]="!event() ? 'Événement introuvable' : 'Audit indisponible'"
          [description]="!event() ? 'Cet événement n’existe pas ou n’est plus accessible.' : 'Impossible de charger l’audit. Réessayez dans un instant.'"
        />
      } @else {
        <section class="organizer-studio-hero">
          <div class="organizer-studio-hero-grid">
            @if (isAfter()) {
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #53B29A">
                <p class="organizer-stat-kpi-label">Présents</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.attendedCount }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #F43F5E">
                <p class="organizer-stat-kpi-label">No-shows</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.noShowCount }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #F59E0B">
                <p class="organizer-stat-kpi-label">Revenus nets</p>
                <p class="organizer-stat-kpi-value">{{ formatAmount(audit()!.finalRevenue) }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #3B82F6">
                <p class="organizer-stat-kpi-label">Taux de présence</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.attendanceRate }}%</p>
              </article>
            } @else {
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #53B29A">
                <p class="organizer-stat-kpi-label">Inscriptions</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.registeredCount }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #F59E0B">
                <p class="organizer-stat-kpi-label">Revenus</p>
                <p class="organizer-stat-kpi-value">{{ formatAmount(audit()!.revenueCollected) }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #6366F1">
                <p class="organizer-stat-kpi-label">Liste d'attente</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.waitlistCount }}</p>
              </article>
              <article class="organizer-stat-kpi" style="--stat-kpi-accent: #3B82F6">
                <p class="organizer-stat-kpi-label">Occupation</p>
                <p class="organizer-stat-kpi-value">{{ audit()!.occupancyRate }}%</p>
              </article>
            }
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="organizer-panel xl:col-span-5">
            <p class="organizer-panel-eyebrow">{{ isAfter() ? 'Présence' : 'Occupation' }}</p>
            <h2 class="organizer-panel-title">
              {{ isAfter() ? 'Taux de présence' : 'Taux d’occupation' }}
            </h2>
            <p class="organizer-panel-subtitle">
              {{
                isAfter()
                  ? 'Participants scannés vs inscriptions'
                  : 'Places réservées vs capacité'
              }}
            </p>
            <div class="mt-5 flex justify-center py-2">
              @if (isAfter()) {
                <app-occupancy-arc
                  [current]="audit()!.attendedCount"
                  [max]="Math.max(audit()!.registeredCount, 1)"
                  [size]="156"
                  label="Présence"
                  [showRatio]="true"
                  accent="#53B29A"
                />
              } @else {
                <app-occupancy-arc
                  [current]="audit()!.registeredQuantity"
                  [max]="audit()!.capacity"
                  [size]="156"
                  label="Occupation"
                  [showRatio]="true"
                  accent="#3B82F6"
                />
              }
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 text-center">
              @if (isAfter()) {
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Inscrits</p>
                  <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#6366F1]">
                    {{ audit()!.registeredCount }}
                  </p>
                </div>
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Écart</p>
                  <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#F43F5E]">
                    {{ audit()!.noShowCount }} no-show
                  </p>
                </div>
              } @else {
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Places</p>
                  <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#53B29A]">
                    {{ audit()!.registeredQuantity }} / {{ audit()!.capacity }}
                  </p>
                </div>
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 px-3 py-2">
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Remboursements</p>
                  <p class="mt-1 font-mono text-sm font-bold tabular-nums text-[#F59E0B]">
                    {{ audit()!.pendingRefundsCount }} en attente
                  </p>
                </div>
              }
            </div>
          </section>

          <section class="organizer-panel xl:col-span-7">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">Composition</p>
                <h2 class="organizer-panel-title">
                  {{ isAfter() ? 'Présence vs absences' : 'Places & demande' }}
                </h2>
                <p class="organizer-panel-subtitle">
                  {{
                    isAfter()
                      ? 'Répartition des inscrits le jour J'
                      : 'Où en est le remplissage avant l’événement'
                  }}
                </p>
              </div>
              <span
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: color-mix(in srgb, #6366F1 14%, white); color: #6366F1"
              >
                <lucide-angular [img]="icons.PieChart" [size]="17"></lucide-angular>
              </span>
            </div>
            @if (composition().length === 0) {
              <p class="mt-8 rounded-xl border border-dashed border-hairline bg-white/60 py-10 text-center text-sm text-text-secondary">
                Aucune donnée pour le moment.
              </p>
            } @else {
              <div class="mt-5 space-y-4">
                @for (row of composition(); track row.label) {
                  <div>
                    <div class="mb-1.5 flex items-end justify-between gap-3">
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-text-primary">{{ row.label }}</p>
                        <p class="text-xs text-text-secondary">{{ row.hint }}</p>
                      </div>
                      <p class="shrink-0 font-mono text-sm font-bold tabular-nums text-text-primary">
                        {{ row.value }}
                        <span class="text-xs font-medium text-text-secondary">· {{ row.percent }}%</span>
                      </p>
                    </div>
                    <div class="h-3 w-full overflow-hidden rounded-full bg-organizer-bg">
                      <div
                        class="h-full rounded-full transition-[width] duration-500"
                        [style.width.%]="row.percent"
                        [style.background]="row.color"
                      ></div>
                    </div>
                  </div>
                }
              </div>
              <p class="mt-5 border-t border-dashed border-hairline pt-4 text-xs text-text-secondary">
                @if (isAfter()) {
                  {{ audit()!.attendedCount }} présents sur {{ audit()!.registeredCount }} inscrits
                  ({{ audit()!.attendanceRate }}% de présence).
                } @else {
                  {{ audit()!.registeredQuantity }} place(s) prise(s) sur {{ audit()!.capacity }}
                  · {{ audit()!.waitlistCount }} en liste d’attente.
                }
              </p>
            }
          </section>

          <section class="organizer-panel xl:col-span-6">
            <p class="organizer-panel-eyebrow">Billetterie</p>
            <h2 class="organizer-panel-title">
              {{ isAfter() ? 'Présents par type' : 'Inscriptions par type' }}
            </h2>
            <p class="organizer-panel-subtitle">
              {{ isAfter() ? 'Répartition des participants scannés' : 'Répartition des inscriptions' }}
            </p>
            @if (breakdown().length === 0) {
              <p class="mt-6 text-sm text-text-secondary">Aucune donnée.</p>
            } @else {
              <div class="mt-5 space-y-4">
                @for (item of breakdown(); track item.ticketTypeId; let i = $index) {
                  <div>
                    <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="h-2 w-2 shrink-0 rounded-full"
                          [style.background]="ticketBarColor(i)"
                        ></span>
                        <span class="truncate font-medium text-text-primary">{{ item.ticketTypeName }}</span>
                      </div>
                      <span class="shrink-0 font-mono text-xs font-semibold tabular-nums text-text-primary">
                        {{ item.count }}
                      </span>
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded-full bg-organizer-bg">
                      <div
                        class="organizer-stat-ticket-bar h-full"
                        [style.width.%]="breakdownPercent(item)"
                        [style.--ticket-bar-accent]="ticketBarColor(i)"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            }
          </section>

          <section class="organizer-panel xl:col-span-6">
            <p class="organizer-panel-eyebrow">Finance</p>
            <h2 class="organizer-panel-title">{{ isAfter() ? 'Bilan financier' : 'Revenus collectés' }}</h2>
            <p class="organizer-panel-subtitle">
              {{ isAfter() ? 'Encaissements nets après remboursements' : 'Montant cumulé à ce jour' }}
            </p>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-hairline bg-organizer-bg/50 p-4">
                <div class="flex items-center gap-2 text-text-secondary">
                  <lucide-angular [img]="icons.Wallet" [size]="15"></lucide-angular>
                  <span class="text-[10px] font-semibold uppercase tracking-wide">
                    {{ isAfter() ? 'Revenus bruts' : 'Revenus' }}
                  </span>
                </div>
                <p class="mt-2 font-mono text-xl font-bold tabular-nums text-[#F59E0B]">
                  {{ formatAmount(audit()!.revenueCollected) }}
                </p>
              </div>
              @if (isAfter()) {
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 p-4">
                  <div class="flex items-center gap-2 text-text-secondary">
                    <lucide-angular [img]="icons.ClipboardList" [size]="15"></lucide-angular>
                    <span class="text-[10px] font-semibold uppercase tracking-wide">Remboursés</span>
                  </div>
                  <p class="mt-2 font-mono text-xl font-bold tabular-nums text-[#F43F5E]">
                    {{ formatAmount(audit()!.refundsProcessedAmount) }}
                  </p>
                  <p class="mt-1 text-xs text-text-secondary">
                    {{ audit()!.refundsProcessedCount }} traitement(s)
                  </p>
                </div>
              } @else {
                <div class="rounded-xl border border-hairline bg-organizer-bg/50 p-4">
                  <div class="flex items-center gap-2 text-text-secondary">
                    <lucide-angular [img]="icons.Users" [size]="15"></lucide-angular>
                    <span class="text-[10px] font-semibold uppercase tracking-wide">Capacité</span>
                  </div>
                  <p class="mt-2 font-mono text-xl font-bold tabular-nums text-text-primary">
                    {{ audit()!.capacity }}
                  </p>
                  <p class="mt-1 text-xs text-text-secondary">places ouvertes</p>
                </div>
              }
            </div>

            @if (isAfter()) {
              <div class="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-brand-teal-dark">
                  Comparaison inscrits / présents
                </p>
                <div class="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p class="font-mono text-2xl font-bold tabular-nums text-text-primary">
                      {{ audit()!.attendedCount }}
                      <span class="text-sm font-medium text-text-secondary">
                        / {{ audit()!.registeredCount }}
                      </span>
                    </p>
                    <p class="mt-1 text-xs text-text-secondary">
                      {{ audit()!.noShowRate }}% absents · {{ audit()!.attendanceRate }}% présents
                    </p>
                  </div>
                  <app-occupancy-arc
                    [current]="audit()!.attendedCount"
                    [max]="Math.max(audit()!.registeredCount, 1)"
                    [size]="64"
                    [showLabel]="false"
                    accent="#53B29A"
                  />
                </div>
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
  private readonly toast = inject(ToastService);

  protected readonly icons = {
    ArrowLeft,
    PieChart,
    Users,
    BarChart3,
    Download,
    FileSpreadsheet,
    FileText,
    Wallet,
    ClipboardList
  };
  protected readonly Math = Math;
  protected readonly formatOptions = FORMAT_OPTIONS;

  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly exportFormat = signal<EventAuditExportFormat>('pdf');
  protected readonly event = signal<Event | null>(null);
  protected readonly audit = signal<EventAudit | null>(null);

  protected readonly isAfter = computed(() => this.audit()?.phase === 'AFTER');

  protected readonly breakdown = computed<EventAuditBreakdown[]>(() => {
    const audit = this.audit();
    if (!audit) return [];
    return this.isAfter() ? audit.attendeesByTicketType : audit.registrationsByTicketType;
  });

  protected readonly composition = computed<CompositionRow[]>(() => {
    const audit = this.audit();
    if (!audit) return [];

    if (audit.phase === 'AFTER') {
      const rows = [
        {
          label: 'Présents',
          value: audit.attendedCount,
          hint: 'Participants scannés à l’entrée',
          color: '#53B29A'
        },
        {
          label: 'No-shows',
          value: audit.noShowCount,
          hint: 'Inscrits absents le jour J',
          color: '#F43F5E'
        }
      ];
      if (audit.waitlistCount > 0) {
        rows.push({
          label: 'Liste d’attente',
          value: audit.waitlistCount,
          hint: 'Non convertis en places',
          color: '#6366F1'
        });
      }
      const total = Math.max(1, rows.reduce((sum, row) => sum + row.value, 0));
      return rows
        .filter((row) => row.value > 0)
        .map((row) => ({
          ...row,
          percent: Math.round((row.value / total) * 100)
        }));
    }

    const freeSeats = Math.max(0, audit.capacity - audit.registeredQuantity);
    const rows = [
      {
        label: 'Places réservées',
        value: audit.registeredQuantity,
        hint: 'Déjà attribuées aux inscrits',
        color: '#53B29A'
      },
      {
        label: 'Places libres',
        value: freeSeats,
        hint: 'Encore disponibles à la vente',
        color: '#94A3B8'
      },
      {
        label: 'Liste d’attente',
        value: audit.waitlistCount,
        hint: 'Demande au-delà de la capacité',
        color: '#6366F1'
      }
    ];
    const total = Math.max(1, rows.reduce((sum, row) => sum + row.value, 0));
    return rows
      .filter((row) => row.value > 0)
      .map((row) => ({
        ...row,
        percent: Math.round((row.value / total) * 100)
      }));
  });

  constructor() {
    effect(() => {
      const eventId = this.id();
      if (eventId) this.load(eventId);
    });
  }

  protected breakdownPercent(item: EventAuditBreakdown): number {
    const list = this.breakdown();
    const max = Math.max(1, ...list.map((entry) => entry.count));
    return Math.max(6, Math.round((item.count / max) * 100));
  }

  protected ticketBarColor(index: number): string {
    return TICKET_BAR_COLORS[index % TICKET_BAR_COLORS.length];
  }

  protected formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' MAD';
  }

  protected setExportFormat(value: string): void {
    if (value === 'pdf' || value === 'excel') {
      this.exportFormat.set(value);
    }
  }

  protected exportAudit(): void {
    const audit = this.audit();
    if (!audit) return;
    this.exporting.set(true);
    try {
      downloadEventAudit(audit, this.exportFormat());
      this.toast.success(
        this.exportFormat() === 'pdf'
          ? 'Rapport PDF téléchargé.'
          : 'Rapport Excel téléchargé.'
      );
    } catch {
      this.toast.error('Impossible de générer le rapport.');
    } finally {
      this.exporting.set(false);
    }
  }

  private load(eventId: string): void {
    this.loading.set(true);

    this.eventService.getById(eventId).subscribe({
      next: (event) => this.event.set(event),
      error: () => this.event.set(null)
    });

    this.statsService.getEventAudit(eventId).subscribe({
      next: (audit) => {
        this.audit.set(audit);
        this.loading.set(false);
      },
      error: () => {
        this.audit.set(null);
        this.loading.set(false);
      }
    });
  }
}
