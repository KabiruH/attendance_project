// types/reports.ts

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'all';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: Exclude<AttendanceStatus, 'all'>;
}

export interface FilterState {
  employeeName: string;
  status: AttendanceStatus;
  startDate: string;
  endDate: string;
}