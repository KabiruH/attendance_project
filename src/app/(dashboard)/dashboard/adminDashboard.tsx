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
import { Clock, UserCheck, AlertTriangle } from 'lucide-react';
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
    <div className="p-6 space-y-6">
      {/* Header with Welcome and Clock */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welcome, {employeeName || 'Admin'}</h1>
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Personal Check In/Out Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Attendance</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center space-x-4">
          <Button
            size="lg"
            onClick={() => handleAttendance('check-in')}
            disabled={isCheckedIn || isLoading}
            className={`w-32 ${isCheckedIn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {isLoading ? 'Processing...' : 'Check In'}
          </Button>
          <Button
            size="lg"
            onClick={() => handleAttendance('check-out')}
            disabled={!isCheckedIn || isLoading}
            className={`w-32 ${!isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {isLoading ? 'Processing...' : 'Check Out'}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Employees</p>
                <p className="text-2xl font-bold">{totalEmployees}</p>
              </div>
              <UserCheck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Present Today</p>
                <p className="text-2xl font-bold">{presentToday}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Late Today</p>
                <p className="text-2xl font-bold">{lateToday}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent>
        <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee Name</TableHead>
          <TableHead>Check In</TableHead>
          <TableHead>Check Out</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {todayAttendance.length > 0 ? (
          todayAttendance.map((attendance) => (
            <TableRow key={attendance.id}>
              <TableCell>{attendance.employee_name}</TableCell>
              <TableCell>{formatTime(attendance.check_in_time)}</TableCell>
              <TableCell>{formatTime(attendance.check_out_time)}</TableCell>
              <TableCell>
                <Badge className={
                  attendance.status.toLowerCase() === 'present' ? 'bg-green-500' :
                  attendance.status.toLowerCase() === 'late' ? 'bg-yellow-500' : 'bg-red-500'
                }>
                  {attendance.status.toUpperCase()}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              No attendance records for today
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
        </CardContent>
      </Card>
      <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Overview</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
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
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#22c55e" name="Present" />
                  <Bar dataKey="late" fill="#eab308" name="Late" />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Hours</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
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
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#2563eb"
                    name="Hours Worked"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
    </div>
  );
};

export default AdminDashboard;