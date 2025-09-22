// components/dashboard/admin/AdminAttendanceAnalytics.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, Calendar, Award } from 'lucide-react';

interface WeeklyTrendData {
  date: string;
  present: number;
  absent: number;
  rate: number;
}

interface StatusBreakdownData {
  name: string;
  value: number;
  color: string;
}

interface TopPerformer {
  name: string;
  present: number;
  late: number;
  total: number;
  rate: number;
}

const AdminAttendanceAnalytics: React.FC = () => {
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendData[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdownData[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/status', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const attendanceData = data.attendanceData || [];
        
        processAnalyticsData(attendanceData);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get Monday to Friday of current week
  const getCurrentWeekMondayToFriday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate days to subtract to get to Monday (0 for Monday, 6 for Tuesday, etc.)
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    
    return { monday, friday };
  };

  const processAnalyticsData = (attendanceData: any[]) => {
    // Weekly attendance trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    const weeklyTrendData = last7Days.map(dateStr => {
      const dayRecords = attendanceData.filter(record => 
        new Date(record.date).toDateString() === dateStr
      );
      const totalEmployees = new Set(attendanceData.map(a => a.employee_id)).size;
      const presentCount = dayRecords.filter(r => 
        r.status.toLowerCase() === 'present' || r.status.toLowerCase() === 'late'
      ).length;
      
      return {
        date: new Date(dateStr).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' }),
        present: presentCount,
        absent: Math.max(0, totalEmployees - presentCount),
        rate: totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0
      };
    });

    // Today's status breakdown
    const today = new Date().toDateString();
    const todayRecords = attendanceData.filter(record => 
      new Date(record.date).toDateString() === today
    );

    const statusBreakdownData = [
      { name: 'Present', value: todayRecords.filter(r => r.status.toLowerCase() === 'present').length, color: '#22c55e' },
      { name: 'Late', value: todayRecords.filter(r => r.status.toLowerCase() === 'late').length, color: '#eab308' },
      { name: 'Absent', value: todayRecords.filter(r => r.status.toLowerCase() === 'absent').length, color: '#ef4444' }
    ];

    // Top performers (Monday to Friday of current week)
    const { monday, friday } = getCurrentWeekMondayToFriday();
    
    const currentWeekRecords = attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= monday && recordDate <= friday;
    });

    const performanceMap = new Map();
    currentWeekRecords.forEach(record => {
      const employeeId = record.employee_id;
      if (!performanceMap.has(employeeId)) {
        performanceMap.set(employeeId, {
          name: record.employee_name,
          present: 0,
          late: 0,
          total: 0
        });
      }
      const emp = performanceMap.get(employeeId);
      emp.total++;
      if (record.status.toLowerCase() === 'present') emp.present++;
      if (record.status.toLowerCase() === 'late') emp.late++;
    });

    const topPerformersData = Array.from(performanceMap.values())
      .map(emp => ({
        ...emp,
        rate: emp.total > 0 ? Math.round(((emp.present + emp.late) / emp.total) * 100) : 0
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    setWeeklyTrend(weeklyTrendData);
    setStatusBreakdown(statusBreakdownData);
    setTopPerformers(topPerformersData);
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    const interval = setInterval(fetchAnalyticsData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="bg-gray-200">
              <div className="h-6 bg-gray-300 rounded w-3/4"></div>
            </CardHeader>
            <CardContent className="h-[300px] pt-6">
              <div className="h-full bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Weekly Attendance Trend */}
      <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-cyan-600 to-blue-600">
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Weekly Attendance Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="present" fill="#22c55e" name="Present" />
              <Bar dataKey="absent" fill="#ef4444" name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Today's Status Breakdown */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-pink-600 to-rose-600">
          <CardTitle className="text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Today's Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({name, value}) => `${name}: ${value}`}
              >
                {statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card className="lg:col-span-3 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-600">
          <CardTitle className="text-white flex items-center">
            <Award className="w-5 h-5 mr-2" />
            Top Performers (This Week - Monday to Friday)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topPerformers.length === 0 ? (
              <div className="col-span-5 text-center py-8 text-gray-500">
                <p>No performance data available</p>
              </div>
            ) : (
              topPerformers.map((performer, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{performer.name}</p>
                      <p className="text-xs text-gray-500">{performer.present + performer.late}/{performer.total} days</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{performer.rate}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAttendanceAnalytics;