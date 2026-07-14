import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';

/**
 * Consistent page-level “back” control for drill-down / flow screens.
 * Prefer an explicit `link` when the parent route is known; otherwise uses browser history
 * (with an optional `fallbackLink` if there is no history entry).
 */
@Component({
  selector: 'app-page-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    @if (link()) {
      <a [routerLink]="link()" class="page-back-link">
        <lucide-angular [img]="icons.ArrowLeft" [size]="14"></lucide-angular>
        <span>{{ label() }}</span>
      </a>
    } @else {
      <button type="button" class="page-back-link" (click)="goBack()">
        <lucide-angular [img]="icons.ArrowLeft" [size]="14"></lucide-angular>
        <span>{{ label() }}</span>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page-back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        border: 1px solid var(--color-hairline);
        border-radius: 9999px;
        background: #fff;
        padding: 0.4rem 0.85rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-brand-teal-dark);
        text-decoration: none;
        cursor: pointer;
        transition:
          background 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }

      .page-back-link:hover {
        border-color: color-mix(in srgb, var(--color-brand-teal) 35%, var(--color-hairline));
        background: color-mix(in srgb, var(--color-brand-teal) 8%, white);
      }
    `
  ]
})
export class PageBackLinkComponent {
  /** Explicit parent route (string or commands array). */
  readonly link = input<string | readonly unknown[] | null>(null);
  readonly label = input('Retour');
  /** Used when there is no `link` and the browser has no meaningful history. */
  readonly fallbackLink = input<string | readonly unknown[]>('/');

  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly icons = { ArrowLeft };

  protected goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    const fallback = this.fallbackLink();
    void this.router.navigate(Array.isArray(fallback) ? [...fallback] : [fallback]);
  }
}
