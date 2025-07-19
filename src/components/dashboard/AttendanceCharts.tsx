// components/dashboard/AttendanceCharts.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, XAxis, YAxis, Bar, Line, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartDataPoint, WeeklyHoursDataPoint } from '../../lib/types/dashboard';

interface AttendanceChartsProps {
  attendanceData: ChartDataPoint[];
  weeklyHours: WeeklyHoursDataPoint[];
}

const AttendanceCharts: React.FC<AttendanceChartsProps> = ({
  attendanceData,
  weeklyHours
}) => {
  const tooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px',
    border: 'none',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Monthly Attendance Overview */}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="present" fill="#2563eb" name="Present" />
              <Bar dataKey="late" fill="#eab308" name="Late" />
              <Bar dataKey="absent" fill="#dc2626" name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Hours Worked */}
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
              <Tooltip contentStyle={tooltipStyle} />
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
  );
};

export default AttendanceCharts;