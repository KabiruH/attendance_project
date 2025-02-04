'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
}

interface ChartDataPoint {
  date: string;
  present: number;
  late: number;
  absent: number;
}

interface WeeklyHoursDataPoint {
  day: string;
  hours: number;
}

interface EmployeeDashboardProps {
  data: {
    id: number;
    email: string;
    name: string;
    role: string;
  }
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({  }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<ChartDataPoint[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursDataPoint[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const { toast } = useToast();

  // Update clock every second
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
      
       // Check if there's a record for today with check_in but no check_out
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = data.attendanceData.find((record: AttendanceRecord) => 
      record.date.startsWith(today) && 
      record.check_in_time && 
      !record.check_out_time
    );

    setIsCheckedIn(!!todayRecord);

      // Process attendance data for charts
      const processedData = data.attendanceData.map((record: AttendanceRecord) => ({
        date: new Date(record.date).toLocaleDateString(),
        present: record.status.toLowerCase() === 'present' ? 1 : 0,
        late: record.status.toLowerCase() === 'late' ? 1 : 0,
        absent: record.status.toLowerCase() === 'absent' ? 1 : 0,
      }));

      // Process weekly hours
      const hoursData = data.attendanceData.map((record: AttendanceRecord) => {
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

      setAttendanceData(processedData);
      setWeeklyHours(hoursData);

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

  // Calculate statistics
  const { presentDays, lateDays, absentDays } = React.useMemo(() => ({
    presentDays: attendanceData.reduce((sum, day) => sum + day.present, 0),
    lateDays: attendanceData.reduce((sum, day) => sum + day.late, 0),
    absentDays: attendanceData.reduce((sum, day) => sum + day.absent, 0)
  }), [attendanceData]);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-6">
      {/* Welcome Section remains the same */}
      <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-md">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome, <span className="text-blue-600">{employeeName || 'Loading...'}</span>
        </h1>
        <div className="flex items-center space-x-2 text-lg font-bold text-slate-900">
          <Clock className="w-6 h-6 text-blue-600" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Check In/Out Card remains the same */}
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-300">
          <CardTitle className="font-bold text-slate-900">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center space-x-4 p-6 bg-white">
          <Button
            size="lg"
            onClick={() => handleAttendance('check-in')}
            disabled={isCheckedIn || isLoading}
            className={`w-32 font-bold ${
              isCheckedIn ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Check In'}
          </Button>
          <Button
            size="lg"
            onClick={() => handleAttendance('check-out')}
            disabled={!isCheckedIn || isLoading}
            className={`w-32 font-bold ${
              !isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-slate-900'
            }`}
          >
            {isLoading ? 'Processing...' : 'Check Out'}
          </Button>
        </CardContent>
      </Card>

      {/* Updated Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Present Days Card - Blue theme */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-blue-200 rounded-lg">
              <div>
                <p className="text-sm font-bold text-slate-900">Present Days</p>
                <p className="text-3xl font-bold text-slate-900">{presentDays}</p>
              </div>
              <UserCheck className="w-12 h-12 text-blue-700" />
            </div>
          </CardContent>
        </Card>

        {/* Late Days Card - Yellow theme */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4  bg-yellow-500 rounded-lg">
              <div>
                <p className="text-sm font-bold text-slate-900">Late Days</p>
                <p className="text-3xl font-bold text-slate-900">{lateDays}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        {/* Absent Days Card - Red theme */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4  bg-red-400 rounded-lg">
              <div>
                <p className="text-sm font-bold text-slate-900">Absent Days</p>
                <p className="text-3xl font-bold text-slate-900">{absentDays}</p>
              </div>
              <UserX className="w-12 h-12 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts section remains the same */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-200">
            <CardTitle className="font-bold text-slate-900">Monthly Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pt-6 bg-white">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
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
                <Bar dataKey="present" fill="#2563eb" name="Present" />
                <Bar dataKey="late" fill="#eab308" name="Late" />
                <Bar dataKey="absent" fill="#dc2626" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-300">
            <CardTitle className="font-bold text-slate-900">Weekly Hours</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pt-6 bg-white">
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

export default EmployeeDashboard;