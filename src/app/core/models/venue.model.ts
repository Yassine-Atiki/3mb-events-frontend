export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  description?: string;
}
