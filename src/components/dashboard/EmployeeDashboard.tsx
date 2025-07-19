// components/dashboard/EmployeeDashboard.tsx
'use client';
import React from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import WelcomeHeader from './WelcomeHeader';
import AttendanceCard from './AttendanceCard';
import StatisticsCards from './StatisticsCards';
import AttendanceCharts from './AttendanceCharts';
import ClassStatusCard from './ClassStatusCard';

interface EmployeeDashboardProps {
  data?: {
    id: number;
    email: string;
    name: string;
    role: string;
  }
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ data }) => {
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
      
      {/* Charts section */}
      <AttendanceCharts
        attendanceData={attendanceData}
        weeklyHours={weeklyHours}
      />
    </div>
  );
};

export default EmployeeDashboard;