'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface EmployeeDashboardProps {
  data: unknown; // Use unknown if you don't know the type yet
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ data }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<any[]>([]); // Store weekly hours
  const { toast } = useToast();
  const currentTime = new Date().toLocaleTimeString();


  // Fetch logged-in user data
  const fetchLoggedInUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/employees/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        setEmployeeName(user.name);
        setEmployeeId(user.id);
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch user data.',
        variant: 'destructive',
      });
    }
  };

  // Fetch attendance status
  const fetchAttendanceStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch('/api/attendance/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setIsCheckedIn(data.isCheckedIn);
        setAttendanceData(data.attendanceData || []);
      }
    } catch (error) {
      console.error('Failed to fetch attendance status:', error);
    }
  };

  useEffect(() => {
    fetchAttendanceStatus();
  }, []);

  const handleAttendance = async (action: 'check-in' | 'check-out') => {
    try {
        const token = localStorage.getItem('token'); 
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ action }),
            credentials: 'include' 
        });
console.log(response)
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process attendance');
        }
        console.log('Cookie value:', document.cookie)

        const data = await response.json();

        setIsCheckedIn(action === 'check-in');
        toast({
            title: 'Success',
            description: `Successfully ${action === 'check-in' ? 'checked in' : 'checked out'}`,
        });

        // Refresh attendance data
        fetchAttendanceStatus();
    } catch (error) {
        console.error('Attendance error:', error);
        toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to process attendance',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
};


  // Calculate statistics from attendance data
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.reduce((acc: number, day: any) => acc + (day.present ? 1 : 0), 0);
  const lateDays = attendanceData.reduce((acc: number, day: any) => acc + (day.late ? 1 : 0), 0);
  const absentDays = attendanceData.reduce((acc: number, day: any) => acc + (day.absent ? 1 : 0), 0);

  // Fetch weekly hours worked by the employee
  const fetchWeeklyHours = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/weekly-hours?employee_id=${employee_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWeeklyHours(data.weeklyHours); // Assuming the response contains weekly hours data
      }
    } catch (error) {
      console.error('Failed to fetch weekly hours:', error);
    }
  };

  // Check initial status when component mounts
  useEffect(() => {
    fetchLoggedInUser(); // Fetch logged-in user's data
    fetchAttendanceStatus(); // Fetch attendance data
  }, []);

  // Fetch weekly hours when the employee is fetched
  useEffect(() => {
    if (employee_id) {
      fetchWeeklyHours(); // Fetch weekly hours for the logged-in employee
    }
  }, [employee_id]);

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
