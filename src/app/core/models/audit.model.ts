export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
