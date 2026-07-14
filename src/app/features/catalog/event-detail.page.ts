import { DestroyRef, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CalendarDays,
  Clock,
  LucideAngularModule,
  MapPin,
  Minus,
  Plus,
  Ticket as TicketIcon,
  Users
} from 'lucide-angular';

import { CategoryService } from '../../core/api/category.service';
import { EventService } from '../../core/api/event.service';
import { TicketService } from '../../core/api/ticket.service';
import { VenueService } from '../../core/api/venue.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Category, Event, TicketType, Venue } from '../../core/models';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { PageBackLinkComponent } from '../../shared/ui/page-back/page-back.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { MapLocationComponent } from '../../shared/map/map-location.component';

@Component({
  selector: 'app-event-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    MapLocationComponent,
    PageBackLinkComponent
  ],
  template: `
    @if (loading()) {
      <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <app-ui-skeleton height="280px" rounded="2xl" />
        <div class="mt-6 space-y-3">
          <app-ui-skeleton height="1.5rem" width="60%" />
          <app-ui-skeleton height="1rem" width="40%" />
          <app-ui-skeleton height="6rem" />
        </div>
      </div>
    } @else if (!event()) {
      <div class="mx-auto max-w-2xl px-4 py-20">
        <app-ui-empty-state title="Événement introuvable" description="Cet événement n'existe pas ou a été retiré." />
        <div class="mt-6 flex justify-center">
          <a [routerLink]="catalogLink()"><app-ui-button variant="secondary">Retour au catalogue</app-ui-button></a>
        </div>
      </div>
    } @else {
      <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <app-page-back class="mb-4" [link]="catalogLink()" label="Retour au catalogue" />
        <div class="relative h-52 w-full overflow-hidden rounded-3xl bg-surface-light sm:h-72">
          @if (event()!.coverImageUrl) {
            <img [src]="event()!.coverImageUrl" [alt]="event()!.title" class="h-full w-full object-cover" />
          } @else {
            <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-teal/25 to-brand-teal-dark/25 text-brand-teal-dark">
              <lucide-angular [img]="icons.TicketIcon" [size]="48"></lucide-angular>
            </div>
          }
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 sm:p-7">
            @if (categoryName(); as cat) {
              <app-ui-badge tone="teal">{{ cat }}</app-ui-badge>
            }
            <h1 class="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{{ event()!.title }}</h1>
            <p class="mt-1 text-sm text-white/80">Par {{ event()!.organizerName }}</p>
          </div>
        </div>

        @if (countdown(); as cd) {
          <div class="glass-panel relative mt-6 flex flex-wrap items-center justify-center gap-4 overflow-hidden rounded-2xl p-4 text-center sm:gap-8">
            <div
              class="pointer-events-none absolute -top-8 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-brand-teal/15 blur-3xl"
              aria-hidden="true"
            ></div>
            @for (unit of cd; track unit.label) {
              <div class="relative">
                <div class="bg-gradient-to-r from-brand-teal to-brand-teal-dark bg-clip-text text-2xl font-bold tabular-nums text-transparent sm:text-3xl">
                  {{ unit.value }}
                </div>
                <div class="text-xs font-medium uppercase tracking-wide text-text-secondary">{{ unit.label }}</div>
              </div>
            }
          </div>
        }

        <div class="mt-8 grid gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <h2 class="text-lg font-bold text-text-primary">À propos de l'événement</h2>
            <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
              {{ event()!.description }}
            </p>

            <div class="mt-8 grid gap-4 sm:grid-cols-2">
              <div class="card-hover-lift flex items-start gap-3 rounded-2xl border border-brand-teal/10 bg-surface-white p-4 shadow-card">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-dark">
                  <lucide-angular [img]="icons.CalendarDays" [size]="17"></lucide-angular>
                </span>
                <div>
                  <div class="text-sm font-semibold text-text-primary">Date</div>
                  <div class="text-sm text-text-secondary">{{ formatDateTime(event()!.startAt) }}</div>
                </div>
              </div>
              <div class="card-hover-lift flex items-start gap-3 rounded-2xl border border-brand-teal/10 bg-surface-white p-4 shadow-card">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-dark">
                  <lucide-angular [img]="icons.Clock" [size]="17"></lucide-angular>
                </span>
                <div>
                  <div class="text-sm font-semibold text-text-primary">Fin</div>
                  <div class="text-sm text-text-secondary">{{ formatDateTime(event()!.endAt) }}</div>
                </div>
              </div>
              <div class="card-hover-lift flex items-start gap-3 rounded-2xl border border-brand-teal/10 bg-surface-white p-4 shadow-card">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-dark">
                  <lucide-angular [img]="icons.MapPin" [size]="17"></lucide-angular>
                </span>
                <div>
                  <div class="text-sm font-semibold text-text-primary">Lieu</div>
                  <div class="text-sm text-text-secondary">{{ venue()?.name ?? event()!.city }}</div>
                </div>
              </div>
              <div class="card-hover-lift flex items-start gap-3 rounded-2xl border border-brand-teal/10 bg-surface-white p-4 shadow-card">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-dark">
                  <lucide-angular [img]="icons.Users" [size]="17"></lucide-angular>
                </span>
                <div>
                  <div class="text-sm font-semibold text-text-primary">Capacité</div>
                  <div class="text-sm text-text-secondary">{{ event()!.capacity }} places</div>
                </div>
              </div>
            </div>

            <!-- Leaflet map (venue coordinates) -->
            <div class="mt-6 overflow-hidden rounded-2xl border border-brand-teal/10 shadow-card">
              @if (venue()?.latitude != null && venue()?.longitude != null) {
                <app-map-location
                  mode="view"
                  [latitude]="venue()!.latitude!"
                  [longitude]="venue()!.longitude!"
                  [caption]="venueMapCaption()"
                />
              } @else {
                <div class="app-mesh flex h-48 flex-col items-center justify-center gap-2 text-text-secondary">
                  <span class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-teal-dark shadow-card">
                    <lucide-angular [img]="icons.MapPin" [size]="22"></lucide-angular>
                  </span>
                  <p class="text-sm font-medium text-text-primary">{{ venue()?.name ?? 'Lieu' }}</p>
                  <p class="max-w-xs text-center text-xs text-text-secondary">
                    {{ venue()?.address ?? event()!.city }}{{ venue()?.city ? ', ' + venue()!.city : '' }}
                  </p>
                </div>
              }
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="sticky top-24 rounded-2xl border border-brand-teal/10 bg-surface-white p-5 shadow-card">
              <h3 class="flex items-center gap-2 text-base font-bold text-text-primary">
                <span class="h-4 w-1 rounded-full bg-brand-teal"></span>
                Billets
              </h3>

              @if (ticketTypes().length === 0) {
                <p class="mt-3 text-sm text-text-secondary">Aucun billet disponible pour le moment.</p>
              } @else {
                <div class="mt-4 space-y-2">
                  @for (tt of ticketTypes(); track tt.id) {
                    <button
                      type="button"
                      class="w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-150"
                      [class]="
                        selectedTicketId() === tt.id
                          ? 'border-brand-teal bg-brand-teal/8 ring-1 ring-brand-teal/20'
                          : 'border-gray-200 hover:border-brand-teal/40 hover:bg-surface-muted'
                      "
                      [disabled]="remaining(tt) <= 0"
                      (click)="selectTicket(tt.id)"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-text-primary">{{ tt.name }}</span>
                        <span class="text-sm font-bold text-brand-teal-dark">
                          {{ tt.price === 0 ? 'Gratuit' : tt.price + ' ' + tt.currency }}
                        </span>
                      </div>
                      <div class="mt-1 text-xs text-text-secondary">
                        {{ remaining(tt) > 0 ? remaining(tt) + ' places restantes' : 'Épuisé' }}
                      </div>
                    </button>
                  }
                </div>

                @if (selectedTicket(); as tt) {
                  <div class="mt-5 flex items-center justify-between rounded-xl bg-surface-muted p-3">
                    <span class="text-sm font-medium text-text-primary">Quantité</span>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-text-primary transition-colors hover:border-brand-teal/40 hover:bg-brand-teal/5 disabled:cursor-not-allowed disabled:opacity-40"
                        [disabled]="quantity() <= 1"
                        (click)="changeQuantity(-1)"
                      >
                        <lucide-angular [img]="icons.Minus" [size]="14"></lucide-angular>
                      </button>
                      <span class="w-4 text-center text-sm font-semibold">{{ quantity() }}</span>
                      <button
                        type="button"
                        class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-gray-200 bg-white text-text-primary transition-colors hover:border-brand-teal/40 hover:bg-brand-teal/5 disabled:cursor-not-allowed disabled:opacity-40"
                        [disabled]="quantity() >= maxQuantity(tt)"
                        (click)="changeQuantity(1)"
                      >
                        <lucide-angular [img]="icons.Plus" [size]="14"></lucide-angular>
                      </button>
                    </div>
                  </div>

                  <div class="mt-4 flex items-center justify-between text-sm">
                    <span class="text-text-secondary">Total</span>
                    <span class="text-lg font-bold text-text-primary">{{ totalPrice(tt) }} {{ tt.currency }}</span>
                  </div>
                }

                <app-ui-button class="mt-5 w-full" [disabled]="!selectedTicket()" (clicked)="reserve()">
                  S'inscrire
                </app-ui-button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class EventDetailPage {
  readonly slug = input<string>('');

  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly venueService = inject(VenueService);
  private readonly ticketService = inject(TicketService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = { CalendarDays, Clock, MapPin, Users, TicketIcon, Minus, Plus };

  protected readonly loading = signal(true);
  protected readonly event = signal<Event | null>(null);
  protected readonly venue = signal<Venue | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly ticketTypes = signal<TicketType[]>([]);
  protected readonly selectedTicketId = signal<string | null>(null);
  protected readonly quantity = signal(1);
  protected readonly now = signal(Date.now());

  protected readonly categoryName = computed(
    () => this.categories().find((c) => c.id === this.event()?.categoryId)?.name
  );

  protected readonly selectedTicket = computed(
    () => this.ticketTypes().find((tt) => tt.id === this.selectedTicketId()) ?? null
  );

  protected readonly venueMapCaption = computed(() => {
    const venue = this.venue();
    if (!venue) return null;
    const parts = [venue.address, venue.city, venue.postalCode].filter(Boolean);
    return parts.join(', ');
  });

  protected readonly countdown = computed(() => {
    const event = this.event();
    if (!event) return null;
    const diff = new Date(event.startAt).getTime() - this.now();
    if (diff <= 0) return null;

    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);

    return [
      { label: 'Jours', value: days },
      { label: 'Heures', value: hours },
      { label: 'Minutes', value: minutes },
      { label: 'Secondes', value: seconds }
    ];
  });

  constructor() {
    this.categoryService.getAll().subscribe((categories) => this.categories.set(categories));

    if (this.authStore.isParticipant() && !this.router.url.startsWith('/app')) {
      const slug = this.slug();
      void this.router.navigateByUrl(slug ? `/app/decouvrir/${slug}` : '/app/decouvrir', { replaceUrl: true });
    }

    effect(() => {
      const slug = this.slug();
      if (slug) this.loadEvent(slug);
    });

    const intervalId = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  protected remaining(tt: TicketType): number {
    return tt.quantityTotal - tt.quantitySold;
  }

  protected maxQuantity(tt: TicketType): number {
    return Math.max(1, Math.min(tt.maxPerOrder ?? 10, this.remaining(tt)));
  }

  protected selectTicket(id: string): void {
    this.selectedTicketId.set(id);
    this.quantity.set(1);
  }

  protected changeQuantity(delta: number): void {
    const tt = this.selectedTicket();
    if (!tt) return;
    const next = this.quantity() + delta;
    this.quantity.set(Math.min(Math.max(next, 1), this.maxQuantity(tt)));
  }

  protected totalPrice(tt: TicketType): number {
    return tt.price * this.quantity();
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }

  protected catalogLink(): string {
    return this.router.url.startsWith('/app') ? '/app/decouvrir' : '/evenements';
  }

  protected reserve(): void {
    const event = this.event();
    if (!event) return;

    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/app/reservation', event.id]);
      return;
    }

    this.router.navigate(['/auth/connexion'], {
      queryParams: { returnUrl: `/app/reservation/${event.id}` }
    });
  }

  private loadEvent(slug: string): void {
    this.loading.set(true);
    this.eventService.getBySlug(slug).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);

        this.venueService.getById(event.venueId).subscribe((venue) => this.venue.set(venue));
        this.ticketService.getTicketTypesByEvent(event.id).subscribe((types) => {
          this.ticketTypes.set(types);
          const firstAvailable = types.find((tt) => this.remaining(tt) > 0);
          if (firstAvailable) this.selectTicket(firstAvailable.id);
        });
      },
      error: () => {
        this.event.set(null);
        this.loading.set(false);
      }
    });
  }
}
