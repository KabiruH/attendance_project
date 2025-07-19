// hooks/useClassAttendance.ts
'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

interface ClassAttendanceRecord {
  id: number;
  trainer_id: number;
  class_id: number;
  date: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  auto_checkout: boolean;
  class: {
    id: number;
    name: string;
    code: string;
    department: string;
    duration_hours: number;
  };
}

export const useClassAttendance = (userId?: string | null) => {
  const [isClassLoading, setIsClassLoading] = useState(false);
  const [classAttendanceData, setClassAttendanceData] = useState<ClassAttendanceRecord[]>([]);
  const [todayClassAttendance, setTodayClassAttendance] = useState<ClassAttendanceRecord[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canCheckIntoNewClass, setCanCheckIntoNewClass] = useState(true);
  
  const { toast } = useToast();

  const fetchClassAttendanceData = async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/attendance/class-status', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        // If the endpoint doesn't exist yet, fail silently
        return;
      }

      const data = await response.json();
      
      setClassAttendanceData(data.attendanceHistory || []);
      setTodayClassAttendance(data.todayAttendance || []);
      setUserRole(data.userRole);
      setCanCheckIntoNewClass(data.canCheckIntoNewClass !== false);

    } catch (error) {
      // Fail silently for now since this is optional functionality
      console.log('Class attendance data not available yet');
    }
  };

  const handleClassCheckIn = async (classId: number) => {
    setIsClassLoading(true);
    try {
      const response = await fetch('/api/attendance/class-checkin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          class_id: classId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check into class');
      }

      const result = await response.json();
      
      // Refresh class attendance data
      await fetchClassAttendanceData();

      toast({
        title: 'Success',
        description: result.message || 'Successfully checked into class',
      });

    } catch (error) {
      console.error('Error checking into class:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check into class',
        variant: 'destructive',
      });
    } finally {
      setIsClassLoading(false);
    }
  };

  const handleClassCheckOut = async (attendanceId: number) => {
    setIsClassLoading(true);
    try {
      const response = await fetch('/api/attendance/class-checkin', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'check-out',
          attendance_id: attendanceId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out of class');
      }

      const result = await response.json();
      
      // Refresh class attendance data
      await fetchClassAttendanceData();

      toast({
        title: 'Success',
        description: result.message || 'Successfully checked out of class',
      });

    } catch (error) {
      console.error('Error checking out of class:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check out of class',
        variant: 'destructive',
      });
    } finally {
      setIsClassLoading(false);
    }
  };

  const getActiveClassSessions = () => {
    const now = new Date();
    return todayClassAttendance.filter(attendance => {
      // If no checkout time, it's definitely active
      if (!attendance.check_out_time) return true;
      
      // If it was auto-checkout and the checkout time hasn't passed yet, it's still active
      if (attendance.auto_checkout && new Date(attendance.check_out_time) > now) {
        return true;
      }
      
      // If it was manually checked out, it's not active
      return false;
    });
  };

  const getActiveSessionInfo = () => {
    const activeSessions = getActiveClassSessions();
    if (activeSessions.length > 0) {
      return {
        hasActiveSession: true,
        activeSessionName: activeSessions[0].class.name,
        activeSession: activeSessions[0]
      };
    }
    return {
      hasActiveSession: false,
      activeSessionName: '',
      activeSession: null
    };
  };

  const calculateTodayClassHours = () => {
    let totalMinutes = 0;
    const now = new Date();

    todayClassAttendance.forEach(attendance => {
      const checkIn = new Date(attendance.check_in_time);
      let checkOut: Date;
      
      if (!attendance.check_out_time) {
        // No checkout time set, use current time
        checkOut = now;
      } else if (attendance.auto_checkout && new Date(attendance.check_out_time) > now) {
        // Auto-checkout time hasn't been reached yet, use current time
        checkOut = now;
      } else {
        // Use the actual checkout time (either manual or auto-checkout that has passed)
        checkOut = new Date(attendance.check_out_time);
      }
      
      const diffMs = checkOut.getTime() - checkIn.getTime();
      totalMinutes += Math.max(0, diffMs / (1000 * 60));
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    
    if (hours === 0) {
      return minutes === 0 ? '-' : `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    if (userId) {
      fetchClassAttendanceData();
      
      // Set up periodic refresh every 5 minutes
      const interval = setInterval(fetchClassAttendanceData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  return {
    // State
    isClassLoading,
    classAttendanceData,
    todayClassAttendance,
    userRole,
    canCheckIntoNewClass,
    
    // Computed values
    activeClassSessions: getActiveClassSessions(),
    todayClassHours: calculateTodayClassHours(),
    ...getActiveSessionInfo(),
    
    // Actions
    handleClassCheckIn,
    handleClassCheckOut,
    fetchClassAttendanceData
  };
};