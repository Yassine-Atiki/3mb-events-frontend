import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  LucideAngularModule,
  MapPin,
  Sparkles,
  Ticket as TicketIcon,
  Wallet
} from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CategoryService } from '../../core/api/category.service';
import { EventService } from '../../core/api/event.service';
import { RegistrationService } from '../../core/api/registration.service';
import { TicketService } from '../../core/api/ticket.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Category, Event, Registration, Ticket } from '../../core/models';
import { categoryColor } from '../../shared/participant/category-color';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { QrCodeDisplayComponent } from '../../shared/ui/qr-code-display/qr-code-display.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';

interface UpcomingItem {
  registration: Registration;
  event: Event;
  ticket: Ticket | null;
}

@Component({
  selector: 'app-participant-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, LucideAngularModule, ButtonComponent, SkeletonComponent, QrCodeDisplayComponent],
  template: `
    <div class="participant-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="participant-lounge-badge mb-3">
            <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
            <span>Mon espace</span>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Bonjour {{ firstName() }}
          </h1>
          <p class="mt-1 max-w-2xl text-base text-text-secondary">
            Votre prochain billet, prêt à scanner — tout votre programme en un coup d'œil.
          </p>
        </div>
        <a routerLink="/app/decouvrir" class="participant-quick-nav-chip">
          <lucide-angular [img]="icons.Compass" [size]="14"></lucide-angular>
          Découvrir des événements
        </a>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-12" height="340px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-12" height="180px" rounded="2xl" />
        </div>
      } @else if (upcoming().length === 0) {
        <div class="participant-pass-empty">
          <div class="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal-light/20">
            <lucide-angular [img]="icons.Sparkles" [size]="36" class="text-brand-teal"></lucide-angular>
          </div>
          <h3 class="mb-2 text-lg font-semibold text-text-primary">Aucun événement à venir</h3>
          <p class="mb-6 text-text-secondary">Réservez votre prochaine sortie dès maintenant.</p>
          <a routerLink="/app/decouvrir"><app-ui-button size="md">Découvrir des événements</app-ui-button></a>
        </div>
      } @else {
        <section class="participant-pass-metrics">
          <article class="participant-pass-metric" style="--pass-metric-accent: #53B29A">
            <p class="participant-pass-metric-label">À venir</p>
            <p class="participant-pass-metric-value">{{ upcoming().length }}</p>
            <span class="participant-pass-metric-chip">événement{{ upcoming().length > 1 ? 's' : '' }} programmé{{ upcoming().length > 1 ? 's' : '' }}</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #6366F1">
            <p class="participant-pass-metric-label">Billets actifs</p>
            <p class="participant-pass-metric-value">{{ activeTicketsCount() }}</p>
            <span class="participant-pass-metric-chip">prêts à scanner</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #F59E0B">
            <p class="participant-pass-metric-label">Prochain</p>
            @if (nextItem(); as item) {
              <p class="participant-pass-metric-value text-base leading-tight">{{ proximityTag(item.event.startAt) || 'Bientôt' }}</p>
            } @else {
              <p class="participant-pass-metric-value">—</p>
            }
            <span class="participant-pass-metric-chip">dans votre agenda</span>
          </article>
          <article class="participant-pass-metric" style="--pass-metric-accent: #8B5CF6">
            <p class="participant-pass-metric-label">Ville</p>
            @if (nextItem(); as item) {
              <p class="participant-pass-metric-value text-base leading-tight">{{ item.event.city }}</p>
            } @else {
              <p class="participant-pass-metric-value">—</p>
            }
            <span class="participant-pass-metric-chip">prochaine sortie</span>
          </article>
        </section>

        @if (nextItem(); as item) {
          <section class="participant-pass-hero" [style.--pass-accent]="accentFor(item.event)">
            <div
              class="participant-pass-stage"
              [class.ticket-valid-glow]="item.ticket?.status === 'VALID'"
            >
              @if (item.event.coverImageUrl) {
                <div
                  class="participant-pass-stage-cover"
                  [style.background-image]="'url(' + item.event.coverImageUrl + ')'"
                ></div>
              }
              <div class="participant-pass-stage-scrim"></div>

              <div class="participant-pass-stage-grid">
                <div class="participant-pass-stage-body">
                  <div>
                    <span class="participant-pass-live-pill">
                      <span class="participant-pass-live-dot" aria-hidden="true"></span>
                      {{ proximityTag(item.event.startAt) || 'Prochain événement' }}
                    </span>
                    <h2 class="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{{ item.event.title }}</h2>
                    <div class="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                      <span class="flex items-center gap-1.5">
                        <lucide-angular [img]="icons.CalendarDays" [size]="15" class="text-brand-teal-light"></lucide-angular>
                        {{ formatDateTime(item.event.startAt) }}
                      </span>
                      <span class="flex items-center gap-1.5">
                        <lucide-angular [img]="icons.MapPin" [size]="15" class="text-brand-teal-light"></lucide-angular>
                        {{ item.event.city }}
                      </span>
                    </div>
                  </div>

                  @if (countdown(); as cd) {
                    <div class="participant-pass-countdown">
                      @for (block of cd; track block.label) {
                        <div class="participant-pass-countdown-block">
                          <div class="participant-pass-countdown-value">{{ pad(block.value) }}</div>
                          <div class="participant-pass-countdown-label">{{ block.label }}</div>
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="font-mono text-lg font-semibold text-white">C'est aujourd'hui — bon événement !</p>
                  }
                </div>

                <div class="participant-pass-qr-deck">
                  @if (item.ticket) {
                    <div class="participant-pass-qr-ring">
                      <div class="qr-quiet-zone" [style.--qr-accent]="accentFor(item.event)">
                        <app-ui-qr-code [value]="item.ticket.qrCode" [size]="156" />
                      </div>
                    </div>
                    <a
                      [routerLink]="['/app/billets', item.ticket.id]"
                      class="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 transition-colors hover:text-white"
                    >
                      Voir le billet complet
                      <lucide-angular [img]="icons.ArrowRight" [size]="14"></lucide-angular>
                    </a>
                  } @else {
                    <div class="flex flex-col items-center gap-2 text-center">
                      <div class="grid h-24 w-24 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
                        <lucide-angular [img]="icons.Ticket" [size]="28"></lucide-angular>
                      </div>
                      <p class="max-w-[220px] text-xs text-white/65">
                        Votre billet sera émis dès la confirmation de votre inscription.
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>
        }

        @if (followingItems().length > 0) {
          <section class="participant-pass-panel">
            <p class="participant-pass-panel-eyebrow">Agenda</p>
            <h2 class="participant-pass-panel-title">Ensuite</h2>
            <div class="participant-upcoming-rail">
              @for (item of followingItems(); track item.registration.id) {
                <a
                  [routerLink]="item.ticket ? ['/app/billets', item.ticket.id] : ['/app/mes-inscriptions']"
                  class="participant-upcoming-pass"
                  [class.participant-upcoming-pass--soon]="isSoon(item.event.startAt)"
                  [style.--pass-accent]="accentFor(item.event)"
                >
                  <div class="participant-upcoming-pass-thumb">
                    @if (item.event.coverImageUrl) {
                      <img [src]="item.event.coverImageUrl" alt="" />
                    }
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    @if (proximityTag(item.event.startAt); as tag) {
                      <span
                        class="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                        [style.background]="isSoon(item.event.startAt) ? accentFor(item.event) : 'var(--color-organizer-bg)'"
                        [style.color]="isSoon(item.event.startAt) ? 'white' : 'var(--color-text-secondary)'"
                      >
                        {{ tag }}
                      </span>
                    } @else {
                      <span></span>
                    }
                    @if (item.ticket) {
                      <lucide-angular [img]="icons.Ticket" [size]="14" [style.color]="accentFor(item.event)"></lucide-angular>
                    }
                  </div>
                  <div>
                    <div class="line-clamp-2 text-sm font-bold text-text-primary">{{ item.event.title }}</div>
                    <div class="mt-1 font-mono text-xs tabular-nums text-text-secondary">
                      {{ formatShort(item.event.startAt) }}
                    </div>
                    <div class="mt-0.5 text-xs text-text-secondary">{{ item.event.city }}</div>
                  </div>
                </a>
              }
            </div>
          </section>
        }

        <nav class="participant-quick-nav" aria-label="Raccourcis">
          <a routerLink="/app/mes-inscriptions" class="participant-quick-nav-chip">Mes inscriptions</a>
          <a routerLink="/app/remboursements" class="participant-quick-nav-chip">Remboursements</a>
          <a routerLink="/app/profil" class="participant-quick-nav-chip">Mon profil</a>
        </nav>
      }
    </div>
  `
})
export class DashboardPage {
  private readonly authStore = inject(AuthStore);
  private readonly registrationService = inject(RegistrationService);
  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly categoryService = inject(CategoryService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = { CalendarDays, MapPin, Sparkles, ArrowRight, Ticket: TicketIcon, Compass, Wallet };

  protected readonly loading = signal(true);
  protected readonly registrations = signal<Registration[]>([]);
  protected readonly eventsById = signal<Record<string, Event>>({});
  protected readonly tickets = signal<Ticket[]>([]);
  protected readonly categoriesById = signal<Record<string, Category>>({});
  protected readonly now = signal(Date.now());

  protected readonly firstName = computed(() => this.authStore.user()?.firstName ?? '');

  protected readonly upcoming = computed<UpcomingItem[]>(() => {
    const now = this.now();
    const eventsById = this.eventsById();
    const tickets = this.tickets();

    return this.registrations()
      .filter((r) => r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'WAITLIST')
      .map((registration) => ({
        registration,
        event: eventsById[registration.eventId],
        ticket: tickets.find((t) => t.registrationId === registration.id) ?? null
      }))
      .filter((item): item is UpcomingItem => !!item.event && new Date(item.event.startAt).getTime() > now)
      .sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime());
  });

