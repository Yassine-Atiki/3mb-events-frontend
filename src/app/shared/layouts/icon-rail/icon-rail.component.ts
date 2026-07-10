import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ChevronLeft, ChevronRight, LucideAngularModule, type LucideIconData } from 'lucide-angular';

import { BRAND_LOGO_SRC } from '../../brand/brand.constants';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIconData;
}

export const ICON_RAIL_PANEL_COLLAPSED_W = 80;
export const ICON_RAIL_PANEL_EXPANDED_W = 252;
export const ICON_RAIL_SLOT_PAD = 12;
export const ICON_RAIL_COLLAPSED_W = ICON_RAIL_PANEL_COLLAPSED_W + ICON_RAIL_SLOT_PAD;
export const ICON_RAIL_EXPANDED_W = ICON_RAIL_PANEL_EXPANDED_W + ICON_RAIL_SLOT_PAD;
const PIN_STORAGE_KEY = '3mb-icon-rail-pinned';

@Component({
  selector: 'app-icon-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <aside
      class="shell-rail-desktop icon-rail-desktop fixed inset-y-0 left-0 hidden overflow-visible transition-[width] duration-300 ease-out lg:block"
      [style.width.px]="asideWidth()"
      aria-label="Navigation principale"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
    >
      <nav
        class="lumina-rail"
        [class.lumina-rail--overlay]="overlayMode()"
        [style.width.px]="navWidth()"
      >
        <a
          [routerLink]="homeLink()"
          class="lumina-rail-logo"
          [class.justify-center]="!showLabels()"
          [class.px-3]="showLabels()"
          [class.px-2]="!showLabels()"
          aria-label="3MB Events — Accueil"
        >
          <img
            [src]="logoSrc"
            alt="3MB Events"
            [class.max-h-8]="!showLabels()"
            [class.max-h-9]="showLabels()"
            [class.max-w-[3.25rem]]="!showLabels()"
            [class.max-w-[10.5rem]]="showLabels()"
          />
        </a>

        <div class="lumina-rail-nav">
          @for (item of items(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="{ exact: false }"
              [attr.aria-label]="item.label"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="lumina-rail-item"
              [class.lumina-rail-item--active]="rla.isActive"
              [class.justify-center]="!showLabels()"
              [class.px-2]="!showLabels()"
            >
              <span class="lumina-rail-icon">
                <lucide-angular [img]="item.icon" [size]="17"></lucide-angular>
              </span>
              <span class="lumina-rail-label" [class.lumina-rail-label--hidden]="!showLabels()">
                {{ item.label }}
              </span>
              @if (!showLabels()) {
                <span class="lumina-rail-tooltip" role="tooltip">{{ item.label }}</span>
              }
            </a>
          }
        </div>

        <div class="lumina-rail-footer">
          <button
            type="button"
            class="lumina-rail-pin"
            [attr.aria-label]="pinned() ? 'Réduire le menu' : 'Épingler le menu'"
            [attr.aria-pressed]="pinned()"
            (click)="togglePin()"
          >
            <lucide-angular [img]="pinned() ? icons.ChevronLeft : icons.ChevronRight" [size]="16"></lucide-angular>
            @if (showLabels()) {
              <span>{{ pinned() ? 'Réduire' : 'Épingler' }}</span>
            }
          </button>
        </div>
      </nav>
    </aside>

    @if (mobileOpen()) {
      <button
        type="button"
        class="fixed inset-0 z-40 bg-[#0f2e24]/25 backdrop-blur-[4px] lg:hidden"
        aria-label="Fermer le menu"
        (click)="mobileClose.emit()"
      ></button>
    }

    <aside
      class="lumina-rail-mobile icon-rail-mobile fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col transition-transform duration-300 ease-out lg:hidden"
      [class.-translate-x-full]="!mobileOpen()"
      [class.translate-x-0]="mobileOpen()"
      aria-label="Navigation principale"
    >
      <a
        [routerLink]="homeLink()"
        class="lumina-rail-logo px-4"
        (click)="mobileClose.emit()"
        aria-label="3MB Events — Accueil"
      >
        <img [src]="logoSrc" alt="3MB Events" class="max-h-9 max-w-[10.5rem]" />
      </a>

      <div class="lumina-rail-nav">
        @for (item of items(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive
            #mrla="routerLinkActive"
            [routerLinkActiveOptions]="{ exact: false }"
            [attr.aria-current]="mrla.isActive ? 'page' : null"
            class="lumina-rail-item"
            [class.lumina-rail-item--active]="mrla.isActive"
            (click)="mobileClose.emit()"
          >
            <span class="lumina-rail-icon">
              <lucide-angular [img]="item.icon" [size]="17"></lucide-angular>
            </span>
            <span class="lumina-rail-label">{{ item.label }}</span>
          </a>
        }
      </div>
    </aside>
  `
})
export class IconRailComponent {
  readonly items = input.required<NavItem[]>();
  readonly homeLink = input('/');
  readonly mobileOpen = input(false);

  readonly mobileClose = output<void>();
  readonly reserveWidthChange = output<number>();

  protected readonly logoSrc = BRAND_LOGO_SRC;
  protected readonly icons = { ChevronLeft, ChevronRight };

  protected readonly hovered = signal(false);
  protected readonly pinned = signal(this.readPinnedFromStorage());

  protected readonly showLabels = computed(() => this.pinned() || this.hovered());

  protected readonly asideWidth = computed(() =>
    this.pinned() ? ICON_RAIL_EXPANDED_W : ICON_RAIL_COLLAPSED_W
  );

  protected readonly navWidth = computed(() => {
    if (this.pinned()) return ICON_RAIL_PANEL_EXPANDED_W;
    if (this.hovered()) return ICON_RAIL_PANEL_EXPANDED_W;
    return ICON_RAIL_PANEL_COLLAPSED_W;
  });

  protected readonly overlayMode = computed(() => !this.pinned() && this.hovered());

  constructor() {
    effect(() => {
      const pinned = this.pinned();
      this.persistPinned(pinned);
      this.reserveWidthChange.emit(pinned ? ICON_RAIL_EXPANDED_W : ICON_RAIL_COLLAPSED_W);
    });
  }

  protected togglePin(): void {
    this.pinned.update((v) => !v);
    if (this.pinned()) {
      this.hovered.set(false);
    }
  }

  private readPinnedFromStorage(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  }

  private persistPinned(pinned: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  }
}
