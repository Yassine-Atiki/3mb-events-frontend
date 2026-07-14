import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, MapPin, Search, X } from 'lucide-angular';
import * as LeafletNS from 'leaflet';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import {
  mapNominatimToResolved,
  NominatimSearchResult,
  NominatimService,
  ResolvedAddress
} from '../../core/api/nominatim.service';

/** esbuild CJS interop — Leaflet methods may sit on `.default`. */
const L = ((LeafletNS as unknown as { default?: typeof LeafletNS }).default ??
  LeafletNS) as typeof LeafletNS;

export type MapLocationMode = 'edit' | 'view';

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

/** Fixed map canvas height — never use % height (breaks inside modals). */
const MAP_HEIGHT_EDIT_PX = 240;
const MAP_HEIGHT_VIEW_PX = 192;
const DEFAULT_CENTER: L.LatLngTuple = [33.5731, -7.5898];
const DEFAULT_ZOOM = 11;
const MARKER_ZOOM = 15;
const USER_ZOOM = 14;

@Component({
  selector: 'app-map-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './map-location.component.html',
  styleUrl: './map-location.component.css'
})
export class MapLocationComponent implements OnDestroy {
  readonly mode = input<MapLocationMode>('view');
  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly caption = input<string | null>(null);

  readonly coordinatesChange = output<MapCoordinates>();
  readonly addressChange = output<ResolvedAddress>();

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private readonly nominatim = inject(NominatimService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly icons = { Search, MapPin, X };
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<NominatimSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly searchAttempted = signal(false);
  protected readonly reverseBusy = signal(false);
  protected readonly mapReady = signal(false);

  private readonly searchInput$ = new Subject<string>();
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private userMarker: L.Marker | null = null;
  private reverseToken = 0;
  private skipNextExternalSync = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap((query) => {
          const q = query.trim();
          if (q.length < 2) {
            this.searching.set(false);
            this.searchAttempted.set(false);
            this.searchResults.set([]);
            this.searchOpen.set(false);
            return of([] as NominatimSearchResult[]);
          }
          this.searching.set(true);
          this.searchAttempted.set(true);
          this.searchOpen.set(true);
          return this.nominatim.search(q);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (results) => {
          this.searching.set(false);
          this.searchResults.set(Array.isArray(results) ? results : []);
          this.searchOpen.set(this.searchAttempted() && this.searchQuery().trim().length >= 2);
        },
        error: () => {
          this.searching.set(false);
          this.searchResults.set([]);
          this.searchOpen.set(this.searchAttempted());
        }
      });

    effect(() => {
      const lat = this.latitude();
      const lng = this.longitude();
      if (!this.map) return;
      if (this.skipNextExternalSync) {
        this.skipNextExternalSync = false;
        return;
      }
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        this.placeMarker(lat, lng, { pan: true, reverse: false, emit: false });
      } else if (this.mode() === 'view') {
        this.clearMarker();
      }
    });