  protected readonly nextItem = computed<UpcomingItem | null>(() => this.upcoming()[0] ?? null);
  protected readonly followingItems = computed<UpcomingItem[]>(() => this.upcoming().slice(1, 7));

  protected readonly activeTicketsCount = computed(
    () => this.upcoming().filter((item) => item.ticket?.status === 'VALID').length
  );

  protected readonly countdown = computed(() => {
    const item = this.nextItem();
    if (!item) return null;
    const diff = new Date(item.event.startAt).getTime() - this.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    return [
      { label: 'Jours', value: days },
      { label: 'Heures', value: hours },
      { label: 'Min', value: minutes }
    ];
  });

  constructor() {
    this.load();
    const intervalId = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  protected accentFor(event: Event): string {
    const category = this.categoriesById()[event.categoryId];
    return categoryColor(category?.slug);
  }

  protected isSoon(iso: string): boolean {
    const diff = new Date(iso).getTime() - this.now();
    return diff > 0 && diff <= 48 * 3_600_000;
  }

  protected proximityTag(iso: string): string {
    const start = new Date(iso);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date(this.now());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dayDiff = Math.round((startDay - todayDay) / 86_400_000);

    if (dayDiff <= 0) return "Aujourd'hui";
    if (dayDiff === 1) return 'Demain';
    if (dayDiff <= 6) return `Dans ${dayDiff} j`;
    return '';
  }

  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected formatShort(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso)
    );
  }

  private load(): void {
    this.loading.set(true);

    this.categoryService
      .getAll()
      .subscribe((categories) => {
        const map: Record<string, Category> = {};
        categories.forEach((c) => (map[c.id] = c));
        this.categoriesById.set(map);
      });

    this.ticketService.getMyTickets().subscribe((tickets) => this.tickets.set(tickets));

    this.registrationService.getMine().subscribe({
      next: (registrations) => {
        this.registrations.set(registrations);
        const eventIds = [...new Set(registrations.map((r) => r.eventId))];
        if (eventIds.length === 0) {
          this.loading.set(false);
          return;
        }
        forkJoin(eventIds.map((id) => this.eventService.getById(id).pipe(catchError(() => of(null))))).subscribe(
          (events) => {
            const map: Record<string, Event> = {};
            events.forEach((event) => {
              if (event) map[event.id] = event;
            });
            this.eventsById.set(map);
            this.loading.set(false);
          }
        );
      },
      error: () => this.loading.set(false)
    });
  }
}
