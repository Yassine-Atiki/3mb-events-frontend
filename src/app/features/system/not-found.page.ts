import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Compass, LucideAngularModule } from 'lucide-angular';

import { ButtonComponent } from '../../shared/ui/button/button.component';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, ButtonComponent],
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center bg-surface-light px-4 py-16 text-center">
      <div class="grid h-20 w-20 place-items-center rounded-3xl bg-brand-teal/15 text-brand-teal-dark">
        <lucide-angular [img]="icon" [size]="34" [strokeWidth]="1.75"></lucide-angular>
      </div>
      <div class="mt-6 text-6xl font-bold tracking-tight text-brand-teal-dark">404</div>
      <h1 class="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Page introuvable</h1>
      <p class="mt-3 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
        La page que vous cherchez n'existe pas, a été déplacée ou son adresse est incorrecte.
      </p>
      <a routerLink="/" class="mt-8">
        <app-ui-button>Retour à l'accueil</app-ui-button>
      </a>
    </div>
  `
})
export class NotFoundPage {
  protected readonly icon = Compass;
}
