import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FolderTree, LucideAngularModule, Plus, Search, Tag } from 'lucide-angular';

import { CategoryService } from '../../core/api/category.service';
import { Category, ChartPoint } from '../../core/models';
import { categoryColor } from '../../shared/participant/category-color';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';

interface CategoryForm {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const EMPTY_FORM: CategoryForm = { name: '', slug: '', icon: '', description: '' };

@Component({
  selector: 'app-admin-categories-page',
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
            <lucide-angular [img]="icons.FolderTree" [size]="12"></lucide-angular>
            <span>Taxonomie événements</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Catégories</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Structurez le catalogue — chaque catégorie colore l'expérience billet et les statistiques plateforme.
          </p>
        </div>
        <app-ui-button (clicked)="openCreateModal()">
          <lucide-angular [img]="icons.Plus" [size]="16"></lucide-angular>
          Nouvelle catégorie
        </app-ui-button>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="420px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="420px" rounded="2xl" />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.Tag" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Catégories</p>
                <p class="admin-command-metric-value">{{ categories().length }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">taxons actifs</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.FolderTree" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Événements classés</p>
                <p class="admin-command-metric-value">{{ totalEvents() }}</p>
              </div>
              <span class="admin-command-metric-chip">dans le catalogue</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Tag" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Top catégorie</p>
                @if (topCategory(); as top) {
                  <p class="admin-command-metric-value text-lg">{{ top.name }}</p>
                } @else {
                  <p class="admin-command-metric-value text-lg">—</p>
                }
              </div>
              <span class="admin-command-metric-chip">{{ topCategory()?.eventCount ?? 0 }} evt.</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Search" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Sans événement</p>
                <p class="admin-command-metric-value">{{ emptyCategories() }}</p>
              </div>
              <span class="admin-command-metric-chip">à promouvoir</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Catalogue</p>
                <h2 class="admin-bento-title">Grille chromatique</h2>
                <p class="admin-bento-subtitle">Cliquez sur une carte pour modifier</p>
              </div>
              <app-ui-input
                class="w-full min-w-[220px] sm:w-72"
                type="search"
                placeholder="Filtrer une catégorie…"
                [leadingIcon]="icons.Search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
            </div>

            @if (filteredCategories().length === 0) {
              <div class="mt-8">
                <app-ui-empty-state
                  title="Aucune catégorie"
                  description="Aucun résultat pour ce filtre. Créez une nouvelle catégorie ou effacez la recherche."
                />
              </div>
            } @else {
              <div class="admin-category-grid mt-6">
                @for (category of filteredCategories(); track category.id) {
                  <button
                    type="button"
                    class="admin-category-card"
                    [style.--cat-accent]="accentFor(category.slug)"
                    (click)="openEdit(category)"
                  >
                    <div class="admin-category-card-icon">{{ initials(category.name) }}</div>
                    <div>
                      <p class="admin-category-card-name">{{ category.name }}</p>
                      <p class="admin-category-card-slug">{{ category.slug }}</p>
                    </div>
                    <p class="admin-category-card-desc line-clamp-2">
                      {{ category.description || 'Aucune description renseignée.' }}
                    </p>
                    <div class="admin-category-card-footer">
                      <span class="admin-category-card-count">{{ category.eventCount ?? 0 }} événement(s)</span>
                      <span class="admin-category-card-action">Modifier →</span>
                    </div>
                  </button>
                }
              </div>
            }
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Répartition</p>
              <h2 class="admin-bento-title">Événements par catégorie</h2>
              <p class="admin-bento-subtitle">Poids de chaque taxon dans le catalogue</p>
              <div class="mt-5">
                <app-admin-donut-chart [points]="distributionChart()" ariaLabel="Répartition des événements par catégorie" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Classement</p>
              <h2 class="admin-bento-title">Top catégories</h2>
              <div class="mt-4 space-y-2.5">
                @for (category of rankedCategories(); track category.id) {
                  <div class="admin-category-rank">
                    <span
                      class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold"
                      [style.background]="'color-mix(in srgb, ' + accentFor(category.slug) + ' 14%, white)'"
                      [style.color]="accentFor(category.slug)"
                    >
                      {{ initials(category.name) }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2 text-sm">
                        <span class="truncate font-medium text-text-primary">{{ category.name }}</span>
                        <span class="font-mono text-xs tabular-nums text-text-secondary">{{ category.eventCount ?? 0 }}</span>
                      </div>
                      <div class="admin-category-rank-bar mt-1.5">
                        <div
                          class="admin-category-rank-fill"
                          [style.width.%]="rankWidth(category.eventCount ?? 0)"
                          [style.background]="accentFor(category.slug)"
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

    <app-ui-modal [open]="modalOpen()" [title]="editing() ? 'Modifier la catégorie' : 'Nouvelle catégorie'" (close)="closeModal()">
      <div class="flex flex-col gap-4">
        @if (previewSlug()) {
          <div
            class="rounded-xl border border-hairline p-4"
            [style.borderColor]="'color-mix(in srgb, ' + accentFor(previewSlug()) + ' 35%, transparent)'"
            [style.background]="'color-mix(in srgb, ' + accentFor(previewSlug()) + ' 8%, white)'"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Aperçu couleur</p>
            <div class="mt-2 flex items-center gap-3">
              <span
                class="grid h-10 w-10 place-items-center rounded-xl font-mono text-sm font-bold text-white"
                [style.background]="accentFor(previewSlug())"
              >
                {{ initials(form().name || 'C') }}
              </span>
              <div>
                <p class="font-semibold text-text-primary">{{ form().name || 'Nouvelle catégorie' }}</p>
                <p class="font-mono text-xs text-text-secondary">{{ previewSlug() }}</p>
              </div>
            </div>
          </div>
        }

        <app-ui-input label="Nom" placeholder="Ex. Conférence" [ngModel]="form().name" (ngModelChange)="updateForm('name', $event)" />
        <app-ui-input
          label="Slug"
          placeholder="Ex. conference"
          [ngModel]="form().slug"
          (ngModelChange)="updateForm('slug', $event)"
          hint="Laissez vide pour générer automatiquement à partir du nom."
        />
        <app-ui-input label="Icône" placeholder="Ex. mic" [ngModel]="form().icon" (ngModelChange)="updateForm('icon', $event)" />
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-text-primary">Description</label>
          <textarea
            rows="3"
            class="w-full rounded-xl border border-hairline bg-surface-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-4 focus:ring-brand-teal/15"
            placeholder="Description de la catégorie..."
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
          <app-ui-button [disabled]="!form().name.trim()" [loading]="saving()" (clicked)="save()">
            {{ editing() ? 'Enregistrer' : 'Créer' }}
          </app-ui-button>
        </div>
      </div>
    </app-ui-modal>
  `
})
export class AdminCategoriesPage {
  private readonly categoryService = inject(CategoryService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly icons = { FolderTree, Tag, Plus, Search };
  protected readonly accentFor = categoryColor;

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchQuery = signal('');

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected readonly form = signal<CategoryForm>({ ...EMPTY_FORM });
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);

  protected readonly filteredCategories = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.categories();
    if (!query) return list;
    return list.filter((category) => {
      const haystack = `${category.name} ${category.slug} ${category.description ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly totalEvents = computed(() =>
    this.categories().reduce((sum, category) => sum + (category.eventCount ?? 0), 0)
  );

  protected readonly topCategory = computed(() => {
    const list = [...this.categories()].sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0));
    return list[0] ?? null;
  });

  protected readonly emptyCategories = computed(
    () => this.categories().filter((category) => (category.eventCount ?? 0) === 0).length
  );

  protected readonly distributionChart = computed<ChartPoint[]>(() =>
    this.categories().map((category) => ({
      label: category.name,
      value: category.eventCount ?? 0
    }))
  );

  protected readonly rankedCategories = computed(() =>
    [...this.categories()]
      .sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
      .slice(0, 5)
  );

  protected readonly previewSlug = computed(() => {
    const form = this.form();
    return form.slug.trim() || (form.name.trim() ? slugify(form.name) : '');
  });

  constructor() {
    this.fetchCategories();
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  protected rankWidth(count: number): number {
    const max = Math.max(1, ...(this.categories().map((category) => category.eventCount ?? 0)));
    return Math.max(6, Math.round((count / max) * 100));
  }

  protected openEdit(category: Category): void {
    this.editing.set(category);
    this.form.set({
      name: category.name,
      slug: category.slug,
      icon: category.icon ?? '',
      description: category.description ?? ''
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

  protected updateForm<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]): void {
    this.form.update((form) => ({ ...form, [key]: value }));
  }

  protected save(): void {
    const form = this.form();
    const name = form.name.trim();
    if (!name) return;
    const slug = form.slug.trim() || slugify(name);
    const payload = {
      name,
      slug,
      icon: form.icon.trim() || undefined,
      description: form.description.trim() || undefined
    };

    this.saving.set(true);
    const editing = this.editing();
    const request = editing
      ? this.categoryService.update(editing.id, payload)
      : this.categoryService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'Catégorie mise à jour.' : 'Catégorie créée.');
        this.closeModal();
        this.fetchCategories();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error("Impossible d'enregistrer la catégorie.");
      }
    });
  }

  protected async delete(category: Category): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Supprimer cette catégorie ?',
      message: `« ${category.name} » sera définitivement retirée. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      tone: 'danger'
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Catégorie supprimée.');
        this.closeModal();
        this.fetchCategories();
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Impossible de supprimer cette catégorie.');
      }
    });
  }

  private fetchCategories(): void {
    this.loading.set(true);
    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: () => {
        this.categories.set([]);
        this.loading.set(false);
        this.toast.error('Impossible de charger les catégories.');
      }
    });
  }
}
