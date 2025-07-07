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
import { Clock, UserCheck, AlertTriangle, UserPlus } from 'lucide-react';
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

interface AdminDashboardProps {
  data: unknown;
}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
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
  
      // Update check-in status based on returned data
      setIsCheckedIn(data.isCheckedIn);
      setAttendanceData(data.attendanceData || []);

       // Process personal attendance data for charts
       const processedPersonalData = data.personalAttendance.map((record: any) => ({
        date: new Date(record.date).toLocaleDateString(),
        present: record.status.toLowerCase() === 'present' ? 1 : 0,
        late: record.status.toLowerCase() === 'late' ? 1 : 0,
        absent: record.status.toLowerCase() === 'absent' ? 1 : 0,
      }));
       // Process weekly hours
       const processedWeeklyHours = data.personalAttendance.map((record: any) => {
        const date = new Date(record.date);
        let hours = 0;

        if (record.check_in_time && record.check_out_time) {
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
  
      // Immediately update the check-in status
      setIsCheckedIn(action === 'check-in');
      
      // Fetch fresh data
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
    
    // Set up periodic refresh
    const refreshInterval = setInterval(() => {
      fetchAttendanceData();
    }, 60000); // Refresh every minute

    return () => clearInterval(refreshInterval);
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString();
  };

  // Function to calculate hours worked
  const calculateHoursWorked = (checkInTime: string | null, checkOutTime: string | null) => {
    if (!checkInTime) return '-';
    
    // If not checked out yet, calculate from check-in to current time
    const checkIn = new Date(checkInTime);
    const checkOut = checkOutTime ? new Date(checkOutTime) : new Date();
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (!checkOutTime) {
      // Still working - show ongoing time with indicator
      return `${hours}h ${minutes}m *`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const getTodayAttendance = () => {
    const today = new Date().toDateString();
    // Filter for only today's records and sort them
    return attendanceData.filter(record => 
      new Date(record.date).toDateString() === today
    ).sort((a, b) => 
      a.employee_name.localeCompare(b.employee_name)
    );
  };

  const todayAttendance = getTodayAttendance();
  const totalEmployees = new Set(attendanceData.map(a => a.employee_id)).size;
  const presentToday = todayAttendance.filter(a => 
    a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late'
  ).length;
  const lateToday = todayAttendance.filter(a => 
    a.status.toLowerCase() === 'late'
  ).length;

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Total Employees</p>
                <p className="text-3xl font-bold">{totalEmployees}</p>
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
                <p className="text-3xl font-bold">{presentToday}</p>
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
                <p className="text-3xl font-bold">{lateToday}</p>
              </div>
              <AlertTriangle className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Table */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <CardTitle className="text-white">Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-gray-200">
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
                          !attendance.check_out_time && attendance.check_in_time ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        }`}>
                          {calculateHoursWorked(attendance.check_in_time, attendance.check_out_time)}
                        </span>
                        {!attendance.check_out_time && attendance.check_in_time && (
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

      {/* Charts */}
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
    </div>
  );
};

export default AdminDashboard;