    afterNextRender(() => {
      this.createMap();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.marker = null;
    this.userMarker = null;
  }

  protected hostHeightPx(): number {
    return this.mode() === 'edit' ? MAP_HEIGHT_EDIT_PX : MAP_HEIGHT_VIEW_PX;
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput$.next(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchOpen.set(false);
    this.searchAttempted.set(false);
  }

  protected selectSearchResult(result: NominatimSearchResult): void {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.searchOpen.set(false);
    this.searchQuery.set(result.display_name);
    // Use the selected suggestion’s full address immediately (no reverse overwrite).
    this.addressChange.emit(mapNominatimToResolved(result));
    this.placeMarker(lat, lng, { pan: true, reverse: false, emit: true, zoom: MARKER_ZOOM });
  }

  private createMap(): void {
    const host = this.mapHost()?.nativeElement;
    if (!host || this.map) return;

    const height = this.hostHeightPx();
    host.style.width = '100%';
    host.style.height = `${height}px`;
    host.style.minHeight = `${height}px`;
    host.style.maxHeight = `${height}px`;

    const lat = this.latitude();
    const lng = this.longitude();
    const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    this.map = L.map(host, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.map.setView(
      hasCoords ? ([lat!, lng!] as L.LatLngTuple) : DEFAULT_CENTER,
      hasCoords ? MARKER_ZOOM : DEFAULT_ZOOM
    );

    if (this.mode() === 'edit') {
      this.map.on('click', (event: L.LeafletMouseEvent) => {
        this.placeMarker(event.latlng.lat, event.latlng.lng, {
          pan: false,
          reverse: true,
          emit: true
        });
      });
    }

    if (hasCoords) {
      this.placeMarker(lat!, lng!, { pan: false, reverse: false, emit: false });
    }

    this.mapReady.set(true);
    this.scheduleSizeRefresh();

    // Geolocate after the map exists. Edit mode without saved coords → center on user.
    if (this.mode() === 'edit') {
      this.requestUserLocation({ centerIfNoVenue: !hasCoords });
    }
  }

  private scheduleSizeRefresh(): void {
    const refresh = () => {
      this.map?.invalidateSize({ animate: false });
    };
    requestAnimationFrame(() => {
      refresh();
      requestAnimationFrame(refresh);
    });
    window.setTimeout(refresh, 100);
    window.setTimeout(refresh, 300);

    const host = this.mapHost()?.nativeElement;
    if (host) {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => refresh());
      this.resizeObserver.observe(host);
    }
  }

  private requestUserLocation(options: { centerIfNoVenue: boolean }): void {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!this.map) return;
        const { latitude, longitude } = position.coords;
        this.showUserLocation(latitude, longitude);
        if (options.centerIfNoVenue) {
          this.map.setView([latitude, longitude], USER_ZOOM, { animate: false });
          this.scheduleSizeRefresh();
        }
      },
      () => {
        // Denied / unavailable → keep Casablanca fallback, no blue dot.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }

  private showUserLocation(latitude: number, longitude: number): void {
    if (!this.map) return;

    if (this.userMarker) {
      this.userMarker.setLatLng([latitude, longitude]);
      return;
    }

    this.userMarker = L.marker([latitude, longitude], {
      interactive: false,
      keyboard: false,
      zIndexOffset: -200,
      icon: this.createUserLocationIcon()
    }).addTo(this.map);
  }

  private placeMarker(
    latitude: number,
    longitude: number,
    options: { pan: boolean; reverse: boolean; emit: boolean; zoom?: number }
  ): void {
    if (!this.map) return;

    if (this.marker) {
      this.marker.setLatLng([latitude, longitude]);
    } else {
      this.marker = L.marker([latitude, longitude], {
        draggable: this.mode() === 'edit',
        icon: this.createVenueIcon(),
        keyboard: this.mode() === 'edit',
        zIndexOffset: 600
      }).addTo(this.map);

      if (this.mode() === 'edit') {
        this.marker.on('dragend', () => {
          const position = this.marker?.getLatLng();
          if (!position) return;
          this.afterMarkerMoved(position.lat, position.lng, true);
        });
      }
    }

    if (options.pan) {
      this.map.setView([latitude, longitude], options.zoom ?? this.map.getZoom(), { animate: false });
    }

    if (options.emit) {
      this.afterMarkerMoved(latitude, longitude, options.reverse);
    } else if (options.reverse) {
      this.reverseGeocode(latitude, longitude);
    }
  }

  private afterMarkerMoved(latitude: number, longitude: number, reverse: boolean): void {
    this.skipNextExternalSync = true;
    this.coordinatesChange.emit({ latitude, longitude });
    if (reverse) {
      this.reverseGeocode(latitude, longitude);
    }
  }

  private reverseGeocode(latitude: number, longitude: number): void {
    const token = ++this.reverseToken;
    this.reverseBusy.set(true);
    this.nominatim.reverse(latitude, longitude).subscribe({
      next: (resolved) => {
        if (token !== this.reverseToken) return;
        this.reverseBusy.set(false);
        if (resolved) {
          this.searchQuery.set(resolved.address);
          this.addressChange.emit(resolved);
        }
      },
      error: () => {
        if (token !== this.reverseToken) return;
        this.reverseBusy.set(false);
      }
    });
  }

  private clearMarker(): void {
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
    }
    this.marker = null;
  }

  /** Google Maps–style blue “you are here” dot (informational only). */
  private createUserLocationIcon(): L.DivIcon {
    return L.divIcon({
      className: 'mb-map-user-marker',
      html: `
        <span class="mb-map-user-halo" aria-hidden="true"></span>
        <span class="mb-map-user-dot" aria-hidden="true"></span>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  }

  /** High-contrast brand teal venue pin (draggable picker). */
  private createVenueIcon(): L.DivIcon {
    return L.divIcon({
      className: 'mb-map-venue-marker',
      html: `
        <svg class="mb-map-venue-pin" viewBox="0 0 40 52" width="40" height="52" aria-hidden="true">
          <defs>
            <filter id="mbPinShadow" x="-30%" y="-10%" width="160%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#0f2e24" flood-opacity="0.45"/>
            </filter>
          </defs>
          <path
            filter="url(#mbPinShadow)"
            fill="#53b29a"
            stroke="#ffffff"
            stroke-width="2.5"
            d="M20 2C11.163 2 4 9.163 4 18c0 12.375 14.25 30.25 15.15 31.35a1.15 1.15 0 0 0 1.7 0C21.75 48.25 36 30.375 36 18 36 9.163 28.837 2 20 2z"
          />
          <circle cx="20" cy="18" r="6.5" fill="#ffffff"/>
          <circle cx="20" cy="18" r="3.25" fill="#2b8a72"/>
        </svg>
      `,
      iconSize: [40, 52],
      iconAnchor: [20, 50],
      popupAnchor: [0, -44]
    });
  }
}
