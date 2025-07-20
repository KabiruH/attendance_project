// components/dashboard/AdminDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Clock, Settings, Users, GraduationCap } from 'lucide-react';
import AdminPersonalAttendance from './admin/AdminPersonalAttendance';
import AdminSummaryCards from './admin/AdminSummaryCards';
import AdminAttendanceAnalytics from './admin/AdminAttendanceAnalytics';
import AdminEmployeeTable from './admin/AdminEmployeeTable';
import AdminClassOverview from './admin/AdminClassOverview';
import AdminClassAnalytics from './admin/AdminClassAnalytics';

interface AdminDashboardProps {
  data: unknown;
}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [currentView, setCurrentView] = useState<'attendance' | 'classes'>('attendance');
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [employee_id, setEmployeeId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
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
      setUserRole(user.role);

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Authentication Error',
        description: error instanceof Error ? error.message : 'Failed to authenticate',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchTokenAndUser();
  }, []);

  // Check if admin is also a trainer
  const isAdminTrainer = userRole === 'admin' || userRole === 'manager'; // Adjust as needed

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6 space-y-6">
      {/* Header with Welcome, Clock and View Switcher */}
      <div className="flex justify-between items-center bg-white rounded-lg p-4 shadow-lg">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Welcome, {employeeName || 'Admin'}
        </h1>
        
        <div className="flex items-center space-x-4">
          {/* View Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={currentView === 'attendance' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('attendance')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Work Attendance</span>
            </Button>
            <Button
              variant={currentView === 'classes' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('classes')}
              className="flex items-center space-x-2"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Class Management</span>
            </Button>
          </div>
          
          {/* Clock */}
          <div className="flex items-center space-x-2 text-lg font-semibold text-gray-700">
            <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* Personal Attendance Card - Always visible */}
      <AdminPersonalAttendance 
        employee_id={employee_id}
        userRole={userRole}
        isAdminTrainer={isAdminTrainer}
      />

      {/* Conditional Content based on view */}
      {currentView === 'attendance' ? (
        <>
          {/* Work Attendance Overview */}
          <AdminSummaryCards />
          <AdminAttendanceAnalytics />
          <AdminEmployeeTable />
        </>
      ) : (
        <>
          {/* Class Management Overview */}
          <AdminClassOverview />
          <AdminClassAnalytics />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;