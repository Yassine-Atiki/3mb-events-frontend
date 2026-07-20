import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ScanLine } from 'lucide-angular';
import type { Html5Qrcode } from 'html5-qrcode';

import { EventService } from '../../core/api/event.service';
import { TicketService } from '../../core/api/ticket.service';
import { Event, ChartPoint } from '../../core/models';
import { AdminStatusSpectrumComponent } from '../../shared/admin/admin-status-spectrum.component';
import { OccupancyArcComponent } from '../../shared/organizer/occupancy-arc.component';
import { extractEventIdFromQrPayload, extractQrCode } from '../../shared/organizer/qr-payload.util';

type ScanState = 'idle' | 'valid' | 'already' | 'invalid';

interface ScanHistoryEntry {
  id: string;
  code: string;
  state: 'valid' | 'invalid' | 'already';
  message: string;
  participantName?: string;
  scannedAt: string;
}

const HISTORY_LABELS: Record<ScanHistoryEntry['state'], string> = {
  valid: 'Valides',
  already: 'Déjà scannés',
  invalid: 'Invalides'
};

const HISTORY_COLORS: Record<ScanHistoryEntry['state'], string> = {
  valid: '#53B29A',
  already: '#F59E0B',
  invalid: '#F43F5E'
};
const FLASH_CLASSES: Record<Exclude<ScanState, 'idle'>, string> = {
  valid: 'scan-flash-valid',
  already: 'scan-flash-already',
  invalid: 'scan-flash-invalid'
};

