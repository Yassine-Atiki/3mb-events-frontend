import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { CalendarDays, ImageOff, LucideAngularModule, MapPin, Ticket } from 'lucide-angular';

export interface EventPreviewData {
  title?: string;
  shortDescription?: string;
  coverImageUrl?: string;
  city?: string;
  venueName?: string;
  startAt?: string;
  priceFrom?: number;
  isFree?: boolean;
  capacity?: number;
  categoryName?: string;
  ticketCount?: number;
}

@Component({
  selector: 'app-event-card-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div
      class="overflow-hidden rounded-xl border border-hairline bg-organizer-surface shadow-soft transition-all duration-500"
      [class.opacity-60]="completeness() < 20"
    >
      <div class="relative aspect-[16/10] overflow-hidden bg-organizer-bg">
        @if (showCoverImage()) {
          <img
            [src]="data().coverImageUrl!"
            alt=""
            class="h-full w-full object-cover"
            (load)="onCoverLoad()"
            (error)="onCoverError()"
          />
        } @else {
          <div
            class="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-brand-teal/15 to-brand-teal-dark/10 px-4 text-center text-brand-teal-dark/50"
          >
            @if (coverLoadFailed()) {
              <lucide-angular [img]="icons.ImageOff" [size]="24"></lucide-angular>
              <p class="text-[10px] font-medium leading-snug">Image inaccessible — vérifiez l'URL directe</p>
            } @else {
              <lucide-angular [img]="icons.Ticket" [size]="28"></lucide-angular>
            }
          </div>
        }
        @if (data().categoryName) {
          <span
            class="absolute left-2 top-2 rounded-md bg-organizer-surface/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary backdrop-blur-sm"
          >
            {{ data().categoryName }}
          </span>
        }
        @if (priceLabel(); as price) {
          <span
            class="absolute bottom-2 right-2 rounded-md bg-charcoal/80 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-white backdrop-blur-sm"
          >
            {{ price }}
          </span>
        }
      </div>

      <div class="space-y-2 p-3">
        <h3
          class="line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-all duration-300"
          [class.text-text-secondary]="!data().title"
        >
          {{ data().title || "Titre de l'événement" }}
        </h3>

        @if (data().shortDescription) {
          <p class="line-clamp-2 text-[11px] leading-relaxed text-text-secondary">{{ data().shortDescription }}</p>
        }

        <div class="space-y-1 border-t border-hairline pt-2">
          @if (data().startAt) {
            <div class="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <lucide-angular [img]="icons.CalendarDays" [size]="12" class="shrink-0 text-brand-teal"></lucide-angular>
              <span>{{ formatDate(data().startAt!) }}</span>
            </div>
          }
          @if (data().city) {
            <div class="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <lucide-angular [img]="icons.MapPin" [size]="12" class="shrink-0 text-brand-teal"></lucide-angular>
              <span class="truncate">{{ locationLine() }}</span>
            </div>
          }
        </div>

        @if (data().ticketCount && data().ticketCount! > 0) {
          <div class="flex items-center gap-1.5 text-[10px] font-medium text-brand-teal-dark">
            <lucide-angular [img]="icons.Ticket" [size]="11"></lucide-angular>
            {{ data().ticketCount }} type(s) de billet
          </div>
        }
      </div>

      <div class="h-1 bg-organizer-bg">
        <div
          class="h-full bg-brand-teal transition-all duration-500 ease-out"
          [style.width.%]="completeness()"
        ></div>
      </div>
    </div>
  `
})
export class EventCardPreviewComponent {
  readonly data = input<EventPreviewData>({});
  readonly completeness = input(0);

  protected readonly icons = { CalendarDays, MapPin, Ticket, ImageOff };
  protected readonly coverLoadFailed = signal(false);

  protected readonly showCoverImage = computed(
    () => !!this.data().coverImageUrl && !this.coverLoadFailed()
  );

  constructor() {
    effect(() => {
      this.data().coverImageUrl;
      this.coverLoadFailed.set(false);
    });
  }

  protected onCoverLoad(): void {
    this.coverLoadFailed.set(false);
  }

  protected onCoverError(): void {
    this.coverLoadFailed.set(true);
  }

  protected readonly priceLabel = computed(() => {
    const d = this.data();
    if (!d.capacity && d.priceFrom === undefined && !d.isFree) return null;
    if (d.isFree) return 'Gratuit';
    if (d.priceFrom !== undefined && d.priceFrom > 0) return `À partir de ${d.priceFrom} MAD`;
    return null;
  });

  protected locationLine(): string {
    const d = this.data();
    if (d.venueName && d.city) return `${d.venueName}, ${d.city}`;
    return d.city ?? '';
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  }
}
