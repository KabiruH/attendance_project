// hooks/useClassAnalytics.ts
'use client';

import { useState, useEffect } from 'react';

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

interface AnalyticsStats {
  totalHours: number;
  totalSessions: number;
  uniqueClasses: number;
  averageSessionLength: number;
  topClass: string;
  mostActiveDepartment: string;
}

export const useClassAnalytics = (userId?: string | null, timeRange: string = 'month') => {
  const [attendanceHistory, setAttendanceHistory] = useState<ClassAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsStats>({
    totalHours: 0,
    totalSessions: 0,
    uniqueClasses: 0,
    averageSessionLength: 0,
    topClass: '',
    mostActiveDepartment: ''
  });

  const fetchAnalyticsData = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/class-status', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const history = data.attendanceHistory || [];
        setAttendanceHistory(history);
        calculateAnalytics(history);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSessionHours = (record: ClassAttendanceRecord): number => {
    if (!record.check_out_time) return 0;
    
    const checkIn = new Date(record.check_in_time);
    const checkOut = new Date(record.check_out_time);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  };

  const getFilteredData = (data: ClassAttendanceRecord[]) => {
    const now = new Date();
    const filterDate = new Date();
    
    switch (timeRange) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        filterDate.setMonth(now.getMonth() - 1);
    }

    return data.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= filterDate && record.check_out_time;
    });
  };

  const calculateAnalytics = (data: ClassAttendanceRecord[]) => {
    const filteredData = getFilteredData(data);
    
    if (filteredData.length === 0) {
      setAnalytics({
        totalHours: 0,
        totalSessions: 0,
        uniqueClasses: 0,
        averageSessionLength: 0,
        topClass: '',
        mostActiveDepartment: ''
      });
      return;
    }

    let totalHours = 0;
    const classHours = new Map<string, number>();
    const departmentHours = new Map<string, number>();
    const uniqueClassIds = new Set<number>();

    filteredData.forEach(record => {
      const hours = calculateSessionHours(record);
      totalHours += hours;
      uniqueClassIds.add(record.class.id);

      // Track by class
      const className = record.class.name;
      classHours.set(className, (classHours.get(className) || 0) + hours);

      // Track by department
      const dept = record.class.department;
      departmentHours.set(dept, (departmentHours.get(dept) || 0) + hours);
    });

    // Find top class and department
    const topClass = Array.from(classHours.entries()).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0])[0];
    const mostActiveDepartment = Array.from(departmentHours.entries()).reduce((a, b) => a[1] > b[1] ? a : b, ['', 0])[0];

    setAnalytics({
      totalHours: Number(totalHours.toFixed(1)),
      totalSessions: filteredData.length,
      uniqueClasses: uniqueClassIds.size,
      averageSessionLength: Number((totalHours / filteredData.length).toFixed(1)),
      topClass,
      mostActiveDepartment
    });
  };

  useEffect(() => {
    if (userId) {
      fetchAnalyticsData();
    }
  }, [userId, timeRange]);

  return {
    attendanceHistory,
    analytics,
    isLoading,
    refetch: fetchAnalyticsData
  };
};