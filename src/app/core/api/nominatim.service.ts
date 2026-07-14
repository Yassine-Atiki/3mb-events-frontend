import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

export interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface ResolvedAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

/** Morocco bounding box for Nominatim viewbox: left,top,right,bottom */
const MOROCCO_VIEWBOX = '-17.2,35.95,-0.95,20.75';

/**
 * Geocoding via Nominatim (Morocco-scoped search).
 * Browser CORS is blocked by Nominatim, so we call a same-origin base URL
 * (Angular `proxy.conf.json` in dev, or a backend/nginx proxy in prod).
 * Spaced ≥1s between outbound requests (usage policy).
 */
@Injectable({ providedIn: 'root' })
export class NominatimService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.nominatimUrl.replace(/\/$/, '');
  private readonly email = 'dev@3mbevents.com';
  private readonly minIntervalMs = 1000;

  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  search(query: string, limit = 8): Observable<NominatimSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) {
      return of([]);
    }

    const params = new HttpParams()
      .set('format', 'json')
      .set('q', q)
      .set('addressdetails', '1')
      .set('limit', String(limit))
      .set('countrycodes', 'ma')
      .set('viewbox', MOROCCO_VIEWBOX)
      .set('bounded', '0')
      .set('dedupe', '1')
      .set('accept-language', 'fr')
      .set('email', this.email);

    return this.enqueue(() =>
      this.http.get<NominatimSearchResult[]>(`${this.baseUrl}/search`, { params })
    ).pipe(
      map((results) => (Array.isArray(results) ? results : [])),
      catchError(() => of([] as NominatimSearchResult[]))
    );
  }

  reverse(latitude: number, longitude: number): Observable<ResolvedAddress | null> {
    const params = new HttpParams()
      .set('format', 'json')
      .set('lat', String(latitude))
      .set('lon', String(longitude))
      .set('addressdetails', '1')
      .set('accept-language', 'fr')
      .set('email', this.email);

    return this.enqueue(() =>
      this.http.get<NominatimSearchResult>(`${this.baseUrl}/reverse`, { params })
    ).pipe(
      map((raw) => (raw ? mapNominatimToResolved(raw) : null)),
      catchError(() => of(null))
    );
  }

  /** Serialise requests and wait for the policy gap before firing HTTP. */
  private enqueue<T>(factory: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      let cancelled = false;
      let innerSub: { unsubscribe(): void } | null = null;

      const run = this.queue.then(async () => {
        await this.waitSlot();
        if (cancelled) return;
        return new Promise<void>((resolve) => {
          innerSub = factory().subscribe({
            next: (value) => {
              if (!cancelled) subscriber.next(value);
            },
            error: (error) => {
              if (!cancelled) subscriber.error(error);
              resolve();
            },
            complete: () => {
              if (!cancelled) subscriber.complete();
              resolve();
            }
          });
        });
      });

      this.queue = run.then(
        () => undefined,
        () => undefined
      );

      return () => {
        cancelled = true;
        innerSub?.unsubscribe();
      };
    });
  }

  private waitSlot(): Promise<void> {
    const wait = Math.max(0, this.minIntervalMs - (Date.now() - this.lastRequestAt));
    return new Promise((resolve) => {
      setTimeout(() => {
        this.lastRequestAt = Date.now();
        resolve();
      }, wait);
    });
  }
}

/** Prefer the full Nominatim display line for the "Adresse" field (Google Maps style). */
export function mapNominatimToResolved(result: NominatimSearchResult): ResolvedAddress {
  const parts = result.address ?? {};
  const city =
    parts.city || parts.town || parts.village || parts.municipality || parts.county || '';
  const country = parts.country || (parts.country_code === 'ma' ? 'Maroc' : '') || '';

  return {
    address: (result.display_name || '').trim(),
    city,
    postalCode: parts.postcode ?? '',
    country
  };
}
