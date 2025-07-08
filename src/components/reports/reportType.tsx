// reportType.ts
export interface AttendanceRecord {
  sessions: boolean;
  id: number;
  employee_id: number;
  date: string | Date;
  check_in_time?: string | Date | null;
  check_out_time?: string | Date | null;
  status: string;
  Employees: {
    id: number;
    name: string | null;
  };
}

// Add types for the processed data
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

export interface FilterState {
  employeeName: string;
  status: string;
  startDate: string;
  endDate: string;
}

export type AttendanceStatus = 'all' | 'present' | 'late' | 'absent';