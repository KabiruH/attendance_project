'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, UserCheck, UserX, AlertTriangle, Timer } from 'lucide-react';
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
  const [rawAttendanceData, setRawAttendanceData] = useState<AttendanceRecord[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHoursDataPoint[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [todayCheckIn, setTodayCheckIn] = useState<string | null>(null);
  const [todayHours, setTodayHours] = useState<string>('-');
  const { toast } = useToast();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      // Update today's hours if checked in
      if (isCheckedIn && todayCheckIn) {
        setTodayHours(calculateTodayHours(todayCheckIn, null));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isCheckedIn, todayCheckIn]);

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

  // Function to calculate today's hours worked
  const calculateTodayHours = (checkInTime: string | null, checkOutTime: string | null) => {
    if (!checkInTime) return '-';
    
    const checkIn = new Date(checkInTime);
    const checkOut = checkOutTime ? new Date(checkOutTime) : new Date();
    
    const diffInMs = checkOut.getTime() - checkIn.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 0) return '-';
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    
    if (!checkOutTime) {
      return `${hours}h ${minutes}m`;
    }
    
    return `${hours}h ${minutes}m`;
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
      
      // Store raw attendance data
      setRawAttendanceData(data.attendanceData || []);
      
      // Check if there's a record for today with check_in but no check_out
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = data.attendanceData.find((record: AttendanceRecord) => 
        record.date.startsWith(today) && 
        record.check_in_time && 
        !record.check_out_time
      );

      setIsCheckedIn(!!todayRecord);
      
      // Store today's check-in time for live hours calculation
      if (todayRecord) {
        setTodayCheckIn(todayRecord.check_in_time);
        setTodayHours(calculateTodayHours(todayRecord.check_in_time, null));
      } else {
        // Check if there's a completed record for today
        const completedTodayRecord = data.attendanceData.find((record: AttendanceRecord) => 
          record.date.startsWith(today) && 
          record.check_in_time && 
          record.check_out_time
        );
        
        if (completedTodayRecord) {
          setTodayCheckIn(null);
          setTodayHours(calculateTodayHours(completedTodayRecord.check_in_time, completedTodayRecord.check_out_time));
        } else {
          setTodayCheckIn(null);
          setTodayHours('-');
        }
      }

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
  const { presentDays, lateDays, absentDays, totalHoursThisMonth } = React.useMemo(() => {
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate total hours for current month from raw attendance data
    let totalMonthlyHours = 0;
    
    rawAttendanceData.forEach((record: AttendanceRecord) => {
      const recordDate = new Date(record.date);
      
      // Check if record is from current month and year
      if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
        if (record.check_in_time) {
          const checkIn = new Date(record.check_in_time);
          let checkOut: Date;
          
          // If no check_out_time and it's today, use current time
          if (!record.check_out_time) {
            const today = new Date().toISOString().split('T')[0];
            const recordDay = record.date.split('T')[0];
            
            if (recordDay === today) {
              checkOut = new Date(); // Current time for ongoing session
            } else {
              return; // Skip incomplete past records
            }
          } else {
            checkOut = new Date(record.check_out_time);
          }
          
          const diffInMs = checkOut.getTime() - checkIn.getTime();
          const hours = diffInMs / (1000 * 60 * 60);
          
          if (hours > 0) {
            totalMonthlyHours += hours;
          }
        }
      }
    });
    
    return {
      presentDays: attendanceData.reduce((sum, day) => sum + day.present, 0),
      lateDays: attendanceData.reduce((sum, day) => sum + day.late, 0),
      absentDays: attendanceData.reduce((sum, day) => sum + day.absent, 0),
      totalHoursThisMonth: totalMonthlyHours.toFixed(1)
    };
  }, [attendanceData, weeklyHours, rawAttendanceData]);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-md">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome, <span className="text-blue-600">{employeeName || 'Loading...'}</span>
        </h1>
        <div className="flex items-center space-x-2 text-lg font-bold text-slate-900">
          <Clock className="w-6 h-6 text-blue-600" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Check In/Out Card */}
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-300">
          <CardTitle className="font-bold text-slate-900">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          <div className="flex justify-center space-x-4 mb-4">
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
          </div>
          
          {/* Today's Hours Display */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Today's Hours</p>
            <div className="flex items-center justify-center space-x-2">
              <Timer className="w-5 h-5 text-blue-600" />
              <span className={`text-2xl font-bold ${
                isCheckedIn ? 'text-blue-600' : 'text-gray-700'
              }`}>
                {todayHours}
              </span>
              {isCheckedIn && (
                <span className="text-sm text-blue-500">(ongoing)</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Updated Statistics Cards - Now 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="flex items-center justify-between p-4 bg-yellow-500 rounded-lg">
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
            <div className="flex items-center justify-between p-4 bg-red-400 rounded-lg">
              <div>
                <p className="text-sm font-bold text-slate-900">Absent Days</p>
                <p className="text-3xl font-bold text-slate-900">{absentDays}</p>
              </div>
              <UserX className="w-12 h-12 text-red-500" />
            </div>
          </CardContent>
        </Card>

        {/* Monthly Hours Card - Green theme */}
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-green-400 rounded-lg">
              <div>
                <p className="text-sm font-bold text-slate-900">This Month</p>
                <p className="text-2xl font-bold text-slate-900">{totalHoursThisMonth}h</p>
              </div>
              <Timer className="w-12 h-12 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts section */}
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
            <CardTitle className="font-bold text-slate-900">Daily Hours Worked</CardTitle>
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