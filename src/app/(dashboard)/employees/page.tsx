'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const currentTime = new Date().toLocaleTimeString();
  
  // Sample attendance data for the month
  const attendanceData = [
    { date: '1', present: 1, late: 0, absent: 0 },
    { date: '2', present: 0, late: 1, absent: 0 },
    { date: '3', present: 1, late: 0, absent: 0 },
    { date: '4', present: 1, late: 0, absent: 0 },
    { date: '5', present: 0, late: 0, absent: 1 },
    // Add more days as needed
  ];

  // Sample weekly hours data
  const weeklyHours = [
    { day: 'Mon', hours: 8 },
    { day: 'Tue', hours: 7.5 },
    { day: 'Wed', hours: 8 },
    { day: 'Thu', hours: 8.5 },
    { day: 'Fri', hours: 7 },
  ];

  const handleCheckIn = () => {
    setIsCheckedIn(true);
    // Add your check-in logic here
  };

  const handleCheckOut = () => {
    setIsCheckedIn(false);
    // Add your check-out logic here
  };

  // Calculate attendance statistics
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.reduce((acc, day) => acc + day.present, 0);
  const lateDays = attendanceData.reduce((acc, day) => acc + day.late, 0);
  const absentDays = attendanceData.reduce((acc, day) => acc + day.absent, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welcome, Employee Name</h1>
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
            onClick={handleCheckIn}
            disabled={isCheckedIn}
            className={`w-32 ${isCheckedIn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
          >
            Check In
          </Button>
          <Button
            size="lg"
            onClick={handleCheckOut}
            disabled={!isCheckedIn}
            className={`w-32 ${!isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
          >
            Check Out
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

export default Dashboard;