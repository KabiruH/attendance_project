// utils/dashboardUtils.ts
import { AttendanceSession, AttendanceRecord, ChartDataPoint, WeeklyHoursDataPoint, AttendanceStats } from '../types/dashboard';

// Calculate total hours from sessions (matching route logic)
export const calculateTotalHoursFromSessions = (sessions: AttendanceSession[]): number => {
  if (!sessions || sessions.length === 0) return 0;
  
  let totalMinutes = 0;
  
  sessions.forEach(session => {
    if (session.check_in) {
      const checkIn = new Date(session.check_in);
      const checkOut = session.check_out ? new Date(session.check_out) : new Date();
      
      const diffInMs = checkOut.getTime() - checkIn.getTime();
      const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
      
      totalMinutes += diffInMinutes;
    }
  });
  
  return totalMinutes / 60; // Convert to hours
};

// Check if record has active session
export const hasActiveSession = (record: AttendanceRecord): boolean => {
  // Check for active session in new format
  if (record.sessions && Array.isArray(record.sessions)) {
    return record.sessions.some((s: AttendanceSession) => s.check_in && !s.check_out);
  }
  
  // Fallback to old format
  return !!(record.check_in_time && !record.check_out_time);
};

// Calculate today's hours using sessions
export const calculateTodayHours = (record: AttendanceRecord | null): string => {
  if (!record) return '-';
  
  // Use sessions data if available (new format)
  if (record.sessions && record.sessions.length > 0) {
    let totalMinutes = 0;
    
    record.sessions.forEach((session: AttendanceSession) => {
      if (session.check_in) {
        const checkIn = new Date(session.check_in);
        const checkOut = session.check_out ? new Date(session.check_out) : new Date();
        
        const diffInMs = checkOut.getTime() - checkIn.getTime();
        const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
        totalMinutes += diffInMinutes;
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  }
  
  // Fallback to old format
  if (!record.check_in_time) return '-';
  
  const checkIn = new Date(record.check_in_time);
  const checkOut = record.check_out_time ? new Date(record.check_out_time) : new Date();
  
  const diffInMs = checkOut.getTime() - checkIn.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  
  if (diffInMinutes < 0) return '-';
  
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;
  
  return `${hours}h ${minutes}m`;
};

// Process attendance data for charts
export const processAttendanceData = (attendanceData: AttendanceRecord[]): ChartDataPoint[] => {
  return attendanceData.map((record: AttendanceRecord) => ({
    date: new Date(record.date).toLocaleDateString(),
    present: record.status.toLowerCase() === 'present' ? 1 : 0,
    late: record.status.toLowerCase() === 'late' ? 1 : 0,
    absent: record.status.toLowerCase() === 'absent' ? 1 : 0,
  }));
};

// Process weekly hours using sessions data
export const processWeeklyHours = (attendanceData: AttendanceRecord[]): WeeklyHoursDataPoint[] => {
  return attendanceData.map((record: AttendanceRecord) => {
    const date = new Date(record.date);
    let hours = 0;

    // Use sessions data if available (new format)
    if (record.sessions && Array.isArray(record.sessions)) {
      // Only count completed sessions (those with check_out)
      record.sessions.forEach((session: AttendanceSession) => {
        if (session.check_in && session.check_out) {
          const checkIn = new Date(session.check_in);
          const checkOut = new Date(session.check_out);
          const sessionHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          hours += sessionHours;
        }
      });
    } 
    // Fallback to old format (only if completely checked out)
    else if (record.check_in_time && record.check_out_time) {
      const checkIn = new Date(record.check_in_time);
      const checkOut = new Date(record.check_out_time);
      hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    }

    return {
      day: date.toLocaleDateString(),
      hours: Number(hours.toFixed(2))
    };
  });
};

// Calculate statistics with sessions support
export const calculateAttendanceStats = (
  attendanceData: ChartDataPoint[], 
  rawAttendanceData: AttendanceRecord[]
): AttendanceStats => {
  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate total hours for current month using sessions
  let totalMonthlyHours = 0;
  
  rawAttendanceData.forEach((record: AttendanceRecord) => {
    const recordDate = new Date(record.date);
    
    // Check if record is from current month and year
    if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
      
      // Use sessions data if available (new format)
      if (record.sessions && Array.isArray(record.sessions)) {
        record.sessions.forEach((session: AttendanceSession) => {
          if (session.check_in && session.check_out) {
            // Only count completed sessions
            const checkIn = new Date(session.check_in);
            const checkOut = new Date(session.check_out);
            const sessionHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            if (sessionHours > 0) {
              totalMonthlyHours += sessionHours;
            }
          }
        });
      }
      // Fallback to old format (only count completed work)
      else if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(record.check_in_time);
        const checkOut = new Date(record.check_out_time);
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        
        if (hours > 0) {
          totalMonthlyHours += hours;
        }
      }
    }
  });
  
  return {
    presentDays: attendanceData.reduce((sum, day) => sum + day.present, 0),
    lateDays: attendanceData.reduce((sum, day) => sum + day.late, 0),
    absentDays: attendanceData.reduce((sum, day) => sum + day.absent, 0),
    totalHoursThisMonth: totalMonthlyHours.toFixed(1)
  };
};