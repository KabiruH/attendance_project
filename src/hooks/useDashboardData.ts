// hooks/useDashboardData.ts
'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { 
  AttendanceRecord, 
  ChartDataPoint, 
  WeeklyHoursDataPoint,
  AttendanceStats 
} from '../lib/types/dashboard';
import { 
  hasActiveSession, 
  calculateTodayHours, 
  processAttendanceData, 
  processWeeklyHours, 
  calculateAttendanceStats 
} from '../lib/utils/dashboardUtils';

export const useDashboardData = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<ChartDataPoint[]>([]);
  const [rawAttendanceData, setRawAttendanceData] = useState<AttendanceRecord[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursDataPoint[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayHours, setTodayHours] = useState<string>('-');
  const [stats, setStats] = useState<AttendanceStats>({
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    totalHoursThisMonth: '0'
  });
  
  const { toast } = useToast();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      // Update today's hours if checked in
      if (isCheckedIn && todayRecord) {
        setTodayHours(calculateTodayHours(todayRecord));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isCheckedIn, todayRecord]);

  const fetchTokenAndUser = async () => {
    try {
      const response = await fetch('/api/auth/check', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const { user } = await response.json();
      setEmployeeName(user.name);
      setEmployeeId(user.id);

      await fetchAttendanceStatus();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Authentication Error',
        description: error instanceof Error ? error.message : 'Failed to authenticate',
        variant: 'destructive',
      });
    }
  };

  const fetchAttendanceStatus = async () => {
    try {
      const response = await fetch('/api/attendance/status', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch attendance status');
      }

      const data = await response.json();
      
      // Store raw attendance data
      setRawAttendanceData(data.attendanceData || []);
      
      // Check if there's a record for today
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = data.attendanceData.find((record: AttendanceRecord) => 
        record.date.startsWith(today)
      );

      if (todayRecord) {
        setTodayRecord(todayRecord);
        setIsCheckedIn(hasActiveSession(todayRecord));
        setTodayHours(calculateTodayHours(todayRecord));
      } else {
        setTodayRecord(null);
        setIsCheckedIn(false);
        setTodayHours('-');
      }

      // Process data for charts
      const processedData = processAttendanceData(data.attendanceData);
      const hoursData = processWeeklyHours(data.attendanceData);
      const calculatedStats = calculateAttendanceStats(processedData, data.attendanceData);

      setAttendanceData(processedData);
      setWeeklyHours(hoursData);
      setStats(calculatedStats);

    } catch (error) {
      console.error('Error fetching attendance status:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch attendance status.',
        variant: 'destructive',
      });
    }
  };

  const handleAttendance = async (action: 'check-in' | 'check-out') => {
    setIsLoading(true);
    try {
      if (!employee_id) throw new Error('Employee ID is missing');
  
      const response = await fetch('/api/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, employee_id }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process attendance');
      }
  
      // Wait for the status update
      await fetchAttendanceStatus();
  
      toast({
        title: 'Success',
        description: `Successfully ${action === 'check-in' ? 'checked in' : 'checked out'}`,
      });
  
    } catch (error) {
      console.error('Error handling attendance:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process attendance',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTokenAndUser();
  
    // Set up periodic status check every minute
    const statusInterval = setInterval(() => {
      if (employee_id) {
        fetchAttendanceStatus();
      }
    }, 60000); // Check every minute
  
    return () => clearInterval(statusInterval);
  }, [employee_id]); // Re-run when employee_id changes

  return {
    // State
    isCheckedIn,
    isLoading,
    employeeName,
    employee_id,
    attendanceData,
    rawAttendanceData,
    weeklyHours,
    currentTime,
    todayRecord,
    todayHours,
    stats,
    
    // Actions
    handleAttendance,
    fetchAttendanceStatus,
    fetchTokenAndUser
  };
};