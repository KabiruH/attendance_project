'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Clock, UserCheck, AlertTriangle, UserPlus, TrendingUp, BarChart3, Calendar, Award } from 'lucide-react';
import { BarChart, LineChart, PieChart, XAxis, YAxis, Bar, Line, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttendanceSession {
  check_in: string;
  check_out?: string | null;
}

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  sessions?: AttendanceSession[];
}

interface AdminDashboardProps {
  data: unknown;
}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [personalAttendance, setPersonalAttendance] = useState<any[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const { toast } = useToast();

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      setUserRole(user.role);

      await fetchAttendanceData();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Authentication Error',
        description: error instanceof Error ? error.message : 'Failed to authenticate',
        variant: 'destructive',
      });
    }
  };

  // Helper function to calculate total hours from sessions
  const calculateTotalHoursFromSessions = (sessions: AttendanceSession[]): number => {
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
    
    return totalMinutes / 60;
  };

  // Helper function to check if attendance has active session
  const hasActiveSession = (attendance: AttendanceRecord): boolean => {
    if (attendance.sessions && Array.isArray(attendance.sessions)) {
      return attendance.sessions.some((s: AttendanceSession) => s.check_in && !s.check_out);
    }
    return !!(attendance.check_in_time && !attendance.check_out_time);
  };

  // Function to calculate hours worked display
  const calculateHoursWorked = (attendance: AttendanceRecord): string => {
    if (attendance.sessions && attendance.sessions.length > 0) {
      let totalMinutes = 0;
      let hasActiveSession = false;
      
      attendance.sessions.forEach((session: AttendanceSession) => {
        if (session.check_in) {
          const checkIn = new Date(session.check_in);
          const checkOut = session.check_out ? new Date(session.check_out) : new Date();
          
          if (!session.check_out) hasActiveSession = true;
          
          const diffInMs = checkOut.getTime() - checkIn.getTime();
          const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
          totalMinutes += diffInMinutes;
        }
      });
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (hasActiveSession) {
        return `${hours}h ${minutes}m *`;
      }
      return `${hours}h ${minutes}m`;
    }
    
    // Fallback to old format
    if (!attendance.check_in_time) return '-';
    
    const checkIn = new Date(attendance.check_in_time);
    const checkOut = attendance.check_out_time ? new Date(attendance.check_out_time) : new Date();
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (!attendance.check_out_time) {
      return `${hours}h ${minutes}m *`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const fetchAttendanceData = async () => {
    try {
      const response = await fetch('/api/attendance/status', {
        method: 'GET',
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }
  
      const data = await response.json();
  
      setIsCheckedIn(data.isCheckedIn);
      setAttendanceData(data.attendanceData || []);

      if (data.personalAttendance) {
        const processedPersonalData = data.personalAttendance.map((record: any) => ({
          date: new Date(record.date).toLocaleDateString(),
          present: record.status.toLowerCase() === 'present' ? 1 : 0,
          late: record.status.toLowerCase() === 'late' ? 1 : 0,
          absent: record.status.toLowerCase() === 'absent' ? 1 : 0,
        }));
        
        const processedWeeklyHours = data.personalAttendance.map((record: any) => {
          const date = new Date(record.date);
          let hours = 0;

          if (record.sessions && Array.isArray(record.sessions)) {
            hours = calculateTotalHoursFromSessions(record.sessions);
          } 
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
        
        setPersonalAttendance(processedPersonalData);
        setWeeklyHours(processedWeeklyHours);
      }
  
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch attendance data.',
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
  
      setIsCheckedIn(action === 'check-in');
      await fetchAttendanceData();
  
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
    fetchTokenAndUser();
    
    const refreshInterval = setInterval(() => {
      fetchAttendanceData();
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString();
  };

  const getTodayAttendance = () => {
    const today = new Date().toDateString();
    return attendanceData.filter(record => 
      new Date(record.date).toDateString() === today
    ).sort((a, b) => {
      if (!a.check_in_time && !b.check_in_time) return 0;
      if (!a.check_in_time) return 1;
      if (!b.check_in_time) return -1;
      
      const timeA = new Date(a.check_in_time).getTime();
      const timeB = new Date(b.check_in_time).getTime();
      return timeB - timeA;
    });
  };

  // NEW: Calculate additional analytics
  const getAnalytics = () => {
    const today = new Date().toDateString();
    const todayRecords = attendanceData.filter(record => 
      new Date(record.date).toDateString() === today
    );

    // Weekly attendance trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    const weeklyTrend = last7Days.map(dateStr => {
      const dayRecords = attendanceData.filter(record => 
        new Date(record.date).toDateString() === dateStr
      );
      const totalEmployees = new Set(attendanceData.map(a => a.employee_id)).size;
      const presentCount = dayRecords.filter(r => 
        r.status.toLowerCase() === 'present' || r.status.toLowerCase() === 'late'
      ).length;
      
      return {
        date: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        present: presentCount,
        absent: Math.max(0, totalEmployees - presentCount),
        rate: totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0
      };
    });

    // Today's status breakdown
    const statusBreakdown = [
      { name: 'Present', value: todayRecords.filter(r => r.status.toLowerCase() === 'present').length, color: '#22c55e' },
      { name: 'Late', value: todayRecords.filter(r => r.status.toLowerCase() === 'late').length, color: '#eab308' },
      { name: 'Absent', value: todayRecords.filter(r => r.status.toLowerCase() === 'absent').length, color: '#ef4444' }
    ];

    // Top performers (this week)
    const thisWeek = attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordDate >= weekAgo;
    });

    const performanceMap = new Map();
    thisWeek.forEach(record => {
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

    const topPerformers = Array.from(performanceMap.values())
      .map(emp => ({
        ...emp,
        rate: emp.total > 0 ? Math.round(((emp.present + emp.late) / emp.total) * 100) : 0
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    // Total hours worked today
    const totalHoursToday = todayRecords.reduce((total, record) => {
      if (record.sessions && record.sessions.length > 0) {
        return total + calculateTotalHoursFromSessions(record.sessions);
      } else if (record.check_in_time) {
        const checkIn = new Date(record.check_in_time);
        const checkOut = record.check_out_time ? new Date(record.check_out_time) : new Date();
        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        return total + Math.max(0, hours);
      }
      return total;
    }, 0);

    const totalEmployees = new Set(attendanceData.map(a => a.employee_id)).size;
    const presentToday = todayRecords.filter(a => 
      a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late'
    ).length;
    const lateToday = todayRecords.filter(a => 
      a.status.toLowerCase() === 'late'
    ).length;
    const attendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

    return {
      weeklyTrend,
      statusBreakdown,
      topPerformers,
      totalHoursToday: totalHoursToday.toFixed(1),
      attendanceRate,
      avgHoursPerEmployee: presentToday > 0 ? (totalHoursToday / presentToday).toFixed(1) : '0',
      totalEmployees,
      presentToday,
      lateToday
    };
  };

  const analytics = getAnalytics();
  const todayAttendance = getTodayAttendance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6 space-y-6">
      {/* Header with Welcome and Clock */}
      <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-lg">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Welcome, {employeeName || 'Admin'}
        </h1>
        <div className="flex items-center space-x-2 text-lg font-semibold text-gray-700">
          <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Personal Check In/Out Card */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <CardTitle className="text-white">Your Attendance</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center space-x-4 p-6">
          <Button
            size="lg"
            onClick={() => handleAttendance('check-in')}
            disabled={isCheckedIn || isLoading}
            className={`w-32 transform hover:scale-105 transition-transform duration-200 ${
              isCheckedIn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Check In'}
          </Button>
          <Button
            size="lg"
            onClick={() => handleAttendance('check-out')}
            disabled={!isCheckedIn || isLoading}
            className={`w-32 transform hover:scale-105 transition-transform duration-200 ${
              !isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Check Out'}
          </Button>
        </CardContent>
      </Card>

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Total Employees</p>
                <p className="text-3xl font-bold">{analytics.totalEmployees}</p>
              </div>
              <UserPlus className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">On Time Today</p>
                <p className="text-3xl font-bold">{analytics.presentToday}</p>
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
                <p className="text-3xl font-bold">{analytics.lateToday}</p>
              </div>
              <AlertTriangle className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* NEW: Attendance Rate Card */}
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Attendance Rate</p>
                <p className="text-3xl font-bold">{analytics.attendanceRate}%</p>
              </div>
              <TrendingUp className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* NEW: Total Hours Card */}
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Hours Today</p>
                <p className="text-3xl font-bold">{analytics.totalHoursToday}h</p>
              </div>
              <Clock className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Analytics Dashboard */}
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
              <BarChart data={analytics.weeklyTrend}>
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
                  data={analytics.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({name, value}) => `${name}: ${value}`}
                >
                  {analytics.statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Top Performers & Today's Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Performers */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-600">
            <CardTitle className="text-white flex items-center">
              <Award className="w-5 h-5 mr-2" />
              Top Performers (This Week)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {analytics.topPerformers.map((performer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
              ))}
              {analytics.topPerformers.length === 0 && (
                <p className="text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Attendance Table */}
        <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <CardTitle className="text-white">Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Employee Name</TableHead>
                    <TableHead className="font-semibold">Check In</TableHead>
                    <TableHead className="font-semibold">Check Out</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Hours Worked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAttendance.length > 0 ? (
                    todayAttendance.map((attendance) => (
                      <TableRow key={attendance.id} className="hover:bg-gray-50 transition-colors duration-200">
                        <TableCell className="font-medium">{attendance.employee_name}</TableCell>
                        <TableCell>{formatTime(attendance.check_in_time)}</TableCell>
                        <TableCell>{formatTime(attendance.check_out_time)}</TableCell>
                        <TableCell>
                          <Badge className={`${
                            attendance.status.toLowerCase() === 'present' ? 'bg-green-500 hover:bg-green-600' :
                            attendance.status.toLowerCase() === 'late' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600'
                          } transition-colors duration-200`}>
                            {attendance.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          <span className={`${
                            hasActiveSession(attendance) ? 'text-blue-600 font-semibold' : 'text-gray-700'
                          }`}>
                            {calculateHoursWorked(attendance)}
                          </span>
                          {hasActiveSession(attendance) && (
                            <span className="text-xs text-blue-500 ml-1">(ongoing)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No attendance records for today
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Only show for non-admin users */}
      {userRole !== 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600">
              <CardTitle className="text-white">Monthly Attendance Overview</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={personalAttendance}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
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
                  <Bar dataKey="late" fill="#eab308" name="Late" />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-cyan-600 to-blue-600">
              <CardTitle className="text-white">Weekly Hours</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyHours}>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
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
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#2563eb"
                    name="Hours Worked"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;