@Component({
  selector: 'app-organizer-scan-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    AdminStatusSpectrumComponent,
    OccupancyArcComponent
  ],
  template: `
    <div class="organizer-page -mx-6 -mb-6 flex flex-col lg:-mx-10 lg:-mb-10">
      <div class="scan-viewfinder relative flex flex-col" [class]="flashClass()">
        <a
          routerLink="/organisateur/scanner"
          class="absolute left-4 top-4 z-20 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/55"
        >
          ← Changer d'événement
        </a>

        @if (event(); as ev) {
          <div
            class="absolute left-4 right-4 top-14 z-20 rounded-xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-md"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style="background: color-mix(in srgb, #53B29A 22%, transparent); color: #7BDAC2"
              >
                <lucide-angular [img]="icons.ScanLine" [size]="16"></lucide-angular>
              </span>
              <div class="min-w-0">
                <h2 class="line-clamp-2 text-sm font-bold text-white">{{ ev.title }}</h2>
                <p class="mt-0.5 text-xs text-white/65">
                  {{ ev.city }} · {{ formatDate(ev.startAt) }}
                </p>
              </div>
            </div>
          </div>
        }

        <div id="organizer-qr-reader" #reader class="min-h-[52dvh] w-full flex-1 [&_video]:!object-cover"></div>

        <div class="scan-corner-frame" aria-hidden="true"><span></span></div>

        @if (resultVisible()) {
          <div
            class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          >
            <p class="font-mono text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {{ displayName() }}
            </p>
          </div>
        }

        @if (cameraError()) {
          <p class="absolute bottom-8 left-0 right-0 z-20 px-6 text-center text-xs text-white/80">
            {{ cameraError() }} — utilisez la saisie manuelle ci-dessous.
          </p>
        }
      </div>

      <section class="organizer-scan-command-bar">
        <div class="organizer-scan-command-grid">
          <article class="organizer-scan-metric" style="--scan-metric-accent: #53B29A">
            <p class="organizer-scan-metric-label">Scannés</p>
            <p class="organizer-scan-metric-value">{{ scannedCount() }}</p>
          </article>
          <article class="organizer-scan-metric" style="--scan-metric-accent: #6366F1">
            <p class="organizer-scan-metric-label">Capacité</p>
            <p class="organizer-scan-metric-value">{{ totalCapacity() }}</p>
          </article>
          <article class="organizer-scan-metric" style="--scan-metric-accent: #3B82F6">
            <p class="organizer-scan-metric-label">Valides</p>
            <p class="organizer-scan-metric-value">{{ validHistoryCount() }}</p>
          </article>
          <article class="organizer-scan-metric" style="--scan-metric-accent: #F43F5E">
            <p class="organizer-scan-metric-label">Anomalies</p>
            <p class="organizer-scan-metric-value">{{ anomalyCount() }}</p>
          </article>
        </div>
      </section>

      <section class="organizer-scan-deck">
        <div class="grid gap-4 xl:grid-cols-12">
          <div class="organizer-panel xl:col-span-4">
            <p class="organizer-panel-eyebrow">Remplissage</p>
            <h2 class="organizer-panel-title">Occupation live</h2>
            <p class="organizer-panel-subtitle">Scans validés sur la capacité totale</p>
            <div class="mt-4 flex justify-center py-2">
              <app-occupancy-arc
                [current]="scannedCount()"
                [max]="totalCapacity()"
                [size]="148"
                label="Occupation"
                [showRatio]="true"
                accent="#53B29A"
              />
            </div>
          </div>

          <div class="organizer-panel xl:col-span-8">
            <p class="organizer-panel-eyebrow">Session</p>
            <h2 class="organizer-panel-title">Répartition des scans</h2>
            <p class="organizer-panel-subtitle">Valides, déjà scannés et invalides</p>
            @if (history().length > 0) {
              <div class="mt-4">
                <app-admin-status-spectrum
                  [points]="historySpectrum()"
                  [labelMap]="historyLabelMap"
                  [colorMap]="historyColorMap"
                  ariaLabel="Répartition des scans de la session"
                />
              </div>
            } @else {
              <p class="mt-6 rounded-xl border border-dashed border-hairline bg-white/60 px-4 py-8 text-center text-sm text-text-secondary">
                Scannez un premier billet pour afficher la répartition.
              </p>
            }
          </div>

          <div class="organizer-panel xl:col-span-7">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <p class="organizer-panel-eyebrow">Flux</p>
                <h2 class="organizer-panel-title">Historique</h2>
              </div>
              <span class="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 font-mono text-xs font-semibold tabular-nums text-brand-teal-dark">
                {{ history().length }} entrée{{ history().length > 1 ? 's' : '' }}
              </span>
            </div>
            <ul class="max-h-72 space-y-2 overflow-y-auto pr-1">
              @for (entry of history(); track entry.id) {
                <li class="organizer-scan-history-item">
                  <span
                    class="organizer-scan-history-dot"
                    [style.background-color]="historyColor(entry.state)"
                  ></span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium text-text-primary">
                      {{ entry.participantName ?? entry.code }}
                    </p>
                    <p class="truncate text-[11px] text-text-secondary">{{ entry.message }}</p>
                  </div>
                  <span class="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
                    {{ formatTime(entry.scannedAt) }}
                  </span>
                </li>
              } @empty {
                <li class="rounded-xl border border-dashed border-hairline bg-white/60 px-4 py-8 text-center text-sm text-text-secondary">
                  Aucun scan pour le moment.
                </li>
              }
            </ul>
          </div>

          <div class="organizer-panel xl:col-span-5">
            <p class="organizer-panel-eyebrow">Secours</p>
            <h2 class="organizer-panel-title">Saisie manuelle</h2>
            <p class="organizer-panel-subtitle">Si la caméra est indisponible ou le QR illisible</p>
            <form [formGroup]="manualForm" (ngSubmit)="submitManualCode()" class="mt-5 space-y-3">
              <input
                formControlName="code"
                placeholder="Code billet..."
                class="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
              <button
                type="submit"
                class="w-full rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark"
              >
                Valider le code
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  `
})
export class ScanPage implements AfterViewInit, OnDestroy {
  readonly eventId = input<string>();

  private readonly eventService = inject(EventService);
  private readonly ticketService = inject(TicketService);
  private readonly fb = inject(FormBuilder);

  private readonly readerRef = viewChild<ElementRef<HTMLDivElement>>('reader');

  private scanner: Html5Qrcode | null = null;
  private cameraStarting = false;
  private lastProcessedCode: string | null = null;
  private lastProcessedAt = 0;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly icons = { ScanLine };

  protected readonly historyLabelMap = HISTORY_LABELS;
  protected readonly historyColorMap = HISTORY_COLORS;

  protected readonly event = signal<Event | null>(null);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly scanState = signal<ScanState>('idle');
  protected readonly history = signal<ScanHistoryEntry[]>([]);
  protected readonly resultVisible = signal(false);
  protected readonly displayName = signal('');
  protected readonly scannedCount = signal(0);
  protected readonly issuedCount = signal(0);
  protected readonly flashClass = signal('');

  protected readonly totalCapacity = computed(() => {
    const event = this.event();
    if (!event) return 200;
    return Math.max(event.capacity || 0, this.issuedCount(), 1);
  });

  protected readonly validHistoryCount = computed(
    () => this.history().filter((entry) => entry.state === 'valid').length
  );

  protected readonly anomalyCount = computed(
    () => this.history().filter((entry) => entry.state !== 'valid').length
  );

  protected readonly historySpectrum = computed((): ChartPoint[] => {
    const counts: Record<ScanHistoryEntry['state'], number> = { valid: 0, already: 0, invalid: 0 };
    for (const entry of this.history()) {
      counts[entry.state]++;
    }
    return (['valid', 'already', 'invalid'] as const)
      .map((label) => ({ label, value: counts[label] }))
      .filter((point) => point.value > 0);
  });

  protected readonly manualForm = this.fb.nonNullable.group({ code: [''] });

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (!id) return;
      this.eventService.getById(id).subscribe({
        next: (event) => {
          this.event.set(event);
        },
        error: () => this.event.set(null)
      });
      this.ticketService.getScanStats(id).subscribe({
        next: (stats) => {
          this.scannedCount.set(stats.scanned);
          this.issuedCount.set(stats.issued);
        },
        error: () => {
          this.scannedCount.set(0);
          this.issuedCount.set(0);
        }
      });
    });
  }

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso)
    );
  }

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
      new Date(iso)
    );
  }

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  protected submitManualCode(): void {
    const code = this.manualForm.getRawValue().code.trim();
    if (!code) return;
    this.handleScan(code);
    this.manualForm.reset({ code: '' });
  }

  protected historyColor(state: ScanHistoryEntry['state']): string {
    return HISTORY_COLORS[state];
  }

  private async startCamera(): Promise<void> {
    if (this.cameraStarting || typeof window === 'undefined') return;
    this.cameraStarting = true;

    try {
      const readerEl = this.readerRef()?.nativeElement;
      if (!readerEl) {
        this.cameraStarting = false;
        return;
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      this.scanner = new Html5Qrcode(readerEl.id);

      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => this.handleScan(decodedText),
        () => {}
      );

      this.cameraError.set(null);
    } catch {
      this.cameraError.set('Caméra inaccessible');
    } finally {
      this.cameraStarting = false;
    }
  }

  private stopCamera(): void {
    const scanner = this.scanner;
    if (scanner?.isScanning) {
      scanner.stop().catch(() => {});
    }
  }

  private handleScan(code: string): void {
    const eventId = this.eventId();
    if (!eventId) return;

    const qrCode = extractQrCode(code);
    const payloadEventId = extractEventIdFromQrPayload(code);
    if (payloadEventId && payloadEventId !== eventId) {
      this.showResult('invalid', "Ce billet n'appartient pas à cet événement");
      this.pushHistory(qrCode, 'invalid', 'Mauvais événement');
      return;
    }

    const now = Date.now();
    if (this.lastProcessedCode === qrCode && now - this.lastProcessedAt < 3000) return;
    this.lastProcessedCode = qrCode;
    this.lastProcessedAt = now;

    this.ticketService.validateByQrCode(qrCode, eventId).subscribe({
      next: (ticket) => {
        const name = `${ticket.participantFirstName} ${ticket.participantLastName}`.trim() || 'Billet valide';
        this.showResult('valid', name);
        this.scannedCount.update((c) => c + 1);
        this.pushHistory(qrCode, 'valid', 'Billet valide', name);
      },
      error: (error: HttpErrorResponse) => {
        const apiError = error.error as { code?: string; message?: string } | null;
        const code = apiError?.code;
        const isAlready = code === 'ALREADY_SCANNED';
        const state: ScanState = isAlready ? 'already' : 'invalid';
        const message =
          apiError?.message ??
          (code === 'WRONG_EVENT'
            ? "Ce billet n'appartient pas à cet événement"
            : code === 'TICKET_EXPIRED'
              ? 'Billet expiré'
              : code === 'TICKET_CANCELLED'
                ? 'Billet annulé'
                : 'Billet invalide');
        this.showResult(state, message);
        this.pushHistory(qrCode, state, message);
      }
    });
  }

  private showResult(state: Exclude<ScanState, 'idle'>, fallbackName: string): void {
    this.scanState.set(state);
    this.flashClass.set(FLASH_CLASSES[state]);
    this.displayName.set(fallbackName);
    this.resultVisible.set(true);

    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.resultVisible.set(false);
      this.flashClass.set('');
      this.scanState.set('idle');
      this.displayName.set('');
    }, 1500);
  }

  private pushHistory(
    code: string,
    state: ScanHistoryEntry['state'],
    message: string,
    participantName?: string
  ): void {
    const entry: ScanHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      state,
      message,
      participantName,
      scannedAt: new Date().toISOString()
    };
    this.history.update((list) => [entry, ...list].slice(0, 30));
  }
}
