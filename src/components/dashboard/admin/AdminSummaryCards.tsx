// components/dashboard/admin/AdminSummaryCards.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Clock, UserCheck, AlertTriangle, UserPlus, TrendingUp } from 'lucide-react';

interface AttendanceMetrics {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  attendanceRate: number;
  totalHoursToday: string;
}

const AdminSummaryCards: React.FC = () => {
  const [metrics, setMetrics] = useState<AttendanceMetrics>({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    attendanceRate: 0,
    totalHoursToday: '0'
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/status', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const attendanceData = data.attendanceData || [];
        
        // Calculate metrics
        const today = new Date().toDateString();
        const todayRecords = attendanceData.filter((record: any) => 
          new Date(record.date).toDateString() === today
        );

        const totalEmployees = new Set(attendanceData.map((a: any) => a.employee_id)).size;
        const presentToday = todayRecords.filter((a: any) => 
          a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late'
        ).length;
        const lateToday = todayRecords.filter((a: any) => 
          a.status.toLowerCase() === 'late'
        ).length;
        const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

        // Calculate total hours
        const totalHoursToday = todayRecords.reduce((total: number, record: any) => {
          if (record.sessions && record.sessions.length > 0) {
            let sessionHours = 0;
            record.sessions.forEach((session: any) => {
              if (session.check_in) {
                const checkIn = new Date(session.check_in);
                const checkOut = session.check_out ? new Date(session.check_out) : new Date();
                const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                sessionHours += Math.max(0, hours);
              }
            });
            return total + sessionHours;
          } else if (record.check_in_time) {
            const checkIn = new Date(record.check_in_time);
            const checkOut = record.check_out_time ? new Date(record.check_out_time) : new Date();
            const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            return total + Math.max(0, hours);
          }
          return total;
        }, 0);

        setMetrics({
          totalEmployees,
          presentToday,
          lateToday,
          attendanceRate,
          totalHoursToday: totalHoursToday.toFixed(1)
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchMetrics, 600000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between p-4 bg-gray-200 rounded-lg">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-20"></div>
                  <div className="h-8 bg-gray-300 rounded w-12"></div>
                </div>
                <div className="w-12 h-12 bg-gray-300 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
            <div>
              <p className="text-sm font-medium opacity-90">Total Employees</p>
              <p className="text-3xl font-bold">{metrics.totalEmployees}</p>
            </div>
            <UserPlus className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white">
            <div>
              <p className="text-sm font-medium opacity-90">Present Today</p>
              <p className="text-3xl font-bold">{metrics.presentToday}</p>
            </div>
            <UserCheck className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg text-white">
            <div>
              <p className="text-sm font-medium opacity-90">Late Today</p>
              <p className="text-3xl font-bold">{metrics.lateToday}</p>
            </div>
            <AlertTriangle className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>

      <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white">
            <div>
              <p className="text-sm font-medium opacity-90">Attendance Rate</p>
              <p className="text-3xl font-bold">{metrics.attendanceRate}%</p>
            </div>
            <TrendingUp className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>

      <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg text-white">
            <div>
              <p className="text-sm font-medium opacity-90">Hours Today</p>
              <p className="text-3xl font-bold">{metrics.totalHoursToday}h</p>
            </div>
            <Clock className="w-12 h-12 opacity-80" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSummaryCards;