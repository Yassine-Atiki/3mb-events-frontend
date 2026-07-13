import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Building2, LucideAngularModule, MapPin, Plus, Search, Users } from 'lucide-angular';

import { VenueService } from '../../core/api/venue.service';
import { ChartPoint, Venue } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';

interface VenueForm {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  capacity: string;
  description: string;
}

const EMPTY_FORM: VenueForm = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Maroc',
  capacity: '',
  description: ''
};

@Component({
  selector: 'app-admin-venues-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    ModalComponent,
    SkeletonComponent,
    EmptyStateComponent,
    AdminDonutChartComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.Building2" [size]="12"></lucide-angular>
            <span>Réseau de lieux</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Lieux</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Cartographiez salles et espaces événementiels — capacité, ville et couverture géographique.
          </p>
        </div>
        <app-ui-button (clicked)="openCreateModal()">
          <lucide-angular [img]="icons.Plus" [size]="16"></lucide-angular>
          Nouveau lieu
        </app-ui-button>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="440px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="440px" rounded="2xl" />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.Building2" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Lieux référencés</p>
                <p class="admin-command-metric-value">{{ venues().length }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">espaces actifs</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.MapPin" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Villes couvertes</p>
                <p class="admin-command-metric-value">{{ uniqueCities().length }}</p>
              </div>
              <span class="admin-command-metric-chip">rayon géographique</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Capacité totale</p>
                <p class="admin-command-metric-value">{{ totalCapacity() }}</p>
              </div>
              <span class="admin-command-metric-chip">places cumulées</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Building2" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Plus grand lieu</p>
                @if (largestVenue(); as venue) {
                  <p class="admin-command-metric-value text-base leading-tight">{{ venue.name }}</p>
                } @else {
                  <p class="admin-command-metric-value text-base">—</p>
                }
              </div>
              <span class="admin-command-metric-chip">{{ largestVenueCapacity() }} places</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Inventaire</p>
                <h2 class="admin-bento-title">Carte des lieux</h2>
                <p class="admin-bento-subtitle">Cliquez sur une fiche pour modifier</p>
              </div>
              <app-ui-input
                class="w-full min-w-[220px] sm:w-72"
                type="search"
                placeholder="Rechercher un lieu…"
                [leadingIcon]="icons.Search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </div>

            <div class="admin-city-filter mt-4">
              <button
                type="button"
                class="admin-city-filter-chip"
                [class.admin-city-filter-chip--active]="cityFilter() === 'all'"
                (click)="cityFilter.set('all')"
              >
                Toutes les villes
              </button>
              @for (city of uniqueCities(); track city) {
                <button
                  type="button"
                  class="admin-city-filter-chip"
                  [class.admin-city-filter-chip--active]="cityFilter() === city"
                  (click)="cityFilter.set(city)"
                >
                  {{ city }}
                </button>
              }
            </div>

            @if (filteredVenues().length === 0) {
              <div class="mt-8">
                <app-ui-empty-state
                  title="Aucun lieu"
                  description="Aucun résultat pour ces filtres. Créez un lieu ou réinitialisez la recherche."
                />
              </div>
            } @else {
              <div class="admin-venue-grid mt-6">
                @for (venue of filteredVenues(); track venue.id) {
                  <button type="button" class="admin-venue-card" (click)="openEdit(venue)">
                    <div class="admin-venue-card-cover">
                      <span class="admin-venue-card-city">
                        <lucide-angular [img]="icons.MapPin" [size]="12"></lucide-angular>
                        {{ venue.city }}
                      </span>
                      <h3 class="admin-venue-card-name">{{ venue.name }}</h3>
                    </div>
                    <div class="admin-venue-card-body">
                      <p class="admin-venue-card-address line-clamp-2">
                        {{ venue.address }}{{ venue.postalCode ? ', ' + venue.postalCode : '' }} — {{ venue.country }}
                      </p>
                      @if (venue.description) {
                        <p class="line-clamp-2 text-xs leading-relaxed text-text-secondary">{{ venue.description }}</p>
                      }
                      <div class="admin-venue-card-footer">
                        <span class="admin-venue-capacity-badge">
                          <lucide-angular [img]="icons.Users" [size]="11"></lucide-angular>
                          {{ venue.capacity ?? '—' }} places
                        </span>
                        <span class="text-xs font-semibold text-brand-teal-dark">Modifier →</span>
                      </div>
                    </div>
                  </button>
                }
              </div>
            }
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Géographie</p>
              <h2 class="admin-bento-title">Lieux par ville</h2>
              <p class="admin-bento-subtitle">Densité du réseau sur le territoire</p>
              <div class="mt-5">
                <app-admin-donut-chart [points]="cityChart()" ariaLabel="Répartition des lieux par ville" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Capacité</p>
              <h2 class="admin-bento-title">Top lieux</h2>
              <div class="mt-4 space-y-2.5">
                @for (venue of rankedByCapacity(); track venue.id) {
                  <div class="admin-category-rank">
                    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-teal/12 text-[10px] font-bold text-brand-teal-dark">
                      {{ venue.city.slice(0, 2).toUpperCase() }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2 text-sm">
                        <span class="truncate font-medium text-text-primary">{{ venue.name }}</span>
                        <span class="font-mono text-xs tabular-nums text-text-secondary">{{ venue.capacity ?? 0 }}</span>
                      </div>
                      <div class="admin-category-rank-bar mt-1.5">
                        <div
                          class="admin-category-rank-fill"
                          [style.width.%]="capacityWidth(venue.capacity ?? 0)"
                          style="background: var(--color-brand-teal)"
                        ></div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
        </div>
      }
    </div>

    <app-ui-modal [open]="modalOpen()" [title]="editing() ? 'Modifier le lieu' : 'Nouveau lieu'" (close)="closeModal()">
      <div class="flex flex-col gap-4">
        @if (form().name.trim() && form().city.trim()) {
          <div class="admin-modal-hero">
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
              <lucide-angular [img]="icons.MapPin" [size]="13"></lucide-angular>
              {{ form().city }}{{ form().country ? ', ' + form().country : '' }}
            </span>
            <p class="mt-2 text-lg font-semibold text-white">{{ form().name }}</p>
            @if (form().capacity) {
              <p class="mt-1 font-mono text-sm text-brand-teal-light">{{ form().capacity }} places</p>
            }
          </div>
        }

        <app-ui-input label="Nom" placeholder="Ex. Palais des Congrès" [ngModel]="form().name" (ngModelChange)="updateForm('name', $event)" />
        <app-ui-input label="Adresse" placeholder="Ex. Route de l'Aéroport" [ngModel]="form().address" (ngModelChange)="updateForm('address', $event)" />
        <div class="grid grid-cols-2 gap-3">
          <app-ui-input label="Ville" placeholder="Ex. Casablanca" [ngModel]="form().city" (ngModelChange)="updateForm('city', $event)" />
          <app-ui-input label="Code postal" placeholder="Ex. 20000" [ngModel]="form().postalCode" (ngModelChange)="updateForm('postalCode', $event)" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <app-ui-input label="Pays" placeholder="Ex. Maroc" [ngModel]="form().country" (ngModelChange)="updateForm('country', $event)" />
          <app-ui-input
            label="Capacité"
            type="number"
            placeholder="Ex. 500"
            [ngModel]="form().capacity"
            (ngModelChange)="updateForm('capacity', $event)"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-text-primary">Description</label>
          <textarea
            rows="3"
            class="w-full rounded-xl border border-hairline bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-4 focus:ring-brand-teal/15"
            placeholder="Description du lieu..."
            [ngModel]="form().description"
            (ngModelChange)="updateForm('description', $event)"
          ></textarea>
        </div>

        <div class="ui-modal-footer">
          @if (editing()) {
            <app-ui-button variant="danger" [loading]="deleting()" (clicked)="delete(editing()!)">
              Supprimer
            </app-ui-button>
          }
          <app-ui-button [disabled]="!form().name.trim() || !form().city.trim()" [loading]="saving()" (clicked)="save()">
            {{ editing() ? 'Enregistrer' : 'Créer' }}
          </app-ui-button>
        </div>
      </div>
    </app-ui-modal>
  `
})
export class AdminVenuesPage {
  private readonly venueService = inject(VenueService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly icons = { Building2, MapPin, Plus, Search, Users };

  protected readonly venues = signal<Venue[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchQuery = signal('');
  protected readonly cityFilter = signal('all');

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Venue | null>(null);
  protected readonly form = signal<VenueForm>({ ...EMPTY_FORM });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);

  protected readonly uniqueCities = computed(() =>
    [...new Set(this.venues().map((venue) => venue.city))].sort((a, b) => a.localeCompare(b, 'fr'))
  );

  protected readonly filteredVenues = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const city = this.cityFilter();
    return this.venues().filter((venue) => {
      if (city !== 'all' && venue.city !== city) return false;
      if (!query) return true;
      const haystack = `${venue.name} ${venue.address} ${venue.city} ${venue.country} ${venue.description ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly totalCapacity = computed(() =>
    this.venues().reduce((sum, venue) => sum + (venue.capacity ?? 0), 0)
  );

  protected readonly largestVenue = computed(() => {
    const list = [...this.venues()].filter((venue) => venue.capacity != null);
    list.sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
    return list[0] ?? null;
  });

  protected readonly largestVenueCapacity = computed(() => this.largestVenue()?.capacity ?? 0);

  protected readonly cityChart = computed<ChartPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const venue of this.venues()) {
      counts.set(venue.city, (counts.get(venue.city) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  });

  protected readonly rankedByCapacity = computed(() =>
    [...this.venues()]
      .filter((venue) => (venue.capacity ?? 0) > 0)
      .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0))
      .slice(0, 5)
  );

  constructor() {
    this.fetchVenues();
  }

  protected capacityWidth(capacity: number): number {
    const max = Math.max(1, ...(this.venues().map((venue) => venue.capacity ?? 0)));
    return Math.max(6, Math.round((capacity / max) * 100));
  }

  protected openEdit(venue: Venue): void {
    this.editing.set(venue);
    this.form.set({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      postalCode: venue.postalCode ?? '',
      country: venue.country,
      capacity: venue.capacity ? String(venue.capacity) : '',
      description: venue.description ?? ''
    });
    this.modalOpen.set(true);
  }

  protected openCreateModal(): void {
    this.editing.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected updateForm<K extends keyof VenueForm>(key: K, value: VenueForm[K]): void {
    this.form.update((form) => ({ ...form, [key]: value }));
  }

  protected save(): void {
    const form = this.form();
    const name = form.name.trim();
    const city = form.city.trim();
    if (!name || !city) return;

    const payload = {
      name,
      address: form.address.trim(),
      city,
      postalCode: form.postalCode.trim() || undefined,
      country: form.country.trim() || 'Maroc',
      capacity: form.capacity ? Number(form.capacity) : undefined,
      description: form.description.trim() || undefined
    };

    this.saving.set(true);
    const editing = this.editing();
    const request = editing ? this.venueService.update(editing.id, payload) : this.venueService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'Lieu mis à jour.' : 'Lieu créé.');
        this.closeModal();
        this.fetchVenues();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error("Impossible d'enregistrer ce lieu.");
      }
    });
  }

  protected async delete(venue: Venue): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Supprimer ce lieu ?',
      message: `« ${venue.name} » sera définitivement retiré. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.venueService.delete(venue.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Lieu supprimé.');
        this.closeModal();
        this.fetchVenues();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Impossible de supprimer ce lieu.');
      }
    });
  }

  private fetchVenues(): void {
    this.loading.set(true);
    this.venueService.getAll().subscribe({
      next: (venues) => {
        this.venues.set(venues);
        this.loading.set(false);
      },
      error: () => {
        this.venues.set([]);
        this.loading.set(false);
        this.toast.error('Impossible de charger les lieux.');
      }
    });
  }
}
