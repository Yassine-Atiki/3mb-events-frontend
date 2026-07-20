import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RotateCcw, ScrollText, Search, SlidersHorizontal, User } from 'lucide-angular';
import { Observable } from 'rxjs';

import { AdminService } from '../../core/api/admin.service';
import { AuditLogEntry, ChartPoint, PageResponse } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

const DAY_MS = 86_400_000;

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Création de compte',
  USER_SUSPENDED: 'Suspension utilisateur',
  USER_REACTIVATED: 'Réactivation utilisateur',
  IMPERSONATE_USER: 'Impersonation',
  EVENT_CREATED: 'Événement créé',
  EVENT_UPDATED: 'Événement modifié',
  EVENT_STATUS_CHANGED: 'Statut événement',
  EVENT_DELETED: 'Événement supprimé',
  EVENT_DUPLICATED: 'Événement dupliqué',
  PUBLIC_REGISTRATION_ENABLED: 'Lien inscription activé',
  PUBLIC_REGISTRATION_REVOKED: 'Lien inscription révoqué',
  REGISTRATION_CREATED: 'Inscription ajoutée',
  PUBLIC_REGISTRATION_CREATED: 'Inscription publique',
  REGISTRATION_CANCELLED: 'Inscription annulée',
  REGISTRATION_DELETED: 'Inscription supprimée',
  REGISTRATION_CHECKED_IN: 'Check-in participant',
  REGISTRATION_STATUS_CHANGED: 'Statut inscription',
  REGISTRATION_TICKET_TYPE_CHANGED: 'Billet modifié',
  TICKET_TYPE_CREATED: 'Type de billet créé',
  TICKET_TYPE_UPDATED: 'Type de billet modifié',
  TICKET_TYPE_DELETED: 'Type de billet supprimé',
  REFUND_REQUESTED: 'Remboursement demandé',
  APPROVE_REFUND: 'Remboursement approuvé',
  REJECT_REFUND: 'Remboursement rejeté',
  CATEGORY_CREATED: 'Catégorie créée',
  CATEGORY_UPDATED: 'Catégorie modifiée',
  CATEGORY_DELETED: 'Catégorie supprimée',
  VENUE_CREATED: 'Lieu créé',
  VENUE_UPDATED: 'Lieu modifié',
  VENUE_DELETED: 'Lieu supprimé',
  REPORT_EXPORTED: 'Rapport exporté'
};

const ACTION_COLORS: Record<string, string> = {
  USER_REGISTERED: '#53B29A',
  USER_SUSPENDED: '#F43F5E',
  USER_REACTIVATED: '#53B29A',
  IMPERSONATE_USER: '#8B5CF6',
  EVENT_CREATED: '#3B82F6',
  EVENT_UPDATED: '#0EA5E9',
  EVENT_STATUS_CHANGED: '#6366F1',
  EVENT_DELETED: '#94A3B8',
  EVENT_DUPLICATED: '#8B5CF6',
  PUBLIC_REGISTRATION_ENABLED: '#53B29A',
  PUBLIC_REGISTRATION_REVOKED: '#F59E0B',
  REGISTRATION_CREATED: '#53B29A',
  PUBLIC_REGISTRATION_CREATED: '#2B8A72',
  REGISTRATION_CANCELLED: '#F43F5E',
  REGISTRATION_DELETED: '#94A3B8',
  REGISTRATION_CHECKED_IN: '#0EA5E9',
  REGISTRATION_STATUS_CHANGED: '#6366F1',
  REGISTRATION_TICKET_TYPE_CHANGED: '#8B5CF6',
  TICKET_TYPE_CREATED: '#53B29A',
  TICKET_TYPE_UPDATED: '#0EA5E9',
  TICKET_TYPE_DELETED: '#F43F5E',
  REFUND_REQUESTED: '#F59E0B',
  APPROVE_REFUND: '#53B29A',
  REJECT_REFUND: '#F43F5E',
  CATEGORY_CREATED: '#3B82F6',
  CATEGORY_UPDATED: '#0EA5E9',
  CATEGORY_DELETED: '#94A3B8',
  VENUE_CREATED: '#3B82F6',
  VENUE_UPDATED: '#0EA5E9',
  VENUE_DELETED: '#94A3B8',
  REPORT_EXPORTED: '#6366F1'
};

interface Bucket {
  start: number;
  end: number;
  count: number;
  label: string;
}

