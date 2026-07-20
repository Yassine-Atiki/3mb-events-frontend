import { Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  FolderTree,
  LayoutDashboard,
  LogOut,
  LucideAngularModule,
  Menu,
  ScanLine,
  ScrollText,
  Settings,
  Users
} from 'lucide-angular';

import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationStore } from '../../../core/auth/notification.store';
import { AvatarComponent } from '../../ui/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogService } from '../../ui/confirm-dialog/confirm-dialog.service';
import { ToastContainerComponent } from '../../ui/toast/toast-container.component';
import { IconRailComponent, ICON_RAIL_COLLAPSED_W, ICON_RAIL_EXPANDED_W, NavItem } from '../icon-rail/icon-rail.component';

const ROLE_HOME: Record<string, string> = {
  ORGANIZER: '/organisateur/tableau-de-bord',
  ADMIN: '/admin/tableau-de-bord'
};

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    LucideAngularModule,
    AvatarComponent,
    ToastContainerComponent,
    ConfirmDialogComponent,
    IconRailComponent
  ],
  templateUrl: './app-shell.component.html',
  styles: [
    `
      .app-shell-main {
        padding-left: 0;
      }
      @media (min-width: 1024px) {
        .app-shell-main {
          padding-left: var(--rail-reserve, 92px);
        }
      }
    `
  ]
})
export class AppShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly notificationStore = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notificationsMenuRef = viewChild<ElementRef<HTMLElement>>('notificationsMenu');
  private readonly userMenuRef = viewChild<ElementRef<HTMLElement>>('userMenu');

  protected readonly notifOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly headerScrolled = signal(false);
  protected readonly currentUrl = signal(this.router.url);
  protected readonly railReserveWidth = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('3mb-icon-rail-pinned') === 'true'
      ? ICON_RAIL_EXPANDED_W
      : ICON_RAIL_COLLAPSED_W
  );

  protected readonly icons = { Bell, LogOut, Settings, Menu, ChevronDown };

  protected readonly user = this.authStore.user;

  protected readonly roleHome = computed(() => ROLE_HOME[this.user()?.role ?? ''] ?? '/');

  protected readonly roleLabel = computed(() => {
    switch (this.user()?.role) {
      case 'ORGANIZER':
        return 'Organisateur';
      case 'ADMIN':
        return 'Administrateur';
      default:
        return 'Compte';
    }
  });

  protected readonly profileLink = computed(() => {
    switch (this.user()?.role) {
      case 'ORGANIZER':
        return '/organisateur/profil';
      case 'ADMIN':
        return '/admin/profil';
      default:
        return '/403';
    }
  });

  protected readonly navItems = computed<NavItem[]>(() => {
    switch (this.user()?.role) {
      case 'ORGANIZER':
        return [
          { label: 'Tableau de bord', path: '/organisateur/tableau-de-bord', icon: LayoutDashboard },
          { label: 'Mes événements', path: '/organisateur/evenements', icon: CalendarDays },
          { label: 'Lieux', path: '/organisateur/lieux', icon: Building2 },
          { label: 'Catégories', path: '/organisateur/categories', icon: FolderTree },
          { label: 'Scanner', path: '/organisateur/scanner', icon: ScanLine },
          { label: 'Remboursements', path: '/organisateur/remboursements', icon: Banknote }
        ];
      case 'ADMIN':
        return [
          { label: 'Tableau de bord', path: '/admin/tableau-de-bord', icon: LayoutDashboard },
          { label: 'Utilisateurs', path: '/admin/utilisateurs', icon: Users },
          { label: 'Journal', path: '/admin/journal', icon: ScrollText },
          { label: 'Rapports', path: '/admin/rapports', icon: ChartColumn }
        ];
      default:
        return [];
    }
  });

  protected readonly contextTitle = computed(() => {
    const url = this.currentUrl();
    const items = [...this.navItems()].sort((a, b) => b.path.length - a.path.length);
    const match = items.find((item) => url === item.path || url.startsWith(item.path + '/'));
    return match?.label ?? this.roleLabel();
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
    });

    const onScroll = (): void => {
      this.headerScrolled.set(window.scrollY > 16);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
    this.userMenuOpen.set(false);
    this.notifOpen.set(false);
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected onRailReserveWidth(width: number): void {
    this.railReserveWidth.set(width);
  }

  protected toggleNotifications(): void {
    this.notifOpen.update((open) => !open);
    this.userMenuOpen.set(false);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
    this.notifOpen.set(false);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;

    if (this.userMenuOpen()) {
      const userMenu = this.userMenuRef()?.nativeElement;
      if (userMenu && !userMenu.contains(target)) {
        this.userMenuOpen.set(false);
      }
    }

    if (this.notifOpen()) {
      const notificationsMenu = this.notificationsMenuRef()?.nativeElement;
      if (notificationsMenu && !notificationsMenu.contains(target)) {
        this.notifOpen.set(false);
      }
    }
  }

  protected async logout(): Promise<void> {
    this.userMenuOpen.set(false);
    const confirmed = await this.confirmDialog.confirm({
      title: 'Se déconnecter ?',
      message: 'Vous allez quitter votre espace 3MB Events. Vous pourrez vous reconnecter à tout moment.',
      confirmLabel: 'Se déconnecter',
      cancelLabel: 'Rester connecté',
      tone: 'neutral'
    });
    if (!confirmed) return;

    this.authStore.logout();
    this.router.navigate(['/auth/connexion']);
  }
}
