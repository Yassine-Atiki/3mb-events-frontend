import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CalendarDays,
  Check,
  Clock,
  Inbox,
  LucideAngularModule,
  MapPin,
  ShieldAlert,
  Sparkles,
  User as UserIcon,
  Users,
  X
} from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { Event, EventStatus } from '../../core/models';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-admin-moderation-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    EmptyStateComponent,
    SelectComponent,
    SkeletonComponent,
    OccupancyArcComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.ShieldAlert" [size]="12"></lucide-angular>
            <span>Bannette de validation</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Modération</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Traitez les soumissions en révision — approuvez pour publier ou rejetez avec motif.
          </p>
        </div>

        @if (!loading() && events().length > 0) {
          <div class="admin-mod-kbd-panel">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Raccourcis</span>
            <kbd>j</kbd><kbd>k</kbd><span class="text-xs text-text-secondary">naviguer</span>
            <kbd>a</kbd><span class="text-xs text-text-secondary">approuver</span>
            <kbd>r</kbd><span class="text-xs text-text-secondary">rejeter</span>
          </div>
        }
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="520px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="520px" rounded="2xl" />
        </div>
      } @else if (events().length === 0) {
        <div class="glass-panel rounded-2xl p-12 text-center">
          <div class="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/15">
            <lucide-angular [img]="icons.Sparkles" [size]="34" class="text-brand-teal"></lucide-angular>
          </div>
          <app-ui-empty-state
            title="Bannette vide"
            description="Toutes les soumissions ont été traitées. Rien à modérer pour l'instant."
          />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.Inbox" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">En attente</p>
                <p class="admin-command-metric-value">{{ events().length }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">soumissions à traiter</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.MapPin" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Villes</p>
                <p class="admin-command-metric-value">{{ uniqueCities() }}</p>
              </div>
              <span class="admin-command-metric-chip">couverture géo</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Organisateurs</p>
                <p class="admin-command-metric-value">{{ uniqueOrganizers() }}</p>
              </div>
              <span class="admin-command-metric-chip">comptes concernés</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Clock" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Capacité totale</p>
                <p class="admin-command-metric-value">{{ totalCapacity() }}</p>
              </div>
              <span class="admin-command-metric-chip">places en file</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Focus</p>
                <h2 class="admin-bento-title">Soumission en cours</h2>
                <p class="admin-bento-subtitle">Élément {{ focusedIndex() + 1 }} sur {{ events().length }}</p>
              </div>
              <div class="w-36">
                <div class="admin-mod-progress-track">
                  <div class="admin-mod-progress-fill" [style.width.%]="queueProgress()"></div>
                </div>
                <p class="mt-1 text-center font-mono text-[10px] tabular-nums text-text-secondary">
                  {{ queueProgress() }}% parcouru
                </p>
              </div>
            </div>

            <div class="mod-tray">
              @if (focused(); as event) {
                @for (layer of depthLayers(); track layer) {
                  <div
                    class="absolute inset-x-0 top-0 h-full rounded-2xl border border-hairline bg-surface-white"
                    [style.transform]="'translateY(' + layer * 8 + 'px) scale(' + (1 - layer * 0.018) + ')'"
                    [style.z-index]="0"
                    [style.opacity]="0.45 - layer * 0.1"
                    aria-hidden="true"
                  ></div>
                }

                <article
                  class="mod-stub mod-stub-focused relative z-10 flex flex-col"
                  [class.mod-stub-lifting]="liftingId() === event.id"
                >
                  <div class="admin-mod-cover">
                    @if (event.coverImageUrl) {
                      <img [src]="event.coverImageUrl" [alt]="event.title" />
                    }
                    <span class="admin-mod-cover-badge">
                      <lucide-angular [img]="icons.Clock" [size]="12"></lucide-angular>
                      En révision
                    </span>
                    <h2 class="admin-mod-cover-title">{{ event.title }}</h2>
                  </div>

                  <div class="flex flex-1 flex-col gap-4 p-5">
                    <div class="admin-mod-meta-grid">
                      <div class="admin-mod-meta-chip">
                        <p class="admin-mod-meta-chip-label">Organisateur</p>
                        <p class="admin-mod-meta-chip-value truncate">{{ event.organizerName }}</p>
                      </div>
                      <div class="admin-mod-meta-chip">
                        <p class="admin-mod-meta-chip-label">Lieu</p>
                        <p class="admin-mod-meta-chip-value">{{ event.city }}</p>
                      </div>
                      <div class="admin-mod-meta-chip">
                        <p class="admin-mod-meta-chip-label">Date</p>
                        <p class="admin-mod-meta-chip-value font-mono tabular-nums">{{ formatDate(event.startAt) }}</p>
                      </div>
                      <div class="admin-mod-meta-chip">
                        <p class="admin-mod-meta-chip-label">Capacité</p>
                        <p class="admin-mod-meta-chip-value font-mono tabular-nums">{{ event.capacity }} places</p>
                      </div>
                    </div>

                    <p class="line-clamp-4 text-sm leading-relaxed text-text-secondary">{{ event.description }}</p>

                    @if (!rejecting()) {
                      <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                        <app-ui-button variant="primary" [loading]="busy()" (clicked)="approve(event)">
                          <lucide-angular [img]="icons.Check" [size]="15"></lucide-angular>
                          Approuver & publier
                        </app-ui-button>
                        <app-ui-button variant="ghost" (clicked)="startReject()">
                          <lucide-angular [img]="icons.X" [size]="15"></lucide-angular>
                          Rejeter
                        </app-ui-button>
                      </div>
                    } @else {
                      <div class="mt-auto flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
                        <p class="text-sm font-semibold text-text-primary">Motif du rejet</p>
                        <textarea
                          rows="3"
                          class="w-full rounded-xl border border-hairline bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-4 focus:ring-red-400/15"
                          placeholder="Expliquez la raison du rejet…"
                          [ngModel]="motif()"
                          (ngModelChange)="motif.set($event)"
                        ></textarea>
                        <app-ui-select
                          label="Statut à appliquer"
                          [clearable]="false"
                          [options]="rejectOptions"
                          [ngModel]="rejectStatus()"
                          (ngModelChange)="rejectStatus.set($event)"
                        />
                        <div class="flex justify-end gap-2">
                          <app-ui-button variant="ghost" (clicked)="cancelReject()">Annuler</app-ui-button>
                          <app-ui-button
                            variant="danger"
                            [disabled]="!motif().trim()"
                            [loading]="busy()"
                            (clicked)="reject(event)"
                          >
                            Confirmer le rejet
                          </app-ui-button>
                        </div>
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          </section>

          <aside class="admin-bento-tile flex flex-col xl:col-span-4">
            <p class="admin-bento-eyebrow">Pipeline</p>
            <h2 class="admin-bento-title">File d'attente</h2>
            <p class="admin-bento-subtitle">Sélectionnez une soumission à examiner</p>

            <div class="mt-5 flex items-center justify-center">
              <app-occupancy-arc
                [current]="focusedIndex() + 1"
                [max]="events().length"
                [size]="132"
                [strokeWidth]="10"
                label="File"
                accent="#F59E0B"
                track="#E8EDEC"
              />
            </div>

            <div class="admin-mod-queue mt-5">
              @for (event of events(); track event.id; let i = $index) {
                <button
                  type="button"
                  class="admin-mod-queue-item"
                  [class.admin-mod-queue-item--active]="i === focusedIndex()"
                  (click)="focusIndex(i)"
                >
                  <span class="admin-mod-queue-index">{{ i + 1 }}</span>
                  <div class="admin-mod-queue-thumb">
                    @if (event.coverImageUrl) {
                      <img [src]="event.coverImageUrl" [alt]="''" />
                    }
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-text-primary">{{ event.title }}</p>
                    <p class="mt-0.5 flex items-center gap-1 truncate text-xs text-text-secondary">
                      <lucide-angular [img]="icons.UserIcon" [size]="11"></lucide-angular>
                      {{ event.organizerName }}
                    </p>
                  </div>
                </button>
              }
            </div>
          </aside>
        </div>
      }
    </div>
  `
})
export class AdminModerationPage {
  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);

  protected readonly icons = {
    CalendarDays,
    MapPin,
    UserIcon,
    Check,
    X,
    ShieldAlert,
    Inbox,
    Users,
    Clock,
    Sparkles
  };

  protected readonly rejectOptions: SelectOption[] = [
    { value: 'BROUILLON', label: 'Renvoyer en brouillon (à corriger)' },
    { value: 'ANNULE', label: 'Annuler définitivement' }
  ];

  protected readonly events = signal<Event[]>([]);
  protected readonly loading = signal(true);
  protected readonly focusedIndex = signal(0);
  protected readonly liftingId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly motif = signal('');
  protected readonly rejectStatus = signal<EventStatus>('BROUILLON');

  protected readonly focused = computed(() => this.events()[this.focusedIndex()] ?? null);
  protected readonly depthLayers = computed(() => {
    const remaining = this.events().length - 1;
    return Array.from({ length: Math.min(3, Math.max(0, remaining)) }, (_, i) => i + 1);
  });

  protected readonly uniqueCities = computed(
    () => new Set(this.events().map((event) => event.city)).size
  );

  protected readonly uniqueOrganizers = computed(
    () => new Set(this.events().map((event) => event.organizerId)).size
  );

  protected readonly totalCapacity = computed(() =>
    this.events().reduce((sum, event) => sum + event.capacity, 0)
  );

  protected readonly queueProgress = computed(() => {
    const total = this.events().length;
    if (total <= 1) return total === 1 ? 100 : 0;
    return Math.round(((this.focusedIndex() + 1) / total) * 100);
  });

  constructor() {
    this.fetchEvents();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
      return;
    }
    if (this.events().length === 0 || this.busy()) return;

    switch (event.key) {
      case 'j':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'k':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'a':
        if (!this.rejecting()) {
          event.preventDefault();
          const focused = this.focused();
          if (focused) this.approve(focused);
        }
        break;
      case 'r':
        if (!this.rejecting()) {
          event.preventDefault();
          this.startReject();
        }
        break;
      case 'Escape':
        if (this.rejecting()) this.cancelReject();
        break;
      default:
        break;
    }
  }

  protected focusIndex(index: number): void {
    this.focusedIndex.set(index);
    this.rejecting.set(false);
  }

  protected startReject(): void {
    this.motif.set('');
    this.rejectStatus.set('BROUILLON');
    this.rejecting.set(true);
  }

  protected cancelReject(): void {
    this.rejecting.set(false);
    this.motif.set('');
  }

  protected approve(event: Event): void {
    this.busy.set(true);
    this.eventService.updateStatus(event.id, 'PUBLIE').subscribe({
      next: () => {
        this.busy.set(false);
        this.liftOff(event.id);
        this.toast.success(`"${event.title}" a été publié.`);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error("Impossible d'approuver cet événement.");
      }
    });
  }

  protected reject(event: Event): void {
    const reason = this.motif().trim();
    if (!reason) return;
    this.busy.set(true);
    this.eventService.updateStatus(event.id, this.rejectStatus()).subscribe({
      next: () => {
        this.busy.set(false);
        this.rejecting.set(false);
        this.liftOff(event.id);
        this.toast.success(`"${event.title}" a été rejeté. Motif : ${reason}`);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Impossible de rejeter cet événement.');
      }
    });
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  private moveFocus(delta: number): void {
    const count = this.events().length;
    if (count === 0) return;
    this.rejecting.set(false);
    this.focusedIndex.update((i) => Math.min(count - 1, Math.max(0, i + delta)));
  }

  private liftOff(id: string): void {
    this.liftingId.set(id);
    setTimeout(() => {
      this.events.update((list) => list.filter((event) => event.id !== id));
      this.liftingId.set(null);
      const count = this.events().length;
      this.focusedIndex.update((i) => Math.min(i, Math.max(0, count - 1)));
    }, 500);
  }

  private fetchEvents(): void {
    this.loading.set(true);
    this.eventService.search({ page: 0, size: 100, status: 'EN_REVISION', sort: 'createdAt,asc' }).subscribe({
      next: (res) => {
        this.events.set(res.content);
        this.loading.set(false);
      },
      error: () => {
        this.events.set([]);
        this.loading.set(false);
        this.toast.error('Impossible de charger les événements à modérer.');
      }
    });
  }
}
