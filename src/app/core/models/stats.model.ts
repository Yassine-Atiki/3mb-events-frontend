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

export interface EventAuditBreakdown {
  ticketTypeId: string;
  ticketTypeName: string;
  count: number;
  quantity: number;
}

export interface EventAudit {
  eventId: string;
  title: string;
  phase: 'BEFORE' | 'AFTER';
  startAt: string;
  endAt: string;
  capacity: number;
  registeredCount: number;
  registeredQuantity: number;
  occupancyRate: number;
  registrationsByTicketType: EventAuditBreakdown[];
  registrationTrend: ChartPoint[];
  revenueCollected: number;
  waitlistCount: number;
  pendingRefundsCount: number;
  attendedCount: number;
  attendanceRate: number;
  noShowCount: number;
  noShowRate: number;
  attendeesByTicketType: EventAuditBreakdown[];
  finalRevenue: number;
  refundsProcessedAmount: number;
  refundsProcessedCount: number;
}
