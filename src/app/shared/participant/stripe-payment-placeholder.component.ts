import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CreditCard, Info, LucideAngularModule, ShieldCheck } from 'lucide-angular';

import { ButtonComponent } from '../ui/button/button.component';

/**
 * Stripe payment step — PLACEHOLDER only.
 *
 * Stripe is not wired in yet. The "Payer avec Stripe" button simulates a
 * successful payment (no real charge) by emitting `confirm`. To wire the real
 * integration later, replace the internals of this single component (mount
 * Stripe Elements, confirm the PaymentIntent) and emit `confirm` on real
 * success — the surrounding reservation flow does not need to change.
 */
@Component({
  selector: 'app-stripe-payment-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  template: `
    <div class="stripe-slot px-5 py-5">
      <div class="mb-4 flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-teal/10 text-brand-teal-dark">
          <lucide-angular [img]="icons.CreditCard" [size]="16"></lucide-angular>
        </span>
        <div>
          <div class="text-sm font-semibold text-text-primary">Paiement par carte</div>
          <div class="font-mono text-[10px] uppercase tracking-wide text-text-secondary">Zone sécurisée · Stripe</div>
        </div>
      </div>

      <!-- Placeholder notice: Stripe not yet integrated -->
      <div class="flex items-start gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4">
        <lucide-angular [img]="icons.Info" [size]="18" class="mt-0.5 shrink-0 text-brand-teal-dark"></lucide-angular>
        <div class="text-sm">
          <p class="font-semibold text-text-primary">Intégration Stripe à venir</p>
          <p class="mt-1 text-text-secondary">
            Le paiement en ligne sécurisé sera bientôt disponible. Pour l'instant, aucun montant n'est
            réellement débité — vous pouvez finaliser votre inscription en mode démonstration.
          </p>
        </div>
      </div>

      <div class="mt-5 flex items-center justify-between rounded-xl bg-surface-light p-3">
        <span class="text-sm font-medium text-text-primary">Montant à payer</span>
        <span class="font-mono text-lg font-bold tabular-nums text-brand-teal-dark">
          {{ amount() }} {{ currency() }}
        </span>
      </div>

      <app-ui-button class="mt-5 w-full" [loading]="processing()" (clicked)="confirm.emit()">
        Payer {{ amount() }} {{ currency() }} avec Stripe
      </app-ui-button>

      <p class="mt-4 flex items-center gap-2 text-xs text-text-secondary">
        <lucide-angular [img]="icons.ShieldCheck" [size]="14"></lucide-angular>
        Paiement sécurisé — vos informations ne sont pas stockées.
      </p>
    </div>
  `
})
export class StripePaymentPlaceholderComponent {
  readonly amount = input.required<number>();
  readonly currency = input<string>('MAD');
  readonly processing = input(false);

  readonly confirm = output<void>();

  protected readonly icons = { CreditCard, ShieldCheck, Info };
}
