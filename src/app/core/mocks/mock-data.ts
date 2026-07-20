import {
  AdminStats,
  AuditLogEntry,
  Category,
  ChartPoint,
  Event,
  EventStatus,
  OrganizerStats,
  PaymentIntent,
  RefundRequest,
  Registration,
  Ticket,
  TicketType,
  User,
  Venue
} from '../models';

export const MOCK_PASSWORD = 'Password123!';

export interface MockCredential {
  userId: string;
  email: string;
  password: string;
}

/** In-memory stand-in for the backend `refresh_tokens` table. */
export interface MockRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

const MONTH_LABELS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc'
];

const EVENT_COVER_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1508973379184-7517410fb0bc?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1544531585-9847b68c8c86?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80'
];

export const DEFAULT_COVER_IMAGE = EVENT_COVER_IMAGES[0];

let idSequence = 0;

export function generateId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}${idSequence.toString(36)}`;
}

function daysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export const mockUsers: User[] = [
  {
    id: 'usr-organizer',
    email: 'organizer@3mb.com',
    firstName: 'Youssef',
    lastName: 'Bennani',
    role: 'ORGANIZER',
    status: 'ACTIVE',
    organization: 'EventCorp Maroc',
    phone: '+212 6 22 33 44 55',
    avatarUrl: 'https://i.pravatar.cc/150?u=organizer@3mb.com',
    createdAt: daysAgo(400),
    lastLoginAt: daysAgo(0)
  },
  {
    id: 'usr-organizer-2',
    email: 'organizer2@3mb.com',
    firstName: 'Fatima Zahra',
    lastName: 'Idrissi',
    role: 'ORGANIZER',
    status: 'ACTIVE',
    organization: 'Atlas Events',
    phone: '+212 6 44 55 66 77',
    avatarUrl: 'https://i.pravatar.cc/150?u=organizer2@3mb.com',
    createdAt: daysAgo(300),
    lastLoginAt: daysAgo(3)
  },
  {
    id: 'usr-admin',
    email: 'admin@3mb.com',
    firstName: 'Amine',
    lastName: 'Tazi',
    role: 'ADMIN',
    status: 'ACTIVE',
    phone: '+212 6 99 88 77 66',
    avatarUrl: 'https://i.pravatar.cc/150?u=admin@3mb.com',
    createdAt: daysAgo(500),
    lastLoginAt: daysAgo(0)
  }
];

export const mockCredentials: MockCredential[] = mockUsers.map((user) => ({
  userId: user.id,
  email: user.email,
  password: MOCK_PASSWORD
}));

/** Persisted refresh-token rows (hashed). Cleared only by revoke / expiry checks. */
export const mockRefreshTokens: MockRefreshToken[] = [];

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export const mockCategories: Category[] = [
  {
    id: 'cat-conference',
    name: 'Conférence',
    slug: 'conference',
    icon: 'mic',
    description: 'Conférences et sommets professionnels'
  },
  {
    id: 'cat-formation',
    name: 'Formation',
    slug: 'formation',
    icon: 'graduation-cap',
    description: 'Formations et bootcamps'
  },
  {
    id: 'cat-atelier',
    name: 'Atelier',
    slug: 'atelier',
    icon: 'wrench',
    description: 'Ateliers pratiques et hands-on'
  },
  {
    id: 'cat-salon',
    name: 'Salon',
    slug: 'salon',
    icon: 'store',
    description: 'Salons et foires professionnelles'
  },
  {
    id: 'cat-soiree',
    name: 'Soirée',
    slug: 'soiree',
    icon: 'moon',
    description: 'Soirées, galas et concerts'
  },
  {
    id: 'cat-networking',
    name: 'Networking',
    slug: 'networking',
    icon: 'users',
    description: 'Rencontres et networking professionnel'
  },
  {
    id: 'cat-sport',
    name: 'Sport & Bien-être',
    slug: 'sport-bien-etre',
    icon: 'heart-pulse',
    description: 'Sport, santé et bien-être'
  }
];

/* -------------------------------------------------------------------------- */
/* Venues                                                                     */
/* -------------------------------------------------------------------------- */

export const mockVenues: Venue[] = [
  {
    id: 'venue-casa-palais',
    name: 'Palais des Congrès de Casablanca',
    address: "Route de l'Aéroport",
    city: 'Casablanca',
    postalCode: '20000',
    country: 'Maroc',
    latitude: 33.5731,
    longitude: -7.5898,
    capacity: 1200,
    description: 'Grand centre de congrès au cœur de Casablanca.'
  },
  {
    id: 'venue-casa-technopark',
    name: 'Technopark Casablanca',
    address: 'Route de Nouaceur',
    city: 'Casablanca',
    postalCode: '20250',
    country: 'Maroc',
    latitude: 33.5228,
    longitude: -7.6198,
    capacity: 300,
    description: "Hub d'innovation et d'entrepreneuriat."
  },
  {
    id: 'venue-rabat-villa-arts',
    name: 'Villa des Arts de Rabat',
    address: '10 Rue Beethoven',
    city: 'Rabat',
    postalCode: '10000',
    country: 'Maroc',
    latitude: 34.0128,
    longitude: -6.8319,
    capacity: 250,
    description: 'Espace culturel et artistique.'
  },
  {
    id: 'venue-rabat-sofitel',
    name: 'Sofitel Rabat Jardin des Roses',
    address: 'Souissi',
    city: 'Rabat',
    postalCode: '10100',
    country: 'Maroc',
    latitude: 33.9878,
    longitude: -6.8632,
    capacity: 500,
    description: 'Hôtel 5 étoiles avec salles de conférence.'
  },
  {
    id: 'venue-marrakech-palmeraie',
    name: 'Palmeraie Village Marrakech',
    address: 'Route de Fès',
    city: 'Marrakech',
    postalCode: '40000',
    country: 'Maroc',
    latitude: 31.6849,
    longitude: -7.9709,
    capacity: 800,
    description: 'Domaine évènementiel au cœur de la palmeraie.'
  },
  {
    id: 'venue-marrakech-palais-congres',
    name: 'Palais des Congrès Marrakech',
    address: 'Avenue Mohammed VI',
    city: 'Marrakech',
    postalCode: '40040',
    country: 'Maroc',
    latitude: 31.6295,
    longitude: -8.0089,
    capacity: 1500,
    description: 'Le plus grand centre de congrès du sud du Maroc.'
  },
  {
    id: 'venue-tanger-city-center',
    name: 'Tanger City Center',
    address: 'Avenue Mohammed VI',
    city: 'Tanger',
    postalCode: '90000',
    country: 'Maroc',
    latitude: 35.7595,
    longitude: -5.834,
    capacity: 400,
    description: 'Centre commercial et évènementiel moderne.'
  },
  {
    id: 'venue-fes-congress',
    name: 'Fès Congress Center',
    address: "Route d'Immouzer",
    city: 'Fès',
    postalCode: '30000',
    country: 'Maroc',
    latitude: 34.0331,
    longitude: -5.0003,
    capacity: 600,
    description: 'Centre de conférences au cœur de la ville impériale.'
  },
  {
    id: 'venue-agadir-founty',
    name: 'Founty Beach Resort',
    address: 'Secteur Founty',
    city: 'Agadir',
    postalCode: '80000',
    country: 'Maroc',
    latitude: 30.4062,
    longitude: -9.6303,
    capacity: 350,
    description: 'Resort en bord de mer pour évènements en plein air.'
  }
];

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

const GENERIC_DETAILS =
  "Rejoignez-nous pour une expérience enrichissante avec des intervenants de qualité, des sessions interactives et de nombreuses opportunités de networking. Places limitées, inscrivez-vous dès maintenant.";

interface EventSeed {
  title: string;
  shortDescription: string;
  categoryId: string;
  venueId: string;
  organizerId: string;
  organizerName: string;
  city: string;
  startInDays: number;
  startHour: number;
  durationHours: number;
  capacity: number;
  isFree: boolean;
  priceFrom?: number;
  status?: EventStatus;
  createdDaysAgo: number;
}

let eventCoverIndex = 0;

function mkEvent(seed: EventSeed): Event {
  const id = generateId('evt');
  const start = new Date();
  start.setDate(start.getDate() + seed.startInDays);
  start.setHours(seed.startHour, 0, 0, 0);
  const end = new Date(start.getTime() + seed.durationHours * 60 * 60 * 1000);
  const createdAt = daysAgo(seed.createdDaysAgo);
  const coverImageUrl = EVENT_COVER_IMAGES[eventCoverIndex % EVENT_COVER_IMAGES.length];
  eventCoverIndex += 1;

  return {
    id,
    slug: slugify(seed.title),
    title: seed.title,
    description: `${seed.shortDescription} ${GENERIC_DETAILS}`,
    shortDescription: seed.shortDescription,
    coverImageUrl,
    status: seed.status ?? 'PUBLIE',
    categoryId: seed.categoryId,
    venueId: seed.venueId,
    organizerId: seed.organizerId,
    organizerName: seed.organizerName,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    city: seed.city,
    capacity: seed.capacity,
    visibility: 'PUBLIC',
    priceFrom: seed.isFree ? 0 : (seed.priceFrom ?? 0),
    isFree: seed.isFree,
    createdAt,
    updatedAt: createdAt
  };
}

const ORGANIZER_1 = { id: 'usr-organizer', name: 'Youssef Bennani' };
const ORGANIZER_2 = { id: 'usr-organizer-2', name: 'Fatima Zahra Idrissi' };

export const mockEvents: Event[] = [
  mkEvent({
    title: 'Conférence Intelligence Artificielle & Data 2026',
    shortDescription:
      "Les experts IA et data du Maroc se réunissent pour deux jours de conférences et démos.",
    categoryId: 'cat-conference',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 21,
    startHour: 9,
    durationHours: 9,
    capacity: 600,
    isFree: false,
    priceFrom: 450,
    createdDaysAgo: 50
  }),
  mkEvent({
    title: "Salon de l'Entrepreneuriat Marocain",
    shortDescription:
      'Le rendez-vous annuel des entrepreneurs, investisseurs et startups marocaines.',
    categoryId: 'cat-salon',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 35,
    startHour: 10,
    durationHours: 8,
    capacity: 1000,
    isFree: true,
    createdDaysAgo: 45
  }),
  mkEvent({
    title: 'Formation Marketing Digital Avancé',
    shortDescription: 'Formation intensive de 2 jours sur les stratégies marketing digital.',
    categoryId: 'cat-formation',
    venueId: 'venue-casa-technopark',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Casablanca',
    startInDays: 14,
    startHour: 9,
    durationHours: 16,
    capacity: 80,
    isFree: false,
    priceFrom: 1200,
    createdDaysAgo: 30
  }),
  mkEvent({
    title: 'Atelier Design UX/UI pour Débutants',
    shortDescription: "Un atelier pratique pour apprendre les bases du design d'interface.",
    categoryId: 'cat-atelier',
    venueId: 'venue-rabat-villa-arts',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Rabat',
    startInDays: 10,
    startHour: 14,
    durationHours: 6,
    capacity: 40,
    isFree: false,
    priceFrom: 350,
    createdDaysAgo: 20
  }),
  mkEvent({
    title: 'Soirée Networking Tech & Startups',
    shortDescription: "Une soirée conviviale pour rencontrer l'écosystème tech casablancais.",
    categoryId: 'cat-networking',
    venueId: 'venue-casa-technopark',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 7,
    startHour: 19,
    durationHours: 3,
    capacity: 150,
    isFree: true,
    createdDaysAgo: 15
  }),
  mkEvent({
    title: 'Forum Emploi Jeunes Diplômés',
    shortDescription: 'Rencontrez des recruteurs et décrochez votre prochain emploi.',
    categoryId: 'cat-salon',
    venueId: 'venue-rabat-sofitel',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Rabat',
    startInDays: 28,
    startHour: 9,
    durationHours: 7,
    capacity: 500,
    isFree: true,
    createdDaysAgo: 40
  }),
  mkEvent({
    title: 'Conférence Cybersécurité au Maroc',
    shortDescription:
      'Panorama des menaces et solutions de cybersécurité pour les entreprises marocaines.',
    categoryId: 'cat-conference',
    venueId: 'venue-rabat-sofitel',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Rabat',
    startInDays: 45,
    startHour: 9,
    durationHours: 8,
    capacity: 300,
    isFree: false,
    priceFrom: 600,
    createdDaysAgo: 35
  }),
  mkEvent({
    title: 'Bootcamp Développement Web Full-Stack',
    shortDescription:
      'Cinq jours intensifs pour maîtriser Angular, Node.js et les bases de données.',
    categoryId: 'cat-formation',
    venueId: 'venue-casa-technopark',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 40,
    startHour: 9,
    durationHours: 40,
    capacity: 60,
    isFree: false,
    priceFrom: 3500,
    createdDaysAgo: 60
  }),
  mkEvent({
    title: 'Atelier Photographie Culinaire',
    shortDescription: 'Apprenez à sublimer vos plats en photo avec des professionnels.',
    categoryId: 'cat-atelier',
    venueId: 'venue-marrakech-palmeraie',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Marrakech',
    startInDays: 25,
    startHour: 11,
    durationHours: 5,
    capacity: 30,
    isFree: false,
    priceFrom: 400,
    createdDaysAgo: 18
  }),
  mkEvent({
    title: 'Gala de Charité "Cœurs Solidaires"',
    shortDescription: "Une soirée de gala au profit d'associations locales.",
    categoryId: 'cat-soiree',
    venueId: 'venue-marrakech-palais-congres',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Marrakech',
    startInDays: 60,
    startHour: 20,
    durationHours: 5,
    capacity: 400,
    isFree: false,
    priceFrom: 800,
    createdDaysAgo: 55
  }),
  mkEvent({
    title: 'Networking Afterwork Entrepreneurs du Nord',
    shortDescription: 'Rencontre informelle entre entrepreneurs de la région de Tanger.',
    categoryId: 'cat-networking',
    venueId: 'venue-tanger-city-center',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Tanger',
    startInDays: 12,
    startHour: 18,
    durationHours: 3,
    capacity: 120,
    isFree: true,
    createdDaysAgo: 10
  }),
  mkEvent({
    title: 'Conférence Transformation Digitale des PME',
    shortDescription: 'Comment digitaliser son entreprise pour rester compétitif.',
    categoryId: 'cat-conference',
    venueId: 'venue-fes-congress',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Fès',
    startInDays: 50,
    startHour: 9,
    durationHours: 7,
    capacity: 250,
    isFree: false,
    priceFrom: 500,
    createdDaysAgo: 42
  }),
  mkEvent({
    title: 'Salon du Tourisme et Voyage',
    shortDescription: 'Découvrez les meilleures destinations et offres de voyage.',
    categoryId: 'cat-salon',
    venueId: 'venue-agadir-founty',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Agadir',
    startInDays: 33,
    startHour: 10,
    durationHours: 8,
    capacity: 350,
    isFree: true,
    createdDaysAgo: 28
  }),
  mkEvent({
    title: 'Formation Gestion de Projet Agile & Scrum',
    shortDescription: 'Certification et bonnes pratiques Agile/Scrum pour chefs de projet.',
    categoryId: 'cat-formation',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 17,
    startHour: 9,
    durationHours: 16,
    capacity: 100,
    isFree: false,
    priceFrom: 2200,
    createdDaysAgo: 22
  }),
  mkEvent({
    title: 'Atelier Yoga & Bien-être en Plein Air',
    shortDescription: "Une matinée de yoga et méditation face à l'océan.",
    categoryId: 'cat-sport',
    venueId: 'venue-agadir-founty',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Agadir',
    startInDays: 9,
    startHour: 8,
    durationHours: 3,
    capacity: 50,
    isFree: false,
    priceFrom: 150,
    createdDaysAgo: 12
  }),
  mkEvent({
    title: 'Soirée Jazz sous les Étoiles',
    shortDescription: 'Concert de jazz en plein air dans un cadre exceptionnel.',
    categoryId: 'cat-soiree',
    venueId: 'venue-marrakech-palmeraie',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Marrakech',
    startInDays: 55,
    startHour: 20,
    durationHours: 4,
    capacity: 300,
    isFree: false,
    priceFrom: 300,
    createdDaysAgo: 33
  }),
  mkEvent({
    title: 'Conférence Femmes Leaders du Maroc',
    shortDescription: "Un forum dédié au leadership féminin et à l'inclusion.",
    categoryId: 'cat-conference',
    venueId: 'venue-rabat-villa-arts',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Rabat',
    startInDays: 42,
    startHour: 9,
    durationHours: 7,
    capacity: 350,
    isFree: true,
    createdDaysAgo: 38
  }),
  mkEvent({
    title: 'Hackathon National Innovation Verte',
    shortDescription: '48 heures pour créer des solutions technologiques pour l\'environnement.',
    categoryId: 'cat-atelier',
    venueId: 'venue-tanger-city-center',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Tanger',
    startInDays: 65,
    startHour: 9,
    durationHours: 48,
    capacity: 150,
    isFree: true,
    createdDaysAgo: 48
  }),
  mkEvent({
    title: "Salon de l'Auto Casablanca",
    shortDescription: 'Les dernières nouveautés automobiles exposées à Casablanca.',
    categoryId: 'cat-salon',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Casablanca',
    startInDays: 70,
    startHour: 10,
    durationHours: 9,
    capacity: 1200,
    isFree: false,
    priceFrom: 100,
    createdDaysAgo: 52
  }),
  mkEvent({
    title: 'Meetup Développeurs JavaScript Maroc',
    shortDescription: 'Rencontre mensuelle de la communauté JavaScript du Maroc.',
    categoryId: 'cat-networking',
    venueId: 'venue-casa-technopark',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 5,
    startHour: 18,
    durationHours: 3,
    capacity: 100,
    isFree: true,
    createdDaysAgo: 8
  }),
  mkEvent({
    title: 'Conférence Blockchain & Web3 Casablanca',
    shortDescription:
      "Retour sur l'édition passée dédiée à la blockchain et au web3.",
    categoryId: 'cat-conference',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: -40,
    startHour: 9,
    durationHours: 8,
    capacity: 400,
    isFree: false,
    priceFrom: 500,
    createdDaysAgo: 90
  }),
  mkEvent({
    title: 'Formation Excel Avancé pour Managers',
    shortDescription: "Formation passée sur les fonctions avancées d'Excel.",
    categoryId: 'cat-formation',
    venueId: 'venue-rabat-sofitel',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Rabat',
    startInDays: -25,
    startHour: 9,
    durationHours: 8,
    capacity: 60,
    isFree: false,
    priceFrom: 900,
    createdDaysAgo: 70
  }),
  mkEvent({
    title: 'Salon Digital Marrakech Édition Passée',
    shortDescription: 'Salon dédié aux métiers du digital et de la tech.',
    categoryId: 'cat-salon',
    venueId: 'venue-marrakech-palais-congres',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Marrakech',
    startInDays: -60,
    startHour: 9,
    durationHours: 7,
    capacity: 700,
    isFree: true,
    createdDaysAgo: 110
  }),
  mkEvent({
    title: 'Conférence Santé & Innovation Médicale',
    shortDescription: 'Innovations en santé au Maroc — édition en préparation.',
    categoryId: 'cat-conference',
    venueId: 'venue-casa-palais',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Casablanca',
    startInDays: 80,
    startHour: 9,
    durationHours: 8,
    capacity: 300,
    isFree: false,
    priceFrom: 550,
    status: 'BROUILLON',
    createdDaysAgo: 5
  }),
  mkEvent({
    title: 'Atelier Cuisine Marocaine Traditionnelle',
    shortDescription: 'Atelier culinaire authentique — en cours de révision.',
    categoryId: 'cat-atelier',
    venueId: 'venue-fes-congress',
    organizerId: ORGANIZER_2.id,
    organizerName: ORGANIZER_2.name,
    city: 'Fès',
    startInDays: 30,
    startHour: 11,
    durationHours: 4,
    capacity: 25,
    isFree: false,
    priceFrom: 300,
    status: 'EN_REVISION',
    createdDaysAgo: 6
  }),
  mkEvent({
    title: 'Festival Musique Électronique Désert',
    shortDescription: 'Événement annulé suite à des contraintes logistiques.',
    categoryId: 'cat-soiree',
    venueId: 'venue-marrakech-palmeraie',
    organizerId: ORGANIZER_1.id,
    organizerName: ORGANIZER_1.name,
    city: 'Marrakech',
    startInDays: 20,
    startHour: 18,
    durationHours: 10,
    capacity: 2000,
    isFree: false,
    priceFrom: 700,
    status: 'ANNULE',
    createdDaysAgo: 65
  })
];

const [
  EVT_IA,
  EVT_SALON_ENTREPRENEURIAT,
  EVT_FORMATION_MARKETING,
  EVT_ATELIER_UXUI,
  EVT_NETWORKING_TECH,
  ,
  ,
  ,
  EVT_ATELIER_PHOTO,
  EVT_GALA,
  ,
  ,
  ,
  EVT_FORMATION_AGILE,
  ,
  EVT_SOIREE_JAZZ,
  ,
  ,
  EVT_SALON_AUTO,
  ,
  EVT_BLOCKCHAIN,
  ,
  ,
  ,
  ,
  EVT_FESTIVAL_ANNULE
] = mockEvents;

EVT_IA.publicRegistrationEnabled = true;
EVT_IA.publicRegistrationToken = 'demo-public-reg-token';

/* -------------------------------------------------------------------------- */
/* Ticket types                                                               */
/* -------------------------------------------------------------------------- */

function mkTicketTypes(event: Event): TicketType[] {
  if (event.isFree) {
    return [
      {
        id: `${event.id}-tt-1`,
        eventId: event.id,
        name: 'Billet Gratuit',
        kind: 'GRATUIT',
        price: 0,
        currency: 'MAD',
        quantityTotal: event.capacity,
        quantitySold: Math.round(event.capacity * 0.35),
        maxPerOrder: 6,
        description: "Accès gratuit à l'événement."
      }
    ];
  }

  const base = event.priceFrom || 200;
  return [
    {
      id: `${event.id}-tt-1`,
      eventId: event.id,
      name: 'Standard',
      kind: 'STANDARD',
      price: base,
      currency: 'MAD',
      quantityTotal: Math.round(event.capacity * 0.6),
      quantitySold: Math.round(event.capacity * 0.6 * 0.5),
      maxPerOrder: 5,
      description: "Accès standard à l'événement."
    },
    {
      id: `${event.id}-tt-2`,
      eventId: event.id,
      name: 'VIP',
      kind: 'VIP',
      price: Math.round(base * 2.2),
      currency: 'MAD',
      quantityTotal: Math.round(event.capacity * 0.15),
      quantitySold: Math.round(event.capacity * 0.15 * 0.3),
      maxPerOrder: 4,
      description: 'Accès VIP avec avantages exclusifs.'
    },
    {
      id: `${event.id}-tt-3`,
      eventId: event.id,
      name: 'Early Bird',
      kind: 'EARLY_BIRD',
      price: Math.round(base * 0.7),
      currency: 'MAD',
      quantityTotal: Math.round(event.capacity * 0.25),
      quantitySold: Math.round(event.capacity * 0.25 * 0.8),
      maxPerOrder: 3,
      description: 'Tarif réduit pour les premières inscriptions.'
    }
  ];
}

export const mockTicketTypes: TicketType[] = mockEvents.flatMap(mkTicketTypes);

/* -------------------------------------------------------------------------- */
/* Registrations                                                              */
/* -------------------------------------------------------------------------- */

export const mockRegistrations: Registration[] = [
  {
    id: 'reg-1',
    eventId: EVT_IA.id,
    ticketTypeId: `${EVT_IA.id}-tt-1`,
    status: 'CONFIRMED',
    quantity: 2,
    totalPrice: EVT_IA.priceFrom * 2,
    currency: 'MAD',
    participantFirstName: 'Sara',
    participantLastName: 'El Amrani',
    participantEmail: 'participant@3mb.com',
    participantPhone: '+212 6 12 34 56 78',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12)
  },
  {
    id: 'reg-2',
    eventId: EVT_NETWORKING_TECH.id,
    ticketTypeId: `${EVT_NETWORKING_TECH.id}-tt-1`,
    status: 'CONFIRMED',
    quantity: 1,
    totalPrice: 0,
    currency: 'MAD',
    participantFirstName: 'Mehdi',
    participantLastName: 'Alaoui',
    participantEmail: 'mehdi.alaoui@example.com',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4)
  },
  {
    id: 'reg-3',
    eventId: EVT_FORMATION_AGILE.id,
    ticketTypeId: `${EVT_FORMATION_AGILE.id}-tt-3`,
    status: 'PENDING',
    quantity: 1,
    totalPrice: Math.round(EVT_FORMATION_AGILE.priceFrom * 0.7),
    currency: 'MAD',
    participantFirstName: 'Sara',
    participantLastName: 'El Amrani',
    participantEmail: 'participant@3mb.com',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1)
  },
  {
    id: 'reg-4',
    eventId: EVT_BLOCKCHAIN.id,
    ticketTypeId: `${EVT_BLOCKCHAIN.id}-tt-1`,
    status: 'ATTENDED',
    quantity: 1,
    totalPrice: EVT_BLOCKCHAIN.priceFrom,
    currency: 'MAD',
    participantFirstName: 'Laila',
    participantLastName: 'Fassi',
    participantEmail: 'laila.fassi@example.com',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(40),
    checkedInAt: daysAgo(40)
  },
  {
    id: 'reg-5',
    eventId: EVT_ATELIER_PHOTO.id,
    ticketTypeId: `${EVT_ATELIER_PHOTO.id}-tt-1`,
    status: 'CANCELLED',
    quantity: 1,
    totalPrice: EVT_ATELIER_PHOTO.priceFrom,
    currency: 'MAD',
    participantFirstName: 'Hamza',
    participantLastName: 'Berrada',
    participantEmail: 'hamza.berrada@example.com',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(2)
  },
  {
    id: 'reg-6',
    eventId: EVT_SOIREE_JAZZ.id,
    ticketTypeId: `${EVT_SOIREE_JAZZ.id}-tt-2`,
    status: 'REFUNDED',
    quantity: 1,
    totalPrice: Math.round(EVT_SOIREE_JAZZ.priceFrom * 2.2),
    currency: 'MAD',
    participantFirstName: 'Nadia',
    participantLastName: 'Zerouali',
    participantEmail: 'nadia.zerouali@example.com',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5)
  },
  {
    id: 'reg-7',
    eventId: EVT_SALON_AUTO.id,
    ticketTypeId: `${EVT_SALON_AUTO.id}-tt-1`,
    status: 'WAITLIST',
    quantity: 3,
    totalPrice: EVT_SALON_AUTO.priceFrom * 3,
    currency: 'MAD',
    participantFirstName: 'Sara',
    participantLastName: 'El Amrani',
    participantEmail: 'participant@3mb.com',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: 'reg-8',
    eventId: EVT_IA.id,
    ticketTypeId: `${EVT_IA.id}-tt-2`,
    status: 'CONFIRMED',
    quantity: 1,
    totalPrice: Math.round(EVT_IA.priceFrom * 2.2),
    currency: 'MAD',
    participantFirstName: 'Omar',
    participantLastName: 'Taleb',
    participantEmail: 'omar.taleb@example.com',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
  },
  {
    id: 'reg-9',
    eventId: EVT_NETWORKING_TECH.id,
    ticketTypeId: `${EVT_NETWORKING_TECH.id}-tt-1`,
    status: 'CONFIRMED',
    quantity: 1,
    totalPrice: 0,
    currency: 'MAD',
    participantFirstName: 'Ines',
    participantLastName: 'Chraibi',
    participantEmail: 'ines.chraibi@example.com',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3)
  },
  {
    id: 'reg-10',
    eventId: EVT_GALA.id,
    ticketTypeId: `${EVT_GALA.id}-tt-1`,
    status: 'CANCELLED',
    quantity: 1,
    totalPrice: EVT_GALA.priceFrom,
    currency: 'MAD',
    participantFirstName: 'Karim',
    participantLastName: 'Mouline',
    participantEmail: 'karim.mouline@example.com',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(6)
  }
];

/* -------------------------------------------------------------------------- */
/* Tickets                                                                    */
/* -------------------------------------------------------------------------- */

export const mockTickets: Ticket[] = [
  {
    id: 'tkt-1',
    ticketTypeId: `${EVT_IA.id}-tt-1`,
    registrationId: 'reg-1',
    eventId: EVT_IA.id,
    accessToken: 'tkt-access-reg1-1',
    participantFirstName: 'Sara',
    participantLastName: 'El Amrani',
    participantEmail: 'participant@3mb.com',
    status: 'VALID',
    qrCode: `QR-${EVT_IA.id}-REG1-1-A1B2C3`,
    issuedAt: daysAgo(12)
  },
  {
    id: 'tkt-2',
    ticketTypeId: `${EVT_IA.id}-tt-1`,
    registrationId: 'reg-1',
    eventId: EVT_IA.id,
    accessToken: 'tkt-access-reg1-2',
    participantFirstName: 'Sara',
    participantLastName: 'El Amrani',
    participantEmail: 'participant@3mb.com',
    status: 'VALID',
    qrCode: `QR-${EVT_IA.id}-REG1-2-D4E5F6`,
    issuedAt: daysAgo(12)
  },
  {
    id: 'tkt-3',
    ticketTypeId: `${EVT_NETWORKING_TECH.id}-tt-1`,
    registrationId: 'reg-2',
    eventId: EVT_NETWORKING_TECH.id,
    accessToken: 'tkt-access-reg2-1',
    participantFirstName: 'Mehdi',
    participantLastName: 'Alaoui',
    participantEmail: 'mehdi.alaoui@example.com',
    status: 'VALID',
    qrCode: `QR-${EVT_NETWORKING_TECH.id}-REG2-1-G7H8I9`,
    issuedAt: daysAgo(4)
  },
  {
    id: 'tkt-4',
    ticketTypeId: `${EVT_BLOCKCHAIN.id}-tt-1`,
    registrationId: 'reg-4',
    eventId: EVT_BLOCKCHAIN.id,
    accessToken: 'tkt-access-reg4-1',
    participantFirstName: 'Laila',
    participantLastName: 'Fassi',
    participantEmail: 'laila.fassi@example.com',
    status: 'USED',
    qrCode: `QR-${EVT_BLOCKCHAIN.id}-REG4-1-J1K2L3`,
    issuedAt: daysAgo(45),
    usedAt: daysAgo(40)
  },
  {
    id: 'tkt-5',
    ticketTypeId: `${EVT_ATELIER_PHOTO.id}-tt-1`,
    registrationId: 'reg-5',
    eventId: EVT_ATELIER_PHOTO.id,
    accessToken: 'tkt-access-reg5-1',
    participantFirstName: 'Hamza',
    participantLastName: 'Berrada',
    participantEmail: 'hamza.berrada@example.com',
    status: 'CANCELLED',
    qrCode: `QR-${EVT_ATELIER_PHOTO.id}-REG5-1-M4N5O6`,
    issuedAt: daysAgo(8)
  },
  {
    id: 'tkt-6',
    ticketTypeId: `${EVT_SOIREE_JAZZ.id}-tt-2`,
    registrationId: 'reg-6',
    eventId: EVT_SOIREE_JAZZ.id,
    accessToken: 'tkt-access-reg6-1',
    participantFirstName: 'Nadia',
    participantLastName: 'Zerouali',
    participantEmail: 'nadia.zerouali@example.com',
    status: 'REFUNDED',
    qrCode: `QR-${EVT_SOIREE_JAZZ.id}-REG6-1-P7Q8R9`,
    issuedAt: daysAgo(20)
  },
  {
    id: 'tkt-7',
    ticketTypeId: `${EVT_IA.id}-tt-2`,
    registrationId: 'reg-8',
    eventId: EVT_IA.id,
    accessToken: 'tkt-access-reg8-1',
    participantFirstName: 'Omar',
    participantLastName: 'Taleb',
    participantEmail: 'omar.taleb@example.com',
    status: 'VALID',
    qrCode: `QR-${EVT_IA.id}-REG8-1-S1T2U3`,
    issuedAt: daysAgo(10)
  },
  {
    id: 'tkt-8',
    ticketTypeId: `${EVT_NETWORKING_TECH.id}-tt-1`,
    registrationId: 'reg-9',
    eventId: EVT_NETWORKING_TECH.id,
    accessToken: 'tkt-access-reg9-1',
    participantFirstName: 'Ines',
    participantLastName: 'Chraibi',
    participantEmail: 'ines.chraibi@example.com',
    status: 'VALID',
    qrCode: `QR-${EVT_NETWORKING_TECH.id}-REG9-1-V4W5X6`,
    issuedAt: daysAgo(3)
  }
];

/* -------------------------------------------------------------------------- */
/* Payment intents                                                            */
/* -------------------------------------------------------------------------- */

export const mockPaymentIntents: PaymentIntent[] = [
  {
    id: 'pi-1',
    registrationId: 'reg-1',
    amount: EVT_IA.priceFrom * 2,
    currency: 'MAD',
    status: 'SUCCEEDED',
    clientSecret: 'mock_secret_pi-1',
    createdAt: daysAgo(12)
  },
  {
    id: 'pi-2',
    registrationId: 'reg-8',
    amount: Math.round(EVT_IA.priceFrom * 2.2),
    currency: 'MAD',
    status: 'SUCCEEDED',
    clientSecret: 'mock_secret_pi-2',
    createdAt: daysAgo(10)
  }
];

/* -------------------------------------------------------------------------- */
/* Refund requests                                                            */
/* -------------------------------------------------------------------------- */

export const mockRefunds: RefundRequest[] = [
  {
    id: 'refund-1',
    registrationId: 'reg-6',
    participantFirstName: 'Nadia',
    participantLastName: 'Zerouali',
    participantEmail: 'nadia.zerouali@example.com',
    eventId: EVT_SOIREE_JAZZ.id,
    amount: Math.round(EVT_SOIREE_JAZZ.priceFrom * 2.2),
    currency: 'MAD',
    reason: 'Empêchement de dernière minute.',
    status: 'PROCESSED',
    requestedAt: daysAgo(6),
    processedAt: daysAgo(5),
    adminNote: 'Remboursement traité suite à demande justifiée.'
  },
  {
    id: 'refund-2',
    registrationId: 'reg-5',
    participantFirstName: 'Hamza',
    participantLastName: 'Berrada',
    participantEmail: 'hamza.berrada@example.com',
    eventId: EVT_ATELIER_PHOTO.id,
    amount: EVT_ATELIER_PHOTO.priceFrom,
    currency: 'MAD',
    reason: "Conflit d'agenda.",
    status: 'REQUESTED',
    requestedAt: daysAgo(2)
  },
  {
    id: 'refund-3',
    registrationId: 'reg-10',
    participantFirstName: 'Karim',
    participantLastName: 'Mouline',
    participantEmail: 'karim.mouline@example.com',
    eventId: EVT_GALA.id,
    amount: EVT_GALA.priceFrom,
    currency: 'MAD',
    reason: 'Changement de programme.',
    status: 'REJECTED',
    requestedAt: daysAgo(14),
    processedAt: daysAgo(12),
    adminNote: 'Délai de remboursement dépassé.'
  }
];

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-1',
    actorUserId: 'usr-admin',
    actorName: 'Amine Tazi',
    action: 'USER_SUSPENDED',
    targetType: 'User',
    targetId: 'usr-organizer-2',
    metadata: { reason: 'Vérification de documents en attente.' },
    createdAt: daysAgo(60)
  },
  {
    id: 'audit-2',
    actorUserId: 'usr-admin',
    actorName: 'Amine Tazi',
    action: 'USER_REACTIVATED',
    targetType: 'User',
    targetId: 'usr-organizer-2',
    createdAt: daysAgo(58)
  },
  {
    id: 'audit-3',
    actorUserId: 'usr-organizer',
    actorName: 'Youssef Bennani',
    action: 'EVENT_PUBLISHED',
    targetType: 'Event',
    targetId: EVT_IA.id,
    createdAt: daysAgo(50)
  },
  {
    id: 'audit-4',
    actorUserId: 'usr-admin',
    actorName: 'Amine Tazi',
    action: 'REFUND_PROCESSED',
    targetType: 'RefundRequest',
    targetId: 'refund-1',
    createdAt: daysAgo(5)
  },
  {
    id: 'audit-5',
    actorUserId: 'usr-admin',
    actorName: 'Amine Tazi',
    action: 'REFUND_REJECTED',
    targetType: 'RefundRequest',
    targetId: 'refund-3',
    createdAt: daysAgo(12)
  },
  {
    id: 'audit-6',
    actorUserId: 'usr-organizer',
    actorName: 'Youssef Bennani',
    action: 'EVENT_CANCELLED',
    targetType: 'Event',
    targetId: EVT_FESTIVAL_ANNULE.id,
    metadata: { reason: 'Contraintes logistiques.' },
    createdAt: daysAgo(3)
  }
];

/* -------------------------------------------------------------------------- */
/* Lookup helpers                                                             */
/* -------------------------------------------------------------------------- */

export function findUserById(id: string): User | undefined {
  return mockUsers.find((user) => user.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  return mockUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findCredentialByEmail(email: string): MockCredential | undefined {
  return mockCredentials.find((credential) => credential.email.toLowerCase() === email.toLowerCase());
}

export function findCredentialByUserId(userId: string): MockCredential | undefined {
  return mockCredentials.find((credential) => credential.userId === userId);
}

export function findEventById(id: string): Event | undefined {
  return mockEvents.find((event) => event.id === id);
}

export function findEventBySlug(slug: string): Event | undefined {
  return mockEvents.find((event) => event.slug === slug);
}

export function findCategoryById(id: string): Category | undefined {
  return mockCategories.find((category) => category.id === id);
}

export function findVenueById(id: string): Venue | undefined {
  return mockVenues.find((venue) => venue.id === id);
}

export function findTicketTypeById(id: string): TicketType | undefined {
  return mockTicketTypes.find((ticketType) => ticketType.id === id);
}

export function findRegistrationById(id: string): Registration | undefined {
  return mockRegistrations.find((registration) => registration.id === id);
}

export function findTicketById(id: string): Ticket | undefined {
  return mockTickets.find((ticket) => ticket.id === id);
}

export function findTicketByQrCode(qrCode: string): Ticket | undefined {
  return mockTickets.find((ticket) => ticket.qrCode === qrCode);
}

export function findRefundById(id: string): RefundRequest | undefined {
  return mockRefunds.find((refund) => refund.id === id);
}

export function getCategoriesWithCounts(): Category[] {
  return mockCategories.map((category) => ({
    ...category,
    eventCount: mockEvents.filter(
      (event) => event.categoryId === category.id && event.status === 'PUBLIE'
    ).length
  }));
}

export function createTicketsForRegistration(registration: Registration): Ticket[] {
  const now = new Date().toISOString();
  const tickets: Ticket[] = Array.from({ length: registration.quantity }, (_, index) => ({
    id: generateId('tkt'),
    ticketTypeId: registration.ticketTypeId,
    registrationId: registration.id,
    eventId: registration.eventId,
    accessToken: `tok-${registration.id}`,
    participantFirstName: registration.participantFirstName,
    participantLastName: registration.participantLastName,
    participantEmail: registration.participantEmail,
    status: 'VALID',
    qrCode: `QR-${registration.eventId}-${registration.id}-${index + 1}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`,
    issuedAt: now
  }));
  mockTickets.push(...tickets);
  return tickets;
}

/* -------------------------------------------------------------------------- */
/* Stats aggregates (computed on demand to stay consistent with live data)    */
/* -------------------------------------------------------------------------- */

function monthKeyOf(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function last6Months(): { key: string; label: string }[] {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTH_LABELS_FR[date.getMonth()] });
  }
  return months;
}

function buildChartOverTime(items: { createdAt: string; value: number }[]): ChartPoint[] {
  const months = last6Months();
  return months.map(({ key, label }) => ({
    label,
    value: items
      .filter((item) => monthKeyOf(item.createdAt) === key)
      .reduce((sum, item) => sum + item.value, 0)
  }));
}

function activeRegistrationsFor(eventIds: Set<string>): Registration[] {
  return mockRegistrations.filter(
    (registration) => eventIds.has(registration.eventId) && registration.status !== 'CANCELLED'
  );
}

export function computeOrganizerStats(organizerId: string): OrganizerStats {
  const events = mockEvents.filter((event) => event.organizerId === organizerId);
  const eventIds = new Set(events.map((event) => event.id));
  const registrations = activeRegistrationsFor(eventIds);

  const totalRegistrations = registrations.reduce((sum, reg) => sum + reg.quantity, 0);
  const totalRevenue = registrations.reduce((sum, reg) => sum + reg.totalPrice, 0);
  const totalTicketsSold = mockTicketTypes
    .filter((ticketType) => eventIds.has(ticketType.eventId))
    .reduce((sum, ticketType) => sum + ticketType.quantitySold, 0);

  const registrationsOverTime = buildChartOverTime(
    registrations.map((reg) => ({ createdAt: reg.createdAt, value: reg.quantity }))
  );
  const revenueOverTime = buildChartOverTime(
    registrations.map((reg) => ({ createdAt: reg.createdAt, value: reg.totalPrice }))
  );

  const topEvents = events
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      registrations: registrations
        .filter((reg) => reg.eventId === event.id)
        .reduce((sum, reg) => sum + reg.quantity, 0)
    }))
    .sort((a, b) => b.registrations - a.registrations)
    .slice(0, 5);

  return {
    totalEvents: events.length,
    totalRegistrations,
    totalRevenue,
    totalTicketsSold,
    registrationsOverTime,
    revenueOverTime,
    topEvents
  };
}

export function computeEventStats(eventId: string): OrganizerStats {
  const event = findEventById(eventId);
  const eventIds = new Set(event ? [event.id] : []);
  const registrations = activeRegistrationsFor(eventIds);

  return {
    totalEvents: event ? 1 : 0,
    totalRegistrations: registrations.reduce((sum, reg) => sum + reg.quantity, 0),
    totalRevenue: registrations.reduce((sum, reg) => sum + reg.totalPrice, 0),
    totalTicketsSold: mockTicketTypes
      .filter((ticketType) => eventIds.has(ticketType.eventId))
      .reduce((sum, ticketType) => sum + ticketType.quantitySold, 0),
    registrationsOverTime: buildChartOverTime(
      registrations.map((reg) => ({ createdAt: reg.createdAt, value: reg.quantity }))
    ),
    revenueOverTime: buildChartOverTime(
      registrations.map((reg) => ({ createdAt: reg.createdAt, value: reg.totalPrice }))
    ),
    topEvents: event
      ? [
          {
            eventId: event.id,
            title: event.title,
            registrations: registrations.reduce((sum, reg) => sum + reg.quantity, 0)
          }
        ]
      : []
  };
}

export function computeAdminStats(): AdminStats {
  const totalUsers = mockUsers.length;
  const totalOrganizers = mockUsers.filter((user) => user.role === 'ORGANIZER').length;
  const totalEvents = mockEvents.length;
  const totalRevenue = mockRegistrations
    .filter((registration) => registration.status !== 'CANCELLED')
    .reduce((sum, registration) => sum + registration.totalPrice, 0);

  const usersOverTime = buildChartOverTime(
    mockUsers.map((user) => ({ createdAt: user.createdAt, value: 1 }))
  );

  const eventsByCategory: ChartPoint[] = mockCategories.map((category) => ({
    label: category.name,
    value: mockEvents.filter((event) => event.categoryId === category.id).length
  }));

  const statuses: EventStatus[] = ['BROUILLON', 'EN_REVISION', 'PUBLIE', 'COMPLET', 'ANNULE', 'ARCHIVE'];
  const eventsByStatus: ChartPoint[] = statuses.map((status) => ({
    label: status,
    value: mockEvents.filter((event) => event.status === status).length
  }));

  return {
    totalUsers,
    totalOrganizers,
    totalEvents,
    totalRevenue,
    usersOverTime,
    eventsByCategory,
    eventsByStatus
  };
}
