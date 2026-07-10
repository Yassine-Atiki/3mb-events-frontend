export interface ChartPoint {
  label: string;
  value: number;
}

export interface OrganizerStats {
  totalEvents: number;
  totalRegistrations: number;
  totalRevenue: number;
  totalTicketsSold: number;
  registrationsOverTime: ChartPoint[];
  revenueOverTime: ChartPoint[];
  topEvents: { eventId: string; title: string; registrations: number }[];
}

export interface AdminStats {
  totalUsers: number;
  totalOrganizers: number;
  totalEvents: number;
  totalRevenue: number;
  usersOverTime: ChartPoint[];
  eventsByCategory: ChartPoint[];
  eventsByStatus: ChartPoint[];
}
