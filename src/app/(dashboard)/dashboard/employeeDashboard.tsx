'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface EmployeeDashboardProps {
  data: unknown;
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ data }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<any[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { toast } = useToast();
  const currentTime = new Date().toLocaleTimeString();

  // Fetch token and user data
  const fetchTokenAndUser = async () => {
    try {
      const response = await fetch('/api/auth/check', { method: 'GET' });

      if (!response.ok) throw new Error('Failed to fetch token or user data');

      const { token, user } = await response.json();
      setAuthToken(token);
      setEmployeeName(user.name);
      setEmployeeId(user.id);

      // Fetch attendance status immediately after getting the token
      fetchAttendanceStatus(token, user.id);
    } catch (error) {
      console.error('Error fetching token or user:', error);
      toast({
        title: 'Error',
        description: 'Could not verify authentication. Please log in again.',
        variant: 'destructive',
      });
    }
  };

  // Fetch attendance status
  const fetchAttendanceStatus = async (token: string, userId: string) => {
    try {
      const response = await fetch(`/api/attendance/status?employee_id=${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch attendance status');

      const data = await response.json();
      setIsCheckedIn(data.isCheckedIn || false); // Ensure a default value
      setAttendanceData(data.attendanceData || []);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch attendance status.',
        variant: 'destructive',
      });
    }
  };


  // Handle Check-In/Check-Out
  const handleAttendance = async (action: 'check-in' | 'check-out') => {
    setIsLoading(true);
    try {
      if (!authToken || !employee_id) throw new Error('Authentication data is missing');

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, employee_id: employee_id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process attendance');
      }

      setIsCheckedIn(action === 'check-in'); // Update state based on the action
      toast({
        title: 'Success',
        description: `Successfully ${action === 'check-in' ? 'checked in' : 'checked out'}`,
      });

      // Refresh attendance status
      fetchAttendanceStatus(authToken, employee_id);
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

  const fetchWeeklyHours = async () => {
    try {
      if (!authToken || !employee_id) throw new Error('No token or employee ID available');

      const response = await fetch(`/api/attendance/weekly-hours?employee_id=${employee_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch weekly hours');

      const data = await response.json();
      setWeeklyHours(data.weeklyHours);
    } catch (error) {
      console.error('Failed to fetch weekly hours:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch weekly hours.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchTokenAndUser();
  }, []);

  useEffect(() => {
    if (authToken && employee_id) {
      fetchWeeklyHours();
    }
  }, [authToken, employee_id]);

  // Calculate statistics
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.reduce((acc: number, day: any) => acc + (day.present ? 1 : 0), 0);
  const lateDays = attendanceData.reduce((acc: number, day: any) => acc + (day.late ? 1 : 0), 0);
  const absentDays = attendanceData.reduce((acc: number, day: any) => acc + (day.absent ? 1 : 0), 0);

  return (
    <div className="p-6 space-y-6">
   
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welcome, {employeeName || 'Loading...'}</h1>
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Check In/Out Card */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Present Days</p>
                <p className="text-2xl font-bold">{presentDays}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Late Days</p>
                <p className="text-2xl font-bold">{lateDays}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Absent Days</p>
                <p className="text-2xl font-bold">{absentDays}</p>
              </div>
              <UserX className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <XAxis dataKey="date" />
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
                <XAxis dataKey="day" />
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
    </div>
  );
};

export default EmployeeDashboard;