@Component({
  selector: 'app-admin-audit-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
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
            <lucide-angular [img]="icons.ScrollText" [size]="12"></lucide-angular>
            <span>Traçabilité plateforme</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Journal d'audit</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Historique des actions sensibles — scrutez la frise temporelle et inspectez chaque événement.
          </p>
        </div>
        <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
          {{ visibleLogs().length }} / {{ logs().length }} entrées
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-12" height="120px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="520px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="520px" rounded="2xl" />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.ScrollText" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Entrées totales</p>
                <p class="admin-command-metric-value">{{ logs().length }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">historique complet</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.User" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Acteurs uniques</p>
                <p class="admin-command-metric-value">{{ uniqueActors() }}</p>
              </div>
              <span class="admin-command-metric-chip">comptes impliqués</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.ScrollText" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">7 derniers jours</p>
                <p class="admin-command-metric-value">{{ recentCount() }}</p>
              </div>
              <span class="admin-command-metric-chip">actions récentes</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.SlidersHorizontal" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Action dominante</p>
                <p class="admin-command-metric-value text-sm leading-tight">{{ dominantActionLabel() }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ dominantActionCount() }}×</span>
            </article>
          </div>
        </section>

        <section class="admin-bento-tile">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="admin-bento-eyebrow">Timeline</p>
              <h2 class="admin-bento-title">Frise d'activité</h2>
              <p class="admin-bento-subtitle">Glissez sur la frise pour cibler une période</p>
            </div>
            @if (selection(); as sel) {
              <button type="button" class="admin-link-action inline-flex items-center gap-1.5" (click)="clearSelection()">
                <lucide-angular [img]="icons.RotateCcw" [size]="13"></lucide-angular>
                {{ windowLabel() }}
              </button>
            }
          </div>

          <div class="admin-audit-scrubber-wrap mt-5">
            <div class="audit-scrubber" (mouseleave)="onScrubberLeave()">
              @for (bucket of buckets(); track bucket.start; let i = $index) {
                <div
                  class="audit-scrubber-cell"
                  [class.in-window]="inWindow(i)"
                  [style.--ink]="ink(bucket.count)"
                  [title]="bucket.label + ' · ' + bucket.count + ' action(s)'"
                  (mousedown)="startDrag(i, $event)"
                  (mouseenter)="onCellEnter(i)"
                ></div>
              }
            </div>
            <div class="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-text-secondary">
              <span>{{ rangeStartLabel() }}</span>
              <span>{{ rangeEndLabel() }}</span>
            </div>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Flux</p>
                <h2 class="admin-bento-title">Fil d'événements</h2>
                <p class="admin-bento-subtitle">Cliquez sur une entrée pour le détail complet</p>
              </div>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-surface-white px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:border-brand-teal/35"
                (click)="filterOpen.set(!filterOpen())"
              >
                <lucide-angular [img]="icons.SlidersHorizontal" [size]="13"></lucide-angular>
                Filtres
              </button>
            </div>

            @if (filterOpen()) {
              <div class="mt-4 grid gap-3 rounded-xl border border-hairline bg-surface-light/50 p-4 sm:grid-cols-3">
                <app-ui-input
                  label="Acteur ou action"
                  [leadingIcon]="icons.Search"
                  [ngModel]="textFilter()"
                  (ngModelChange)="textFilter.set($event)"
                />
                <app-ui-input label="Depuis" type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event)" />
                <app-ui-input label="Jusqu'à" type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event)" />
              </div>
            }

            @if (visibleLogs().length === 0) {
              <div class="mt-8">
                <app-ui-empty-state title="Aucune entrée" description="Aucun événement ne correspond à cette sélection." />
              </div>
            } @else {
              <div class="admin-audit-feed mt-5">
                @for (log of visibleLogs(); track log.id; let last = $last) {
                  <button
                    type="button"
                    class="admin-audit-entry"
                    [style.--audit-accent]="actionColor(log.action)"
                    (click)="selectedLog.set(log)"
                  >
                    <div class="admin-audit-entry-rail">
                      <span class="admin-audit-entry-dot" aria-hidden="true"></span>
                      @if (!last) {
                        <span class="admin-audit-entry-line" aria-hidden="true"></span>
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="admin-audit-action-pill" [class]="actionPillClass(log.action)">
                          {{ actionLabel(log.action) }}
                        </span>
                        <span class="font-mono text-[10px] tabular-nums text-text-secondary">
                          {{ formatDateTime(log.createdAt) }}
                        </span>
                      </div>
                      <p class="mt-1.5 text-sm font-semibold text-text-primary">{{ log.actorName }}</p>
                      <p class="mt-0.5 text-xs text-text-secondary">
                        <span class="admin-tag font-sans">{{ log.targetType }}</span>
                        <span class="ml-1.5 font-mono">{{ log.targetId }}</span>
                      </p>
                    </div>
                  </button>
                }
              </div>
            }
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Cibles</p>
              <h2 class="admin-bento-title">Types d'entités</h2>
              <div class="mt-5">
                <app-admin-donut-chart [points]="targetChart()" ariaLabel="Répartition par type d'entité" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Actions</p>
              <h2 class="admin-bento-title">Spectre des opérations</h2>
              <div class="mt-5">
                <app-admin-status-spectrum
                  [points]="actionChart()"
                  [labelMap]="actionLabels"
                  [colorMap]="actionColors"
                  ariaLabel="Répartition des types d'actions"
                />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Acteurs</p>
              <h2 class="admin-bento-title">Plus actifs</h2>
              <div class="mt-4 space-y-2">
                @for (actor of topActors(); track actor.name) {
                  <div class="admin-audit-actor-rank">
                    <span class="truncate font-medium text-text-primary">{{ actor.name }}</span>
                    <span class="font-mono text-xs font-semibold tabular-nums text-brand-teal-dark">{{ actor.count }}</span>
                  </div>
                }
              </div>
            </section>
          </div>
        </div>
      }
    </div>

    <app-ui-modal [open]="selectedLog() !== null" title="Détail de l'action" (close)="selectedLog.set(null)">
      @if (selectedLog(); as log) {
        <div class="flex flex-col gap-4">
          <div class="admin-modal-hero">
            <span class="admin-audit-action-pill" [class]="actionPillClass(log.action)">
              {{ actionLabel(log.action) }}
            </span>
            <p class="mt-3 text-lg font-semibold text-white">{{ log.actorName }}</p>
            <p class="mt-1 font-mono text-sm text-white/70">{{ formatDateTime(log.createdAt) }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Cible</p>
              <p class="mt-1 font-medium text-text-primary">{{ log.targetType }}</p>
            </div>
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Identifiant</p>
              <p class="mt-1 font-mono text-xs text-text-primary">{{ log.targetId }}</p>
            </div>
          </div>

          @if (log.metadata && hasMetadata(log.metadata)) {
            <div>
              <p class="mb-2 text-sm font-semibold text-text-primary">Métadonnées</p>
              <pre class="overflow-x-auto rounded-xl border border-hairline bg-surface-light p-3 font-mono text-xs text-text-primary">{{ formatMetadata(log.metadata) }}</pre>
            </div>
          }
        </div>
      }
    </app-ui-modal>
  `
})
export class AdminAuditLogPage {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { SlidersHorizontal, RotateCcw, ScrollText, Search, User };
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly actionColors = ACTION_COLORS;

  protected readonly logs = signal<AuditLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedLog = signal<AuditLogEntry | null>(null);

  protected readonly filterOpen = signal(false);
  protected readonly textFilter = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');

  protected readonly selection = signal<{ from: number; to: number } | null>(null);
  private readonly dragging = signal(false);
  private readonly dragAnchor = signal<number | null>(null);

  protected readonly buckets = computed<Bucket[]>(() => {
    const logs = this.logs();
    if (logs.length === 0) return [];
    const times = logs.map((log) => new Date(log.createdAt).getTime());
    const minDay = this.floorToDay(Math.min(...times));
    const maxDay = this.floorToDay(Math.max(...times));
    const dayCount = Math.min(120, Math.round((maxDay - minDay) / DAY_MS) + 1);

    const cells: Bucket[] = [];
    for (let i = 0; i < dayCount; i += 1) {
      const start = minDay + i * DAY_MS;
      const end = start + DAY_MS;
      const count = times.filter((time) => time >= start && time < end).length;
      cells.push({ start, end, count, label: this.formatDay(start) });
    }
    return cells;
  });

  protected readonly maxCount = computed(() => Math.max(1, ...this.buckets().map((bucket) => bucket.count)));

  protected readonly visibleLogs = computed<AuditLogEntry[]>(() => {
    const term = this.textFilter().trim().toLowerCase();
    const from = this.fromDate() ? new Date(this.fromDate()).getTime() : null;
    const to = this.toDate() ? new Date(this.toDate()).getTime() + DAY_MS : null;
    const sel = this.selection();
    const buckets = this.buckets();
    const selStart = sel ? (buckets[Math.min(sel.from, sel.to)]?.start ?? null) : null;
    const selEnd = sel ? (buckets[Math.max(sel.from, sel.to)]?.end ?? null) : null;

    return this.logs()
      .filter((log) => {
        const time = new Date(log.createdAt).getTime();
        if (selStart !== null && selEnd !== null && (time < selStart || time >= selEnd)) return false;
        if (from !== null && time < from) return false;
        if (to !== null && time >= to) return false;
        if (
          term &&
          !`${log.actorName} ${log.action} ${log.targetType} ${log.targetId}`.toLowerCase().includes(term)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly uniqueActors = computed(
    () => new Set(this.logs().map((log) => log.actorUserId)).size
  );

  protected readonly recentCount = computed(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    return this.logs().filter((log) => new Date(log.createdAt).getTime() >= cutoff).length;
  });

  protected readonly dominantAction = computed(() => {
    const counts = new Map<string, number>();
    for (const log of this.logs()) {
      counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
    }
    let topAction = '';
    let topCount = 0;
    for (const [action, count] of counts) {
      if (count > topCount) {
        topAction = action;
        topCount = count;
      }
    }
    return { action: topAction, count: topCount };
  });

  protected readonly dominantActionLabel = computed(() => {
    const action = this.dominantAction().action;
    return action ? this.actionLabel(action) : '—';
  });

  protected readonly dominantActionCount = computed(() => this.dominantAction().count);

  protected readonly targetChart = computed<ChartPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const log of this.logs()) {
      counts.set(log.targetType, (counts.get(log.targetType) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  });

  protected readonly actionChart = computed<ChartPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const log of this.logs()) {
      counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  });

  protected readonly topActors = computed(() => {
    const counts = new Map<string, number>();
    for (const log of this.logs()) {
      counts.set(log.actorName, (counts.get(log.actorName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  protected readonly windowLabel = computed(() => {
    const sel = this.selection();
    const buckets = this.buckets();
    if (!sel || buckets.length === 0) return '';
    const from = buckets[Math.min(sel.from, sel.to)];
    const to = buckets[Math.max(sel.from, sel.to)];
    if (!from || !to) return '';
    return from.label === to.label ? from.label : `${from.label} → ${to.label}`;
  });

  protected readonly rangeStartLabel = computed(() => this.buckets()[0]?.label ?? '');
  protected readonly rangeEndLabel = computed(() => this.buckets()[this.buckets().length - 1]?.label ?? '');

  constructor() {
    this.fetchLogs();
  }

  @HostListener('document:mouseup')
  protected endDrag(): void {
    this.dragging.set(false);
    this.dragAnchor.set(null);
  }

  protected actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action.replaceAll('_', ' ');
  }

  protected actionColor(action: string): string {
    return ACTION_COLORS[action] ?? '#53B29A';
  }

  protected actionPillClass(action: string): string {
    if (action.startsWith('USER_')) return 'admin-audit-action-pill admin-audit-action-pill--user';
    if (action.startsWith('EVENT_')) return 'admin-audit-action-pill admin-audit-action-pill--event';
    if (action.startsWith('REGISTRATION_') || action.startsWith('PUBLIC_REGISTRATION_')) {
      return 'admin-audit-action-pill admin-audit-action-pill--event';
    }
    if (action.startsWith('REFUND_')) return 'admin-audit-action-pill admin-audit-action-pill--refund';
    return 'admin-audit-action-pill admin-audit-action-pill--default';
  }

  protected ink(count: number): number {
    return count / this.maxCount();
  }

  protected inWindow(index: number): boolean {
    const sel = this.selection();
    if (!sel) return false;
    return index >= Math.min(sel.from, sel.to) && index <= Math.max(sel.from, sel.to);
  }

  protected startDrag(index: number, event: MouseEvent): void {
    event.preventDefault();
    this.dragging.set(true);
    this.dragAnchor.set(index);
    this.selection.set({ from: index, to: index });
  }

  protected onCellEnter(index: number): void {
    if (!this.dragging()) return;
    const anchor = this.dragAnchor();
    if (anchor === null) return;
    this.selection.set({ from: anchor, to: index });
  }

  protected onScrubberLeave(): void {
    // keep current selection; drag continues only while re-entering
  }

  protected clearSelection(): void {
    this.selection.set(null);
  }

  protected hasMetadata(metadata: Record<string, unknown>): boolean {
    return Object.keys(metadata).length > 0;
  }

  protected formatMetadata(metadata: Record<string, unknown>): string {
    return JSON.stringify(metadata, null, 2);
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  private floorToDay(ms: number): number {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  private formatDay(ms: number): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(ms));
  }

  private fetchLogs(): void {
    this.loading.set(true);
    this.fetchLogsPage(0, []).subscribe({
      next: (res) => {
        this.logs.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.logs.set([]);
        this.loading.set(false);
        this.toast.error("Impossible de charger le journal d'audit.");
      }
    });
  }

  private fetchLogsPage(page: number, acc: AuditLogEntry[]) {
    return new Observable<AuditLogEntry[]>((subscriber) => {
      this.adminService.getAuditLogs({ page, size: 100, sort: 'createdAt,desc' }).subscribe({
        next: (res: PageResponse<AuditLogEntry>) => {
          const nextAcc = [...acc, ...res.content];
          if (page + 1 < res.totalPages) {
            this.fetchLogsPage(page + 1, nextAcc).subscribe(subscriber);
          } else {
            subscriber.next(nextAcc);
            subscriber.complete();
          }
        },
        error: (err) => subscriber.error(err)
      });
    });
  }
}
