import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BarChart3,
  ClipboardList,
  Copy,
  LayoutGrid,
  LucideAngularModule,
  Pencil,
  Plus,
  ScanLine,
  Sparkles,
  Table as TableIcon,
  Ticket as TicketIcon,
  Trash2
} from 'lucide-angular';
import { debounceTime, startWith } from 'rxjs';

import { EventService } from '../../core/api/event.service';
import { RefundService } from '../../core/api/refund.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Event } from '../../core/models';
import { eventFunctionalStatus } from '../../shared/organizer/functional-status';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { OccupancyService } from '../../shared/organizer/occupancy.service';
import { StatusDotComponent } from '../../shared/organizer/status-dot.component';
import { buildUrgencyList, EventUrgency } from '../../shared/organizer/urgency.util';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'EN_REVISION', label: 'En révision' },
  { value: 'PUBLIE', label: 'Publié' },
  { value: 'COMPLET', label: 'Complet' },
  { value: 'ANNULE', label: 'Annulé' },
  { value: 'ARCHIVE', label: 'Archivé' }
];

type ViewMode = 'wall' | 'table';

interface AttentionTile extends EventUrgency {
  reason: string;
}

@Component({
  selector: 'app-organizer-events-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    SelectComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StatusDotComponent,
    OccupancyArcComponent
  ],
  template: `
    <div class="organizer-page mx-auto max-w-6xl">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary">Mes événements</h1>
          <p class="mt-1 text-sm text-text-secondary">Le mur met en avant ce qui compte maintenant.</p>
        </div>
        <a routerLink="/organisateur/evenements/nouveau">
          <app-ui-button>
            <lucide-angular [img]="icons.Plus" [size]="16"></lucide-angular>
            Nouvel événement
          </app-ui-button>
        </a>
      </header>

      <!-- Toolbar -->
      <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form [formGroup]="filterForm" class="grid flex-1 gap-3 sm:grid-cols-[1fr_200px]">
          <app-ui-input placeholder="Rechercher..." formControlName="query" />
          <app-ui-select [options]="statusOptions" formControlName="status" />
        </form>
        <div class="inline-flex shrink-0 rounded-lg border border-hairline bg-organizer-surface p-1">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [class.bg-brand-teal]="view() === 'wall'"
            [class.text-white]="view() === 'wall'"
            [class.text-text-secondary]="view() !== 'wall'"
            (click)="view.set('wall')"
          >
            <lucide-angular [img]="icons.LayoutGrid" [size]="14"></lucide-angular>
            Mur
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [class.bg-brand-teal]="view() === 'table'"
            [class.text-white]="view() === 'table'"
            [class.text-text-secondary]="view() !== 'table'"
            (click)="view.set('table')"
          >
            <lucide-angular [img]="icons.TableIcon" [size]="14"></lucide-angular>
            Table
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          <app-ui-skeleton height="240px" rounded="2xl" />
          <app-ui-skeleton height="240px" rounded="2xl" />
        </div>
      } @else if (filteredEvents().length === 0) {
        <div class="mt-6">
          <app-ui-empty-state title="Aucun événement trouvé" description="Ajustez vos filtres ou créez un événement.">
            <lucide-angular icon [img]="icons.Sparkles" [size]="22"></lucide-angular>
          </app-ui-empty-state>
        </div>
      } @else if (view() === 'wall') {
        <!-- ==================== WALL ==================== -->

        <!-- Top row: Needs attention now -->
        @if (attentionTiles().length > 0) {
          <section class="mt-6">
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              À traiter maintenant
            </h2>
            <div class="grid gap-4" [class.sm:grid-cols-2]="attentionTiles().length > 1">
              @for (tile of attentionTiles(); track tile.event.id) {
                <article class="event-wall-tile card-hover-lift group min-h-[220px]">
                  <img
                    [ngSrc]="tile.event.coverImageUrl"
                    [alt]="tile.event.title"
                    fill
                    priority
                    class="object-cover"
                  />
                  <div class="photo-scrim absolute inset-0"></div>

                  <span
                    class="absolute left-4 top-4 rounded-md bg-white/90 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-charcoal backdrop-blur-sm"
                  >
                    {{ formatDay(tile.event.startAt) }}
                  </span>
                  <span
                    class="absolute right-4 top-4 rounded-full bg-charcoal/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm"
                  >
                    {{ tile.reason }}
                  </span>

                  <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                    <div class="min-w-0">
                      <h3 class="truncate text-lg font-bold text-white">{{ tile.event.title }}</h3>
                      <div class="mt-1.5 flex items-center gap-2">
                        <span
                          class="h-2 w-2 rounded-full"
                          [style.background-color]="statusColorFor(tile.event.status)"
                        ></span>
                        <span class="text-xs font-medium text-white/85">{{ statusFor(tile.event.status).label }}</span>
                      </div>
                    </div>
                    <div class="shrink-0 rounded-full bg-charcoal/45 p-1 backdrop-blur-sm">
                      <app-occupancy-arc
                        [current]="tile.occupied"
                        [max]="tile.event.capacity"
                        [size]="60"
                        [strokeWidth]="5"
                        [showLabel]="true"
                        accent="#7BDAC2"
                        track="rgba(255,255,255,0.25)"
                      />
                    </div>
                  </div>

                  <div class="event-wall-actionbar absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-charcoal/85 py-2 backdrop-blur-sm">
                    <a
                      [routerLink]="['/organisateur/evenements', tile.event.id, 'modifier']"
                      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                    >
                      <lucide-angular [img]="icons.Pencil" [size]="14"></lucide-angular>
                      Éditer
                    </a>
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                      (click)="duplicate(tile.event)"
                    >
                      <lucide-angular [img]="icons.Copy" [size]="14"></lucide-angular>
                      Dupliquer
                    </button>
                    <a
                      [routerLink]="['/organisateur/scan', tile.event.id]"
                      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                    >
                      <lucide-angular [img]="icons.ScanLine" [size]="14"></lucide-angular>
                      Scanner
                    </a>
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-red-500/80 disabled:opacity-50"
                      title="Supprimer"
                      [disabled]="deletingId() === tile.event.id"
                      (click)="deleteEvent(tile.event, $event)"
                    >
                      <lucide-angular [img]="icons.Trash2" [size]="14"></lucide-angular>
                      Supprimer
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        <!-- Middle: active/upcoming masonry -->
        @if (activeTiles().length > 0) {
          <section class="mt-6">
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Actifs & à venir
            </h2>
            <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
              @for (tile of activeTiles(); track tile.event.id) {
                <article class="event-wall-tile card-hover-lift group aspect-[4/3]">
                  <img [ngSrc]="tile.event.coverImageUrl" [alt]="tile.event.title" fill class="object-cover" />
                  <div class="photo-scrim absolute inset-0"></div>

                  <span
                    class="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-charcoal backdrop-blur-sm"
                  >
                    {{ formatDay(tile.event.startAt) }}
                  </span>
                  <div class="absolute right-3 top-3 rounded-full bg-charcoal/45 p-0.5 backdrop-blur-sm">
                    <app-occupancy-arc
                      [current]="tile.occupied"
                      [max]="tile.event.capacity"
                      [size]="44"
                      [strokeWidth]="4"
                      [showLabel]="false"
                      accent="#7BDAC2"
                      track="rgba(255,255,255,0.25)"
                    />
                  </div>

                  <div class="absolute inset-x-0 bottom-0 p-3">
                    <h3 class="truncate text-sm font-bold text-white">{{ tile.event.title }}</h3>
                    <div class="mt-1 flex items-center gap-1.5">
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        [style.background-color]="statusColorFor(tile.event.status)"
                      ></span>
                      <span class="text-[11px] font-medium text-white/80">{{ statusFor(tile.event.status).label }}</span>
                    </div>
                  </div>

                  <div class="event-wall-actionbar absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-charcoal/85 py-1.5 backdrop-blur-sm">
                    <a
                      [routerLink]="['/organisateur/evenements', tile.event.id, 'modifier']"
                      class="rounded-md p-1.5 text-white/90 hover:bg-white/10"
                      title="Éditer"
                    >
                      <lucide-angular [img]="icons.Pencil" [size]="14"></lucide-angular>
                    </a>
                    <button
                      type="button"
                      class="rounded-md p-1.5 text-white/90 hover:bg-white/10"
                      title="Dupliquer"
                      (click)="duplicate(tile.event)"
                    >
                      <lucide-angular [img]="icons.Copy" [size]="14"></lucide-angular>
                    </button>
                    <a
                      [routerLink]="['/organisateur/scan', tile.event.id]"
                      class="rounded-md p-1.5 text-white/90 hover:bg-white/10"
                      title="Scanner"
                    >
                      <lucide-angular [img]="icons.ScanLine" [size]="14"></lucide-angular>
                    </a>
                    <button
                      type="button"
                      class="rounded-md p-1.5 text-white/90 hover:bg-red-500/80 disabled:opacity-50"
                      title="Supprimer"
                      [disabled]="deletingId() === tile.event.id"
                      (click)="deleteEvent(tile.event, $event)"
                    >
                      <lucide-angular [img]="icons.Trash2" [size]="14"></lucide-angular>
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        <!-- Bottom: quiet filmstrip -->
        @if (quietTiles().length > 0) {
          <section class="mt-6">
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Brouillons & archives
            </h2>
            <div class="flex gap-3 overflow-x-auto pb-2">
              @for (tile of quietTiles(); track tile.event.id) {
                <article
                  class="event-wall-tile group aspect-square w-28 shrink-0 opacity-85 transition-opacity hover:opacity-100"
                  [title]="tile.event.title"
                >
                  <img [ngSrc]="tile.event.coverImageUrl" [alt]="tile.event.title" fill class="object-cover" />
                  <div class="photo-scrim absolute inset-0"></div>

                  <span
                    class="absolute left-1.5 top-1.5 z-[1] rounded bg-charcoal/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm"
                  >
                    {{ statusFor(tile.event.status).label }}
                  </span>

                  <div class="absolute inset-x-0 bottom-0 z-[1] p-2 pb-8">
                    <p class="truncate text-[10px] font-medium text-white">{{ tile.event.title }}</p>
                  </div>

                  <div class="event-wall-actionbar absolute inset-x-0 bottom-0 z-[2] flex items-center justify-center gap-1 bg-charcoal/85 py-1.5 backdrop-blur-sm">
                    <a
                      [routerLink]="['/organisateur/evenements', tile.event.id, 'modifier']"
                      class="rounded-md p-1.5 text-white/90 hover:bg-white/10"
                      title="Éditer"
                    >
                      <lucide-angular [img]="icons.Pencil" [size]="14"></lucide-angular>
                    </a>
                    <button
                      type="button"
                      class="rounded-md p-1.5 text-white/90 hover:bg-red-500/80 disabled:opacity-50"
                      title="Supprimer"
                      [disabled]="deletingId() === tile.event.id"
                      (click)="deleteEvent(tile.event, $event)"
                    >
                      <lucide-angular [img]="icons.Trash2" [size]="14"></lucide-angular>
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      } @else {
        <!-- ==================== TABLE ==================== -->
        <div class="mt-5 overflow-x-auto rounded-xl border border-hairline bg-organizer-surface shadow-soft">
          <table class="organizer-dense-table">
            <thead>
              <tr>
                <th>Événement</th>
                <th>Date</th>
                <th>Lieu</th>
                <th>Capacité</th>
                <th>Statut</th>
                <th class="w-48"></th>
              </tr>
            </thead>
            <tbody>
              @for (event of filteredEvents(); track event.id) {
                <tr>
                  <td>
                    <a
                      [routerLink]="['/organisateur/evenements', event.id, 'modifier']"
                      class="font-medium text-text-primary hover:text-brand-teal-dark"
                    >
                      {{ event.title }}
                    </a>
                  </td>
                  <td class="font-mono text-xs tabular-nums text-text-secondary">{{ formatDate(event.startAt) }}</td>
                  <td class="text-text-secondary">{{ event.city }}</td>
                  <td class="font-mono text-xs tabular-nums">{{ event.capacity }}</td>
                  <td>
                    <app-status-dot [label]="statusFor(event.status).label" [tone]="statusFor(event.status).tone" />
                  </td>
                  <td>
                    <div class="organizer-row-actions flex items-center justify-end gap-1">
                      <a
                        [routerLink]="['/organisateur/evenements', event.id, 'modifier']"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Éditer"
                      >
                        <lucide-angular [img]="icons.Pencil" [size]="15"></lucide-angular>
                      </a>
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Dupliquer"
                        (click)="duplicate(event)"
                      >
                        <lucide-angular [img]="icons.Copy" [size]="15"></lucide-angular>
                      </button>
                      <a
                        [routerLink]="['/organisateur/evenements', event.id, 'inscriptions']"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Inscriptions"
                      >
                        <lucide-angular [img]="icons.ClipboardList" [size]="15"></lucide-angular>
                      </a>
                      <a
                        [routerLink]="['/organisateur/evenements', event.id, 'billetterie']"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Billetterie"
                      >
                        <lucide-angular [img]="icons.TicketIcon" [size]="15"></lucide-angular>
                      </a>
                      <a
                        [routerLink]="['/organisateur/evenements', event.id, 'statistiques']"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Statistiques"
                      >
                        <lucide-angular [img]="icons.BarChart3" [size]="15"></lucide-angular>
                      </a>
                      <a
                        [routerLink]="['/organisateur/scan', event.id]"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-organizer-bg hover:text-brand-teal-dark"
                        title="Scanner"
                      >
                        <lucide-angular [img]="icons.ScanLine" [size]="15"></lucide-angular>
                      </a>
                      <button
                        type="button"
                        class="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Supprimer"
                        [disabled]="deletingId() === event.id"
                        (click)="deleteEvent(event, $event)"
                      >
                        <lucide-angular [img]="icons.Trash2" [size]="15"></lucide-angular>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class OrganizerEventsListPage {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly refundService = inject(RefundService);
  private readonly occupancyService = inject(OccupancyService);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly icons = {
    Plus,
    Pencil,
    Copy,
    ClipboardList,
    TicketIcon,
    BarChart3,
    ScanLine,
    Sparkles,
    LayoutGrid,
    TableIcon,
    Trash2
  };

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly loading = signal(true);
  protected readonly events = signal<Event[]>([]);
  protected readonly occupancy = signal<Record<string, number>>({});
  protected readonly pendingRefundEventIds = signal<Set<string>>(new Set());
  protected readonly view = signal<ViewMode>('wall');
  protected readonly deletingId = signal<string | null>(null);

  protected readonly filterForm = this.fb.nonNullable.group({
    query: [''],
    status: ['all']
  });

  private readonly filters = signal({ query: '', status: 'all' });

  protected readonly filteredEvents = computed(() => {
    const { query, status } = this.filters();
    const normalizedQuery = query.trim().toLowerCase();
    return this.events()
      .filter((event) => (status === 'all' ? true : event.status === status))
      .filter((event) => (normalizedQuery ? event.title.toLowerCase().includes(normalizedQuery) : true));
  });

  private readonly ranked = computed(() => buildUrgencyList(this.filteredEvents(), this.occupancy()));

  private readonly isQuiet = (item: EventUrgency): boolean =>
    item.event.status === 'BROUILLON' ||
    item.event.status === 'ARCHIVE' ||
    item.event.status === 'ANNULE' ||
    item.daysUntil < 0;

  protected readonly attentionTiles = computed<AttentionTile[]>(() => {
    const refundIds = this.pendingRefundEventIds();
    return this.ranked()
      .filter((item) => !this.isQuiet(item))
      .map((item) => ({ item, reason: this.attentionReason(item, refundIds) }))
      .filter((x) => x.reason !== '')
      .slice(0, 2)
      .map(({ item, reason }) => ({ ...item, reason }));
  });

  protected readonly activeTiles = computed<EventUrgency[]>(() => {
    const heroIds = new Set(this.attentionTiles().map((t) => t.event.id));
    return this.ranked().filter((item) => !this.isQuiet(item) && !heroIds.has(item.event.id));
  });

  protected readonly quietTiles = computed<EventUrgency[]>(() => this.ranked().filter((item) => this.isQuiet(item)));

  constructor() {
    this.filterForm.valueChanges
      .pipe(startWith(this.filterForm.getRawValue()), debounceTime(200), takeUntilDestroyed())
      .subscribe((value) => this.filters.set({ query: value.query ?? '', status: value.status ?? 'all' }));

    const organizerId = this.authStore.user()?.id;
    if (!organizerId) {
      this.loading.set(false);
      return;
    }

    this.eventService.getByOrganizer(organizerId, { page: 0, size: 100 }).subscribe({
      next: (res) => {
        this.events.set(res.content);
        this.loading.set(false);
        this.occupancyService.forEvents(res.content.map((e) => e.id)).subscribe((occ) => this.occupancy.set(occ));
      },
      error: () => {
        this.events.set([]);
        this.loading.set(false);
      }
    });

    this.refundService.search({ page: 0, size: 200 }).subscribe((res) => {
      const ids = new Set(res.content.filter((r) => r.status === 'REQUESTED').map((r) => r.eventId));
      this.pendingRefundEventIds.set(ids);
    });
  }

  protected statusFor(status: string) {
    return eventFunctionalStatus(status);
  }

  protected statusColorFor(status: string): string {
    const tone = eventFunctionalStatus(status).tone;
    const map = { confirmed: '#2B8A72', pending: '#C99A3E', cancelled: '#B4553F', draft: '#8A93A6' };
    return map[tone];
  }

  protected duplicate(event: Event): void {
    this.eventService.duplicate(event.id).subscribe({
      next: (created) => {
        this.events.update((list) => [created, ...list]);
        this.toast.success(`"${event.title}" dupliqué en brouillon.`);
      },
      error: () => this.toast.error('Impossible de dupliquer cet événement.')
    });
  }

  protected async deleteEvent(event: Event, clickEvent?: MouseEvent): Promise<void> {
    clickEvent?.preventDefault();
    clickEvent?.stopPropagation();

    const confirmed = await this.confirmDialog.confirm({
      title: 'Supprimer cet événement ?',
      message: `« ${event.title} » sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger'
    });

    if (!confirmed) return;

    this.deletingId.set(event.id);
    this.eventService.delete(event.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.events.update((list) => list.filter((item) => item.id !== event.id));
        this.toast.success('Événement supprimé.');
      },
      error: () => {
        this.deletingId.set(null);
        this.toast.error('Impossible de supprimer cet événement.');
      }
    });
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected formatDay(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso));
  }

  private attentionReason(item: EventUrgency, refundIds: Set<string>): string {
    if (item.event.status === 'EN_REVISION') return 'En révision';
    if (refundIds.has(item.event.id)) return 'Remboursements';
    if (item.fillRatio >= 0.85 && item.event.capacity > 0) return 'Presque complet';
    if (item.daysUntil >= 0 && item.daysUntil <= 5) return 'Bientôt';
    return '';
  }
}
