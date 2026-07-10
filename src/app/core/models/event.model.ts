export type EventStatus =
  | 'BROUILLON'
  | 'EN_REVISION'
  | 'PUBLIE'
  | 'COMPLET'
  | 'ANNULE'
  | 'ARCHIVE';

export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  coverImageUrl: string;
  status: EventStatus;
  categoryId: string;
  venueId: string;
  organizerId: string;
  organizerName: string;
  startAt: string;
  endAt: string;
  city: string;
  capacity: number;
  visibility: EventVisibility;
  priceFrom: number;
  isFree: boolean;
  createdAt: string;
  updatedAt: string;
}
