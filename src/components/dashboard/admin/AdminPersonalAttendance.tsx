// components/dashboard/admin/AdminPersonalAttendance.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Timer, GraduationCap, User } from 'lucide-react';
import ClassCheckInModal from '../employee/ClassCheckInModal';
import ClassStatusCard from '../employee/ClassStatusCard';
import { useClassAttendance } from '@/hooks/useClassAttendance';

interface AdminPersonalAttendanceProps {
  employee_id: string | null;
  userRole?: string | null;
  isAdminTrainer?: boolean;
}

const AdminPersonalAttendance: React.FC<AdminPersonalAttendanceProps> = ({
  employee_id,
  userRole,
  isAdminTrainer = false
}) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [todayHours, setTodayHours] = useState('-');
  const [showClassModal, setShowClassModal] = useState(false);
  const { toast } = useToast();

  // Class attendance functionality for admin-trainers
  const {
    isClassLoading,
    activeClassSessions,
    todayClassHours,
    hasActiveSession,
    activeSessionName,
    handleClassCheckIn,
    handleClassCheckOut
  } = useClassAttendance(employee_id);

 // Update your fetchPersonalAttendanceStatus in AdminPersonalAttendance.tsx:

const fetchPersonalAttendanceStatus = async () => {
  if (!employee_id) return;

  try {
    // Try the status endpoint first (for admin compatibility)
    let response = await fetch('/api/attendance/status', {
      method: 'GET',
      credentials: 'include',
    });

    // If status endpoint doesn't work, try the main attendance endpoint
    if (!response.ok) {
      response = await fetch('/api/attendance', {
        method: 'GET',
        credentials: 'include',
      });
    }

    if (response.ok) {
      const data = await response.json();
      
      // 🔍 DEBUG: Log the API response
      console.log('=== ADMIN FRONTEND DEBUG ===');
      console.log('API Response:', data);
      console.log('User role:', data.role);
      console.log('isCheckedIn from API:', data.isCheckedIn);
      console.log('personalAttendance:', data.personalAttendance);
      console.log('attendanceData:', data.attendanceData);
      console.log('=== END ADMIN FRONTEND DEBUG ===');
      
      setIsCheckedIn(data.isCheckedIn || false);
      
      // Calculate today's hours
      const attendanceToCheck = data.personalAttendance || data.attendanceData;
      if (attendanceToCheck && attendanceToCheck.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = attendanceToCheck.find((record: any) => 
          record.date.startsWith(today)
        );
        
        if (todayRecord) {
          console.log('Today record found:', todayRecord);
          let hours = 0;
          if (todayRecord.sessions && Array.isArray(todayRecord.sessions)) {
            hours = calculateTotalHoursFromSessions(todayRecord.sessions);
          } else if (todayRecord.check_in_time) {
            const checkIn = new Date(todayRecord.check_in_time);
            const checkOut = todayRecord.check_out_time ? new Date(todayRecord.check_out_time) : new Date();
            hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          }
          
          const hoursInt = Math.floor(hours);
          const minutes = Math.floor((hours - hoursInt) * 60);
          setTodayHours(`${hoursInt}h ${minutes}m`);
          console.log('Calculated hours:', `${hoursInt}h ${minutes}m`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching personal attendance:', error);
  }
};

  const calculateTotalHoursFromSessions = (sessions: any[]): number => {
    if (!sessions || sessions.length === 0) return 0;
    
    let totalMinutes = 0;
    sessions.forEach(session => {
      if (session.check_in) {
        const checkIn = new Date(session.check_in);
        const checkOut = session.check_out ? new Date(session.check_out) : new Date();
        const diffInMs = checkOut.getTime() - checkIn.getTime();
        const diffInMinutes = Math.max(0, Math.floor(diffInMs / (1000 * 60)));
        totalMinutes += diffInMinutes;
      }
    });
    
    return totalMinutes / 60;
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

      setIsCheckedIn(action === 'check-in');
      await fetchPersonalAttendanceStatus();

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

  const handleClassCheckInClick = () => {
    setShowClassModal(true);
  };

  const handleClassCheckInSubmit = (classId: number) => {
    handleClassCheckIn(classId);
    setShowClassModal(false);
  };

  useEffect(() => {
    fetchPersonalAttendanceStatus();
    
    // Refresh every 5 minutes for personal attendance
    const interval = setInterval(fetchPersonalAttendanceStatus, 300000);
    return () => clearInterval(interval);
  }, [employee_id]);

  return (
    <div className="space-y-4">
      {/* Work Attendance Card */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <CardTitle className="text-white flex items-center">
            <User className="w-5 h-5 mr-2" />
            Your Personal Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Work Attendance Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Work Attendance</h3>
              <div className="flex space-x-3 mb-4">
                <Button
                  size="lg"
                  onClick={() => handleAttendance('check-in')}
                  disabled={isCheckedIn || isLoading}
                  className={`flex-1 transform hover:scale-105 transition-transform duration-200 ${
                    isCheckedIn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Check In'}
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleAttendance('check-out')}
                  disabled={!isCheckedIn || isLoading}
                  className={`flex-1 transform hover:scale-105 transition-transform duration-200 ${
                    !isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Check Out'}
                </Button>
              </div>
              
              {/* Today's Work Hours */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Work Hours Today</p>
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
            </div>

            {/* Class Attendance Section - Only for admin-trainers */}
            {isAdminTrainer && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Class Training</h3>
                <div className="flex justify-center mb-4">
                  <Button
                    size="lg"
                    onClick={handleClassCheckInClick}
                    disabled={!isCheckedIn || isClassLoading}
                    className={`w-full transform hover:scale-105 transition-transform duration-200 ${
                      !isCheckedIn 
                        ? 'bg-gray-400' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {isClassLoading ? 'Processing...' : 'Check into Class'}
                  </Button>
                </div>
                
                {!isCheckedIn && (
                  <p className="text-xs text-gray-500 text-center mb-3">
                    Check into work first to access classes
                  </p>
                )}

                {/* Today's Class Hours */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Class Hours Today</p>
                  <div className="flex items-center justify-center space-x-2">
                    <GraduationCap className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {todayClassHours}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Class Sessions - Only show if admin has active sessions */}
      {isAdminTrainer && activeClassSessions.length > 0 && (
        <ClassStatusCard
          activeClassSessions={activeClassSessions}
          todayClassHours={todayClassHours}
          onClassCheckOut={handleClassCheckOut}
          isLoading={isClassLoading}
        />
      )}

      {/* Class Check-in Modal */}
      {isAdminTrainer && (
        <ClassCheckInModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          onCheckIn={handleClassCheckInSubmit}
          isLoading={isClassLoading}
          hasActiveSession={hasActiveSession}
          activeSessionName={activeSessionName}
        />
      )}
    </div>
  );
};

export default AdminPersonalAttendance;
