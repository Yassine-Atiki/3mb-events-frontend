import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of } from 'rxjs';

import { TicketService } from '../../core/api/ticket.service';

/**
 * Places vendues par événement = somme des quantitySold des types de billets.
 * Aligné avec les barres « Ventes par type » et le taux de remplissage des statistiques.
 */
@Injectable({ providedIn: 'root' })
export class OccupancyService {
  private readonly ticketService = inject(TicketService);

  forEvents(eventIds: string[]): Observable<Record<string, number>> {
    if (eventIds.length === 0) return of({});

    return forkJoin(
      eventIds.map((eventId) =>
        this.ticketService.getTicketTypesByEvent(eventId).pipe(
          map((types) => ({
            eventId,
            occupied: types.reduce((sum, type) => sum + type.quantitySold, 0)
          }))
        )
      )
    ).pipe(
      map((results) => {
        const record: Record<string, number> = {};
        results.forEach(({ eventId, occupied }) => (record[eventId] = occupied));
        return record;
      })
    );
  }
}
