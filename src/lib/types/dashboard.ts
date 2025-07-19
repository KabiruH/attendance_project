// types/dashboard.ts
export interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  sessions?: AttendanceSession[];
}

export interface ChartDataPoint {
  date: string;
  present: number;
  late: number;
  absent: number;
}

export interface WeeklyHoursDataPoint {
  day: string;
  hours: number;
}

export interface EmployeeData {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AttendanceStats {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalHoursThisMonth: string;
}