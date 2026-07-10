import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, Mail, MapPin, Menu, Phone, X } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';

import { ToastContainerComponent } from '../../ui/toast/toast-container.component';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, LucideAngularModule],
  templateUrl: './public-shell.component.html'
})
export class PublicShellComponent {
  protected readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly icons = { Menu, X, Mail, Phone, MapPin };

  protected readonly isLanding = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => {
        const url = event.urlAfterRedirects.split('?')[0];
        return url === '/' || url === '';
      }),
      startWith(true)
    ),
    { initialValue: true }
  );

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
