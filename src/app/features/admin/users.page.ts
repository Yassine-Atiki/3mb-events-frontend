import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Building2,
  LucideAngularModule,
  Search,
  UserCheck,
  UserCog,
  Users,
  UserX
} from 'lucide-angular';

import { AdminService } from '../../core/api/admin.service';
import { UserService } from '../../core/api/user.service';
import { ChartPoint, User, UserRole, UserStatus } from '../../core/models';
import { AdminDonutChartComponent } from '../../shared/admin/admin-donut-chart.component';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/input/input.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../shared/ui/select/select.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

const ROLE_LABELS: Record<UserRole, string> = {
  ORGANIZER: 'Organisateur',
  ADMIN: 'Administrateur'
};

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SUSPENDED: 'Suspendu',
  PENDING_VERIFICATION: 'Vérification en attente'
};

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: '#53B29A',
  INACTIVE: '#94A3B8',
  SUSPENDED: '#F43F5E',
  PENDING_VERIFICATION: '#F59E0B'
};

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    AvatarComponent,
    ButtonComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
    SkeletonComponent,
    AdminDonutChartComponent,
    AdminStatusSpectrumComponent
  ],
  template: `
    <div class="admin-page flex w-full flex-col gap-8">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div class="page-header-badge mb-3">
            <lucide-angular [img]="icons.Users" [size]="12"></lucide-angular>
            <span>Annuaire plateforme</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Utilisateurs</h1>
          <p class="mt-1 max-w-2xl text-sm text-text-secondary">
            Gouvernance des comptes organisateurs et administrateurs — rôles, statuts et actions.
          </p>
        </div>
        <div class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-4 py-2 font-mono text-sm font-semibold tabular-nums text-brand-teal-dark">
          {{ filteredUsers().length }} compte{{ filteredUsers().length > 1 ? 's' : '' }} affiché{{ filteredUsers().length > 1 ? 's' : '' }}
        </div>
      </header>

      @if (loading()) {
        <div class="grid gap-4 xl:grid-cols-12">
          <app-ui-skeleton class="xl:col-span-12" height="108px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-8" height="480px" rounded="2xl" />
          <app-ui-skeleton class="xl:col-span-4" height="480px" rounded="2xl" />
        </div>
      } @else {
        <section class="admin-command-hero">
          <div class="admin-command-hero-grid">
            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Users" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Total comptes</p>
                <p class="admin-command-metric-value">{{ users().length }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ recentSignups() }} ce mois</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.UserCheck" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Actifs</p>
                <p class="admin-command-metric-value">{{ activeCount() }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ activeShare() }}% de la base</span>
            </article>

            <article class="admin-command-metric">
              <div class="admin-command-metric-icon">
                <lucide-angular [img]="icons.Building2" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">Organisateurs</p>
                <p class="admin-command-metric-value">{{ roleCount('ORGANIZER') }}</p>
              </div>
              <span class="admin-command-metric-chip">{{ roleCount('ADMIN') }} administrateurs</span>
            </article>

            <article class="admin-command-metric admin-command-metric--accent">
              <div class="admin-command-metric-icon admin-command-metric-icon--accent">
                <lucide-angular [img]="icons.UserX" [size]="18"></lucide-angular>
              </div>
              <div>
                <p class="admin-command-metric-label">À traiter</p>
                <p class="admin-command-metric-value">{{ attentionCount() }}</p>
              </div>
              <span class="admin-command-metric-chip admin-command-metric-chip--accent">suspendus + en attente</span>
            </article>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-12">
          <section class="admin-bento-tile xl:col-span-8">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="admin-bento-eyebrow">Registre</p>
                <h2 class="admin-bento-title">Annuaire des comptes</h2>
                <p class="admin-bento-subtitle">Recherche, filtres et actions de gouvernance</p>
              </div>
            </div>

            <div class="admin-users-toolbar mt-5">
              <app-ui-input
                class="min-w-[220px] flex-1"
                type="search"
                placeholder="Rechercher nom ou e-mail…"
                [leadingIcon]="icons.Search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
              <app-ui-select
                class="w-44"
                [clearable]="false"
                [options]="roleOptions"
                [ngModel]="roleFilter()"
                (ngModelChange)="onRoleFilterChange($event)"
              />
              <app-ui-select
                class="w-52"
                [clearable]="false"
                [options]="statusOptions"
                [ngModel]="statusFilter()"
                (ngModelChange)="onStatusFilterChange($event)"
              />
            </div>

            <div class="admin-users-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Inscrit le</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @if (filteredUsers().length === 0) {
                    <tr>
                      <td colspan="5" class="py-12 text-center text-text-secondary">
                        Aucun utilisateur ne correspond à vos critères.
                      </td>
                    </tr>
                  } @else {
                    @for (user of filteredUsers(); track user.id) {
                      <tr>
                        <td>
                          <div class="admin-user-cell">
                            <app-ui-avatar
                              [name]="user.firstName + ' ' + user.lastName"
                              [url]="user.avatarUrl"
                              size="sm"
                            />
                            <button type="button" (click)="openDetail(user)">
                              <span class="block truncate font-medium text-text-primary transition-colors hover:text-brand-teal-dark">
                                {{ user.firstName }} {{ user.lastName }}
                              </span>
                              <span class="block truncate text-xs text-text-secondary">{{ user.email }}</span>
                            </button>
                          </div>
                        </td>
                        <td>
                          <span class="admin-role-pill" [class]="rolePillClass(user.role)">
                            {{ roleLabel(user.role) }}
                          </span>
                        </td>
                        <td>
                          <span class="admin-user-status-pill" [class]="statusPillClass(user.status)">
                            <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80"></span>
                            {{ statusLabelFor(user.status) }}
                          </span>
                        </td>
                        <td class="font-mono text-xs tabular-nums text-text-secondary">{{ formatDate(user.createdAt) }}</td>
                        <td>
                          <div class="flex items-center justify-end gap-3">
                            <button type="button" class="admin-link-action" (click)="openDetail(user)">Détails</button>
                            @if (user.status === 'SUSPENDED') {
                              <button
                                type="button"
                                class="admin-link-action"
                                [disabled]="busyId() === user.id"
                                (click)="reactivate(user)"
                              >
                                Réactiver
                              </button>
                            } @else {
                              <button
                                type="button"
                                class="admin-link-action is-danger"
                                [disabled]="busyId() === user.id"
                                (click)="suspend(user)"
                              >
                                Suspendre
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </section>

          <div class="flex flex-col gap-4 xl:col-span-4">
            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Composition</p>
              <h2 class="admin-bento-title">Répartition par rôle</h2>
              <p class="admin-bento-subtitle">Vue instantanée de l'écosystème</p>
              <div class="mt-5">
                <app-admin-donut-chart [points]="roleChart()" ariaLabel="Répartition des utilisateurs par rôle" />
              </div>
            </section>

            <section class="admin-bento-tile">
              <p class="admin-bento-eyebrow">Santé comptes</p>
              <h2 class="admin-bento-title">Spectre des statuts</h2>
              <p class="admin-bento-subtitle">Actifs, en attente et suspendus</p>
              <div class="mt-5">
                <app-admin-status-spectrum
                  [points]="statusChart()"
                  [labelMap]="statusLabels"
                  [colorMap]="statusColors"
                  ariaLabel="Répartition des utilisateurs par statut"
                />
              </div>
            </section>
          </div>
        </div>
      }
    </div>

    <app-ui-modal [open]="selectedUser() !== null" [title]="modalTitle()" (close)="closeModal()">
      @if (selectedUser(); as user) {
        <div class="flex flex-col gap-5">
          <div class="admin-modal-hero">
            <div class="flex items-center gap-3">
              <app-ui-avatar [name]="user.firstName + ' ' + user.lastName" [url]="user.avatarUrl" size="lg" />
              <div class="min-w-0 flex-1">
                <p class="text-lg font-semibold text-white">{{ user.firstName }} {{ user.lastName }}</p>
                <p class="truncate text-sm text-white/70">{{ user.email }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span class="admin-role-pill" [class]="rolePillClass(user.role)">{{ roleLabel(user.role) }}</span>
                  <span class="admin-user-status-pill" [class]="statusPillClass(user.status)">
                    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80"></span>
                    {{ statusLabelFor(user.status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Organisation</p>
              <p class="mt-1 font-medium text-text-primary">{{ user.organization || '—' }}</p>
            </div>
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Téléphone</p>
              <p class="mt-1 font-medium text-text-primary">{{ user.phone || '—' }}</p>
            </div>
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Inscrit le</p>
              <p class="mt-1 font-mono font-medium tabular-nums text-text-primary">{{ formatDate(user.createdAt) }}</p>
            </div>
            <div class="rounded-xl border border-hairline bg-surface-light/60 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Dernière connexion</p>
              <p class="mt-1 font-mono font-medium tabular-nums text-text-primary">
                {{ user.lastLoginAt ? formatDate(user.lastLoginAt) : '—' }}
              </p>
            </div>
          </div>

          <div class="rounded-xl border border-hairline bg-surface-white p-4">
            <div class="mb-3 flex items-center gap-2">
              <lucide-angular [img]="icons.UserCog" [size]="16" class="text-brand-teal-dark"></lucide-angular>
              <label class="text-sm font-semibold text-text-primary">Changer le rôle</label>
            </div>
            <div class="flex gap-2">
              <app-ui-select
                class="flex-1"
                [clearable]="false"
                [options]="roleAssignOptions"
                [ngModel]="pendingRole()"
                (ngModelChange)="pendingRole.set($event)"
              />
              <app-ui-button
                variant="secondary"
                size="sm"
                [disabled]="!pendingRole() || pendingRole() === user.role || savingRole()"
                [loading]="savingRole()"
                (clicked)="changeRole(user)"
              >
                Appliquer
              </app-ui-button>
            </div>
          </div>

          <div class="ui-modal-footer">
            @if (user.status === 'SUSPENDED') {
              <app-ui-button variant="primary" [loading]="busyId() === user.id" (clicked)="reactivate(user)">
                Réactiver le compte
              </app-ui-button>
            } @else {
              <app-ui-button variant="danger" [loading]="busyId() === user.id" (clicked)="suspend(user)">
                Suspendre le compte
              </app-ui-button>
            }
          </div>
        </div>
      }
    </app-ui-modal>
  `
})
export class AdminUsersPage {
  private readonly userService = inject(UserService);
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly icons = { Users, UserCheck, Building2, UserX, Search, UserCog };
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusColors = STATUS_COLORS;

