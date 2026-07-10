import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarDays, LucideAngularModule, MapPin, ScanLine, Sparkles, Users } from 'lucide-angular';

import { EventService } from '../../core/api/event.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Event } from '../../core/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

const SCANNABLE_STATUSES = new Set(['PUBLIE', 'COMPLET']);

const SCAN_ACCENTS = ['#53B29A', '#6366F1', '#3B82F6', '#F59E0B', '#8B5CF6', '#F43F5E'];

@Component({
  selector: 'app-organizer-scanner-picker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, LucideAngularModule, EmptyStateComponent, SkeletonComponent],
  template: `
    <div class="organizer-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="organizer-studio-badge mb-3">
            <lucide-angular [img]="icons.ScanLine" [size]="12"></lucide-angular>
            <span>Contrôle d'accès</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Scanner des billets</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Sélectionnez un événement publié pour ouvrir le lecteur QR et valider les entrées en temps réel.
          </p>
        </div>
        <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
          {{ events().length }} événement{{ events().length > 1 ? 's' : '' }} scannable{{ events().length > 1 ? 's' : '' }}
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="180px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="180px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="180px" rounded="2xl" />
        </div>
      } @else if (events().length === 0) {
        <app-ui-empty-state
          title="Aucun événement à scanner"
          description="Seuls les événements publiés ou complets peuvent être scannés. Publiez un événement pour commencer."
        >
          <lucide-angular icon [img]="icons.Sparkles" [size]="24"></lucide-angular>
        </app-ui-empty-state>
      } @else {
        <section class="organizer-studio-hero">
          <div class="organizer-studio-hero-grid">
            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.ScanLine" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Scannables</p>
                <p class="organizer-studio-metric-value">{{ events().length }}</p>
              </div>
              <span class="organizer-studio-metric-chip">sessions actives</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.CalendarDays" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Aujourd'hui</p>
                <p class="organizer-studio-metric-value">{{ todayCount() }}</p>
              </div>
              <span class="organizer-studio-metric-chip">événements du jour</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Capacité totale</p>
                <p class="organizer-studio-metric-value">{{ totalCapacity() }}</p>
              </div>
              <span class="organizer-studio-metric-chip">places cumulées</span>
            </article>

            <article class="organizer-studio-metric">
              <div class="organizer-studio-metric-icon">
                <lucide-angular [img]="icons.MapPin" [size]="17"></lucide-angular>
              </div>
              <div>
                <p class="organizer-studio-metric-label">Prochain scan</p>
                @if (nextEvent(); as event) {
                  <p class="organizer-studio-metric-value text-sm leading-tight">{{ event.title }}</p>
                } @else {
                  <p class="organizer-studio-metric-value text-sm">—</p>
                }
              </div>
              <span class="organizer-studio-metric-chip">ordre chronologique</span>
            </article>
          </div>
        </section>

        <section class="organizer-panel">
          <div class="mb-5">
            <p class="organizer-panel-eyebrow">Sessions</p>
            <h2 class="organizer-panel-title">Choisir un événement</h2>
            <p class="organizer-panel-subtitle">Chaque carte ouvre le lecteur QR dédié à cette session</p>
          </div>

          <div class="organizer-scanner-grid">
            @for (event of events(); track event.id; let i = $index) {
              <a
                [routerLink]="['/organisateur/scan', event.id]"
                class="organizer-scanner-event-card"
                [style.--scan-accent]="accentFor(i)"
              >
                <div class="organizer-scanner-event-cover">
                  @if (event.coverImageUrl) {
                    <img [src]="event.coverImageUrl" alt="" />
                  }
                </div>

                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="line-clamp-2 text-sm font-bold text-text-primary">{{ event.title }}</h3>
                    @if (isToday(event.startAt)) {
                      <span class="organizer-scanner-today-pill mt-2">Aujourd'hui</span>
                    }
                  </div>
                  <span class="organizer-scanner-event-icon">
                    <lucide-angular [img]="icons.ScanLine" [size]="15"></lucide-angular>
                  </span>
                </div>

                <div class="mt-auto space-y-1">
                  <div class="flex items-center gap-1.5 text-xs text-text-secondary">
                    <lucide-angular [img]="icons.CalendarDays" [size]="13"></lucide-angular>
                    {{ formatDate(event.startAt) }}
                  </div>
                  <div class="flex items-center gap-1.5 text-xs text-text-secondary">
                    <lucide-angular [img]="icons.MapPin" [size]="13"></lucide-angular>
                    {{ event.city }}
                  </div>
                  <p class="font-mono text-[11px] font-semibold tabular-nums text-text-secondary">
                    {{ event.capacity }} places · {{ statusLabel(event.status) }}
                  </p>
                </div>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `
})
export class ScannerPickerPage {
  private readonly eventService = inject(EventService);
  private readonly authStore = inject(AuthStore);

  protected readonly icons = { ScanLine, CalendarDays, MapPin, Sparkles, Users };

  protected readonly loading = signal(true);
  private readonly allEvents = signal<Event[]>([]);

  protected readonly events = computed(() =>
    this.allEvents()
      .filter((event) => SCANNABLE_STATUSES.has(event.status))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  );

  protected readonly todayCount = computed(() => this.events().filter((event) => this.isToday(event.startAt)).length);

  protected readonly totalCapacity = computed(() =>
    this.events().reduce((sum, event) => sum + event.capacity, 0)
  );

  protected readonly nextEvent = computed(() => this.events()[0] ?? null);

  constructor() {
    const organizerId = this.authStore.user()?.id;
    if (!organizerId) {
      this.loading.set(false);
      return;
    }

    this.eventService.getByOrganizer(organizerId, { page: 0, size: 100 }).subscribe({
      next: (res) => {
        this.allEvents.set(res.content);
        this.loading.set(false);
      },
      error: () => {
        this.allEvents.set([]);
        this.loading.set(false);
      }
    });
  }

  protected accentFor(index: number): string {
    return SCAN_ACCENTS[index % SCAN_ACCENTS.length];
  }

  protected isToday(iso: string): boolean {
    const date = new Date(iso);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  protected statusLabel(status: string): string {
    if (status === 'COMPLET') return 'Complet';
    return 'Publié';
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }
}
