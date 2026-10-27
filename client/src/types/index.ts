export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  _id: string;
  userId: string | User;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  _id: string;
  userId: string | User;
  taskId: string | Task;
  workDate: string; // YYYY-MM-DD
  description: string;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  backdateReason?: string;
  createdAt: string;
}

export type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'INCOMPLETE';

export interface Attendance {
  _id: string;
  userId: string | User;
  attendanceDate: string; // YYYY-MM-DD
  punchInAt: string;
  punchOutAt?: string;
  durationMinutes: number;
  status: AttendanceStatus;
  source: 'WEB' | 'CORRECTION' | 'ADMIN_OVERRIDE';
  notes?: string;
}

export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceCorrection {
  _id: string;
  userId: User;
  attendanceId?: string;
  targetDate: string;
  requestedPunchInAt: string;
  requestedPunchOutAt: string;
  previousPunchInAt?: string;
  previousPunchOutAt?: string;
  reason: string;
  status: CorrectionStatus;
  reviewedBy?: User;
  reviewComment?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  actorUserId?: User;
  targetUserId?: User;
  action: string;
  entityType: string;
  entityId?: string;
  before?: any;
  after?: any;
  reason?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