  protected readonly roleOptions: SelectOption[] = [
    { value: 'all', label: 'Tous les rôles' },
    { value: 'ORGANIZER', label: 'Organisateur' },
    { value: 'ADMIN', label: 'Administrateur' }
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'ACTIVE', label: 'Actif' },
    { value: 'INACTIVE', label: 'Inactif' },
    { value: 'SUSPENDED', label: 'Suspendu' },
    { value: 'PENDING_VERIFICATION', label: 'Vérification en attente' }
  ];

  protected readonly roleAssignOptions: SelectOption[] = [
    { value: 'ORGANIZER', label: 'Organisateur' },
    { value: 'ADMIN', label: 'Administrateur' }
  ];

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly roleFilter = signal('all');
  protected readonly statusFilter = signal('all');
  protected readonly searchQuery = signal('');

  protected readonly selectedUser = signal<User | null>(null);
  protected readonly pendingRole = signal<UserRole | ''>('');
  protected readonly busyId = signal<string | null>(null);
  protected readonly savingRole = signal(false);

  protected readonly filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.users();
    return this.users().filter((user) => {
      const haystack = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly roleChart = computed<ChartPoint[]>(() => [
    { label: 'Organisateurs', value: this.roleCount('ORGANIZER') },
    { label: 'Administrateurs', value: this.roleCount('ADMIN') }
  ]);

  protected readonly statusChart = computed<ChartPoint[]>(() => [
    { label: 'ACTIVE', value: this.statusCount('ACTIVE') },
    { label: 'INACTIVE', value: this.statusCount('INACTIVE') },
    { label: 'SUSPENDED', value: this.statusCount('SUSPENDED') },
    { label: 'PENDING_VERIFICATION', value: this.statusCount('PENDING_VERIFICATION') }
  ]);

  protected readonly activeCount = computed(
    () => this.users().filter((user) => user.status === 'ACTIVE').length
  );

  protected readonly recentSignups = computed(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return this.users().filter((user) => {
      const created = new Date(user.createdAt);
      return created.getMonth() === month && created.getFullYear() === year;
    }).length;
  });

  protected readonly attentionCount = computed(
    () =>
      this.users().filter(
        (user) => user.status === 'SUSPENDED' || user.status === 'PENDING_VERIFICATION'
      ).length
  );

  protected readonly modalTitle = computed(() => {
    const user = this.selectedUser();
    return user ? `Fiche · ${user.firstName} ${user.lastName}` : undefined;
  });

  constructor() {
    this.fetchUsers();
  }

  protected onRoleFilterChange(value: string): void {
    this.roleFilter.set(value);
    this.fetchUsers();
  }

  protected onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.fetchUsers();
  }

  protected openDetail(user: User): void {
    this.selectedUser.set(user);
    this.pendingRole.set(user.role);
  }

  protected closeModal(): void {
    this.selectedUser.set(null);
  }

  protected changeRole(user: User): void {
    const role = this.pendingRole();
    if (!role || role === user.role) return;
    this.savingRole.set(true);
    this.userService.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.savingRole.set(false);
        this.selectedUser.set(updated);
        this.replaceUser(updated);
        this.toast.success('Rôle mis à jour avec succès.');
      },
      error: () => {
        this.savingRole.set(false);
        this.toast.error('Impossible de modifier le rôle.');
      }
    });
  }

  protected suspend(user: User): void {
    this.busyId.set(user.id);
    this.adminService.suspendUser(user.id, "Suspension par l'administrateur").subscribe({
      next: (updated) => {
        this.busyId.set(null);
        if (this.selectedUser()) this.selectedUser.set(updated);
        this.replaceUser(updated);
        this.toast.success('Compte suspendu.');
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error('Impossible de suspendre ce compte.');
      }
    });
  }

  protected reactivate(user: User): void {
    this.busyId.set(user.id);
    this.adminService.reactivateUser(user.id).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        if (this.selectedUser()) this.selectedUser.set(updated);
        this.replaceUser(updated);
        this.toast.success('Compte réactivé.');
      },
      error: () => {
        this.busyId.set(null);
        this.toast.error('Impossible de réactiver ce compte.');
      }
    });
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role] ?? role;
  }

  protected statusLabelFor(status: UserStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  protected rolePillClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ORGANIZER: 'admin-role-pill--organizer',
      ADMIN: 'admin-role-pill--admin'
    };
    return `admin-role-pill ${map[role]}`;
  }

  protected statusPillClass(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      ACTIVE: 'admin-user-status-pill--active',
      INACTIVE: 'admin-user-status-pill--inactive',
      SUSPENDED: 'admin-user-status-pill--suspended',
      PENDING_VERIFICATION: 'admin-user-status-pill--pending'
    };
    return `admin-user-status-pill ${map[status]}`;
  }

  protected roleCount(role: UserRole): number {
    return this.users().filter((user) => user.role === role).length;
  }

  protected statusCount(status: UserStatus): number {
    return this.users().filter((user) => user.status === status).length;
  }

  protected activeShare(): number {
    const total = this.users().length;
    if (total === 0) return 0;
    return Math.round((this.activeCount() / total) * 100);
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  private replaceUser(updated: User): void {
    this.users.update((list) => list.map((user) => (user.id === updated.id ? updated : user)));
  }

  private fetchUsers(): void {
    this.loading.set(true);
    this.userService
      .search({
        page: 0,
        size: 100,
        sort: 'createdAt,desc',
        role: this.roleFilter() !== 'all' ? (this.roleFilter() as UserRole) : undefined,
        status: this.statusFilter() !== 'all' ? (this.statusFilter() as UserStatus) : undefined
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.content);
          this.loading.set(false);
        },
        error: () => {
          this.users.set([]);
          this.loading.set(false);
          this.toast.error('Impossible de charger les utilisateurs.');
        }
      });
  }
}
