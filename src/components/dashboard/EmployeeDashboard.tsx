// components/dashboard/EmployeeDashboard.tsx
'use client';
import React, { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import WelcomeHeader from './employee/WelcomeHeader';
import AttendanceCard from './employee/AttendanceCard';
import StatisticsCards from './employee/StatisticsCards';
import AttendanceCharts from './employee/AttendanceCharts';
import ClassStatusCard from './employee/ClassStatusCard';
import ClassAnalyticsCards from './employee/ClassAnalyticsCards';
import ClassAnalyticsDashboard from './employee/ClassAnalyticsCards';
import { Button } from "@/components/ui/button";

interface EmployeeDashboardProps {
  data?: {
    id: number;
    email: string;
    name: string;
    role: string;
  }
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ data }) => {
  const [showFullAnalytics, setShowFullAnalytics] = useState(false);
  
  const {
    isCheckedIn,
    isLoading,
    employeeName,
    employee_id,
    attendanceData,
    weeklyHours,
    currentTime,
    todayHours,
    stats,
    handleAttendance
  } = useDashboardData();

  // Add class attendance functionality
  const {
    isClassLoading,
    userRole,
    activeClassSessions,
    todayClassHours,
    hasActiveSession,
    activeSessionName,
    handleClassCheckIn,
    handleClassCheckOut
  } = useClassAttendance(employee_id);

  const handleCheckIn = () => handleAttendance('check-in');
  const handleCheckOut = () => handleAttendance('check-out');

  // Check if user is a trainer (adjust role check based on your schema)
  const isTrainer =  userRole === 'employee' || data?.role === 'trainer' || data?.role === 'employee';

  // Toggle between compact and full analytics view
  if (showFullAnalytics) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Class Training Analytics</h1>
          <Button
            variant="outline"
            onClick={() => setShowFullAnalytics(false)}
          >
            Back to Dashboard
          </Button>
        </div>
        <ClassAnalyticsDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-6">
      {/* Welcome Section */}
      <WelcomeHeader
        employeeName={employeeName}
        currentTime={currentTime}
      />
      
      {/* Check In/Out Card - Now includes class functionality */}
      <AttendanceCard
        isCheckedIn={isCheckedIn}
        isLoading={isLoading}
        todayHours={todayHours}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        // Class attendance props
        userRole={userRole || data?.role}
        onClassCheckIn={handleClassCheckIn}
        onClassCheckOut={handleClassCheckOut}
        isClassLoading={isClassLoading}
        hasActiveSession={hasActiveSession}
        activeSessionName={activeSessionName}
        employeeId={employee_id}
      />

      {/* Active Class Sessions Card - Only show if there are active sessions */}
      {activeClassSessions.length > 0 && (
        <ClassStatusCard
          activeClassSessions={activeClassSessions}
          todayClassHours={todayClassHours}
          onClassCheckOut={handleClassCheckOut}
          isLoading={isClassLoading}
        />
      )}
      
      {/* Statistics Cards */}
      <StatisticsCards stats={stats} />

      {/* Class Analytics - Only show for trainers */}
      {isTrainer && (
        <ClassAnalyticsCards
          userId={employee_id}
          onViewFullAnalytics={() => setShowFullAnalytics(true)}
        />
      )}
      
      {/* Charts section */}
      <AttendanceCharts
        attendanceData={attendanceData}
        weeklyHours={weeklyHours}
      />
    </div>
  );
};

export default EmployeeDashboard;