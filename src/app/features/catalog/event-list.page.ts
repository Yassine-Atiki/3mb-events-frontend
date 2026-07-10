import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, MapPin, Search, Sparkles, Tag } from 'lucide-angular';
import { debounceTime, distinctUntilChanged, filter, startWith } from 'rxjs';

import { CategoryService } from '../../core/api/category.service';
import { EventService } from '../../core/api/event.service';
import { AuthStore } from '../../core/auth/auth.store';
import { Category, Event } from '../../core/models';
import { InputComponent } from '../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';

const PAGE_SIZE = 9;

@Component({
  selector: 'app-event-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    InputComponent,
    SelectComponent
  ],
  template: `
    <div [class]="isEmbedded() ? '' : 'app-mesh min-h-screen'">
      <div [class]="isEmbedded() ? 'mx-auto max-w-7xl space-y-8' : 'mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14'">
        @if (isEmbedded()) {
          <header>
            <div class="page-header-badge mb-3">
              <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
              <span>DÉCOUVRIR</span>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Trouvez votre prochain événement
            </h1>
            <p class="mt-1 text-sm text-text-secondary">
              Conférences, formations, ateliers ou salons — réservez en quelques clics.
            </p>
          </header>
        } @else {
          <div class="page-header relative mb-8 overflow-hidden px-8 py-12 sm:px-12 sm:py-16">
            <div class="relative z-10 max-w-3xl">
              <div class="page-header-badge mb-4">
                <lucide-angular [img]="icons.Sparkles" [size]="12"></lucide-angular>
                <span>CATALOGUE D'ÉVÉNEMENTS</span>
              </div>
              <h1 class="mb-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
                Découvrez des événements <span class="gradient-text">près de chez vous</span>
              </h1>
              <p class="text-lg leading-relaxed text-text-secondary">
                Conférences, formations, ateliers ou salons : trouvez l'événement qui vous correspond et réservez en quelques clics.
              </p>
            </div>
            <div class="absolute right-0 top-0 h-64 w-64 rounded-full bg-gradient-to-br from-brand-teal/30 to-transparent blur-3xl"></div>
            <div class="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-gradient-to-br from-brand-teal-light/20 to-transparent blur-3xl"></div>
          </div>
        }

        <form
          [formGroup]="filterForm"
          class="grid items-end gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          [class.glass-panel]="!isEmbedded()"
          [class.p-6]="!isEmbedded()"
          [class.shadow-card]="!isEmbedded()"
        >
          <app-ui-input
            type="search"
            placeholder="Rechercher un événement..."
            formControlName="query"
            [leadingIcon]="icons.Search"
          />

          <app-ui-select
            placeholder="Toutes les catégories"
            [options]="categoryOptions()"
            formControlName="categoryId"
          />

          <app-ui-input
            placeholder="Ville"
            formControlName="city"
            [leadingIcon]="icons.MapPin"
          />

          <app-ui-select
            placeholder="Tous les tarifs"
            [options]="priceOptions"
            formControlName="price"
          />
        </form>

        @if (hasActiveFilters()) {
          <div class="flex items-center justify-between px-2">
            <div class="text-sm text-text-secondary">
              <span class="font-semibold text-text-primary">{{ events().length }}</span> événement(s) trouvé(s)
            </div>
            <button
              type="button"
              class="group inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-teal-dark transition-colors hover:text-brand-teal"
              (click)="resetFilters()"
            >
              <svg class="h-4 w-4 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Réinitialiser les filtres</span>
            </button>
          </div>
        }

        <div>
          @if (loading()) {
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              @for (i of skeletonRange; track i) {
                <div class="glass-panel animate-pulse overflow-hidden rounded-2xl">
                  <div class="h-48 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                  <div class="space-y-3 p-5">
                    <div class="h-4 w-3/4 rounded bg-gray-200"></div>
                    <div class="h-3 w-1/2 rounded bg-gray-200"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (events().length === 0) {
            <div class="glass-panel rounded-2xl p-16 text-center">
              <div class="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200">
                <lucide-angular [img]="icons.Sparkles" [size]="40" class="text-gray-400"></lucide-angular>
              </div>
              <h3 class="mb-2 text-xl font-semibold text-text-primary">Aucun événement trouvé</h3>
              <p class="mb-6 text-text-secondary">Essayez d'ajuster vos filtres ou revenez un peu plus tard.</p>
              @if (hasActiveFilters()) {
                <button
                  (click)="resetFilters()"
                  class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-teal to-brand-teal-dark px-6 py-3 font-semibold text-white shadow-glow-teal transition-transform hover:scale-105"
                >
                  Réinitialiser les filtres
                </button>
              }
            </div>
          } @else {
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              @for (event of events(); track event.id) {
                <a
                  [routerLink]="[detailBase(), event.slug]"
                  class="glass-panel group flex flex-col overflow-hidden rounded-2xl card-hover-lift"
                >
                  <div class="relative h-52 w-full overflow-hidden">
                    @if (event.coverImageUrl) {
                      <img
                        [src]="event.coverImageUrl"
                        [alt]="event.title"
                        class="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                      />
                    } @else {
                      <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-teal/30 via-brand-teal-dark/20 to-brand-forest/25">
                        <lucide-angular [img]="icons.Tag" [size]="40" class="text-brand-teal-dark/50"></lucide-angular>
                      </div>
                    }
                    <div class="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/40 to-transparent"></div>
                    <div class="absolute left-4 top-4">
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg backdrop-blur-sm"
                        [class]="event.isFree
                          ? 'bg-white/95 text-brand-teal-dark ring-1 ring-white/20'
                          : 'bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white shadow-glow-teal'"
                      >
                        <span>{{ event.isFree ? 'Gratuit' : formatPrice(event.priceFrom) }}</span>
                      </span>
                    </div>
                    <div class="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-4 pb-3 text-sm font-semibold text-white drop-shadow-lg">
                      <lucide-angular [img]="icons.MapPin" [size]="14"></lucide-angular>
                      <span>{{ event.city }}</span>
                    </div>
                  </div>
                  <div class="flex flex-1 flex-col gap-3 p-5">
                    <h3 class="line-clamp-2 text-lg font-bold tracking-tight text-text-primary transition-colors group-hover:text-brand-teal-dark">
                      {{ event.title }}
                    </h3>
                    <p class="line-clamp-2 text-sm leading-relaxed text-text-secondary">
                      {{ event.shortDescription }}
                    </p>
                    <div class="mt-auto flex items-center justify-between border-t border-brand-teal/10 pt-4">
                      <span class="text-xs font-medium text-text-secondary">{{ formatDate(event.startAt) }}</span>
                      <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-teal-dark transition-colors group-hover:text-brand-teal">
                        <span>Voir l'événement</span>
                        <svg class="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </a>
              }
            </div>

            @if (totalPages() > 1) {
              <div class="mt-12 flex items-center justify-center gap-4">
                <button
                  [disabled]="page() === 0"
                  (click)="goToPage(page() - 1)"
                  class="inline-flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-surface-white px-5 py-2.5 text-sm font-semibold text-brand-teal-dark transition-all hover:scale-105 hover:border-brand-teal hover:bg-brand-teal/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Précédent</span>
                </button>
                <div class="flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-gradient-to-r from-brand-teal/10 to-brand-teal-light/10 px-4 py-2">
                  <span class="text-sm font-bold text-brand-teal-dark">Page {{ page() + 1 }}</span>
                  <span class="text-sm text-text-secondary">sur {{ totalPages() }}</span>
                </div>
                <button
                  [disabled]="page() + 1 >= totalPages()"
                  (click)="goToPage(page() + 1)"
                  class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-teal to-brand-teal-dark px-5 py-2.5 text-sm font-semibold text-white shadow-glow-teal transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Suivant</span>
                </button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class EventListPage {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly icons = { Search, MapPin, Tag, Sparkles };
  protected readonly skeletonRange = Array.from({ length: 6 }, (_, i) => i);
  protected readonly isEmbedded = signal(this.router.url.startsWith('/app'));

  protected readonly priceOptions: SelectOption[] = [
    { value: 'all', label: 'Tous les tarifs' },
    { value: 'free', label: 'Gratuit' },
    { value: 'paid', label: 'Payant' }
  ];

  protected readonly events = signal<Event[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);

  protected readonly categoryOptions = signal<SelectOption[]>([{ value: 'all', label: 'Toutes les catégories' }]);

  protected readonly filterForm = this.fb.nonNullable.group({
    query: [''],
    categoryId: ['all'],
    city: [''],
    price: ['all']
  });

  constructor() {
    if (this.authStore.isParticipant() && this.router.url.startsWith('/evenements')) {
      void this.router.navigateByUrl('/app/decouvrir', { replaceUrl: true });
    }

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.isEmbedded.set(this.router.url.startsWith('/app'));
      });

    this.categoryService.getAll().subscribe((categories) => {
      this.categories.set(categories);
      this.categoryOptions.set([
        { value: 'all', label: 'Toutes les catégories' },
        ...categories.map((c) => ({ value: c.id, label: c.name }))
      ]);
    });

    this.filterForm.valueChanges
      .pipe(
        startWith(this.filterForm.getRawValue()),
        debounceTime(350),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.page.set(0);
        this.fetchEvents();
      });
  }

  protected detailBase(): string {
    return this.isEmbedded() ? '/app/decouvrir' : '/evenements';
  }

  protected hasActiveFilters(): boolean {
    const v = this.filterForm.getRawValue();
    return !!v.query || v.categoryId !== 'all' || !!v.city || v.price !== 'all';
  }

  protected resetFilters(): void {
    this.filterForm.reset({ query: '', categoryId: 'all', city: '', price: 'all' });
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.fetchEvents();
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected formatPrice(price: number): string {
    return `${price} MAD`;
  }

  private fetchEvents(): void {
    this.loading.set(true);
    const { query, categoryId, city, price } = this.filterForm.getRawValue();

    this.eventService
      .search({
        page: this.page(),
        size: PAGE_SIZE,
        status: 'PUBLIE',
        query: query || undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        city: city || undefined,
        isFree: price === 'all' ? undefined : price === 'free'
      })
      .subscribe({
        next: (res) => {
          this.events.set(res.content);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => {
          this.events.set([]);
          this.totalPages.set(0);
          this.loading.set(false);
        }
      });
  }
}
