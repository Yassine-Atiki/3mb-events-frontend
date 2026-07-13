import { NgTemplateOutlet } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ChartColumn, LucideAngularModule, ScanLine, Ticket } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';

import { SplashCursorComponent } from '../../components/splash-cursor/splash-cursor.component';
import { ToastContainerComponent } from '../../ui/toast/toast-container.component';

const SPLASH_CURSOR_ROUTES = new Set([
  '/auth/connexion',
  '/auth/inscription/participant',
  '/auth/inscription/organisateur'
]);

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    LucideAngularModule,
    ToastContainerComponent,
    SplashCursorComponent,
    NgTemplateOutlet
  ],
  templateUrl: './auth-shell.component.html',
  styles: [
    `
      @keyframes auth-card-in {
        from {
          opacity: 0;
          transform: translateY(16px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .auth-card {
        animation: auth-card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
    `
  ]
})
export class AuthShellComponent {
  private readonly router = inject(Router);

  readonly icons = { Ticket, ScanLine, ChartColumn };

  protected readonly splashCursorEnabled = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.isSplashCursorRoute()),
      startWith(this.isSplashCursorRoute())
    ),
    { initialValue: this.isSplashCursorRoute() }
  );

  private isSplashCursorRoute(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return SPLASH_CURSOR_ROUTES.has(url);
  }
}
