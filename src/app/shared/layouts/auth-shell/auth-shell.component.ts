import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LucideAngularModule, Ticket, ScanLine, ChartColumn } from 'lucide-angular';

import { ToastContainerComponent } from '../../ui/toast/toast-container.component';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, LucideAngularModule, ToastContainerComponent],
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
  readonly icons = { Ticket, ScanLine, ChartColumn };
}
