// components/dashboard/admin/AdminPersonalAttendance.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, GraduationCap, User, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import ClassCheckInModal from '../employee/ClassCheckInModal';
import ClassStatusCard from '../employee/ClassStatusCard';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import { checkLocationWithDistance } from '@/lib/geofence';

interface LocationResult {
  isWithinArea: boolean;
  distanceFromCenter: number;
  distanceFromEdge: number;
  userLocation: { latitude: number; longitude: number };
  formattedDistance: string;
}

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
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>('');
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

  // Check location function
  const checkUserLocation = async () => {
    setLocationLoading(true);
    setLocationError('');
    
    try {
      const result = await checkLocationWithDistance();
      setLocationResult(result);
    } catch (error: any) {
      console.error('Error checking location:', error);
      setLocationError(error.message || 'Could not verify location');
      setLocationResult(null);
    } finally {
      setLocationLoading(false);
    }
  };

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
         
        setIsCheckedIn(data.isCheckedIn || false);
        
        // Calculate today's hours
        const attendanceToCheck = data.personalAttendance || data.attendanceData;
        if (attendanceToCheck && attendanceToCheck.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const todayRecord = attendanceToCheck.find((record: any) => 
            record.date.startsWith(today)
          );
          
          if (todayRecord) {
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
    // Check location before allowing attendance
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: `You must be on campus to mark attendance. Currently ${locationResult?.formattedDistance || 'location unknown'}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!employee_id) throw new Error('Employee ID is missing');

      const response = await fetch('/api/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action, 
          employee_id,
          locationInfo: locationResult // Include location verification
        }),
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
    // Check location before allowing class check-in
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: `You must be on campus to check into classes. Currently ${locationResult?.formattedDistance || 'location unknown'}.`,
        variant: 'destructive',
      });
      return;
    }
    
    setShowClassModal(true);
  };

  const handleClassCheckInSubmit = (classId: number) => {
    // Double-check location before class check-in
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: 'You must be on campus to check into classes.',
        variant: 'destructive',
      });
      return;
    }
    
    handleClassCheckIn(classId);
    setShowClassModal(false);
  };

  const getLocationStatusIcon = () => {
    if (locationLoading) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (locationError) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (!locationResult) return <MapPin className="w-4 h-4 text-gray-500" />;
    return locationResult.isWithinArea 
      ? <MapPin className="w-4 h-4 text-green-600" />
      : <AlertTriangle className="w-4 h-4 text-orange-600" />;
  };

  const getLocationStatusColor = () => {
    if (locationLoading) return 'bg-blue-50 border-blue-200';
    if (locationError) return 'bg-red-50 border-red-200';
    if (!locationResult) return 'bg-gray-50 border-gray-200';
    return locationResult.isWithinArea 
      ? 'bg-green-50 border-green-200' 
      : 'bg-orange-50 border-orange-200';
  };

  const getLocationStatusText = () => {
    if (locationLoading) return 'Checking location...';
    if (locationError) return 'Location unavailable';
    if (!locationResult) return 'Location unknown';
    return locationResult.formattedDistance;
  };

  const canMarkAttendance = locationResult?.isWithinArea && !locationLoading && !locationError;

  useEffect(() => {
    fetchPersonalAttendanceStatus();
    checkUserLocation();
    
    // Refresh every 5 minutes for personal attendance
    const interval = setInterval(() => {
      fetchPersonalAttendanceStatus();
      checkUserLocation();
    }, 300000);
    
    return () => clearInterval(interval);
  }, [employee_id]);

  return (
    <div className="space-y-4">
      {/* Location Status Alert */}
      <Alert className={`${getLocationStatusColor()}`}>
        <div className="flex items-center space-x-2">
          {getLocationStatusIcon()}
          <AlertDescription className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Location Status: {getLocationStatusText()}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkUserLocation}
                disabled={locationLoading}
                className="h-6 px-2"
              >
                <RefreshCw className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {!canMarkAttendance && (
              <p className="text-sm mt-1 text-gray-600">
                You must be on campus to mark attendance or check into classes.
              </p>
            )}
          </AlertDescription>
        </div>
      </Alert>

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
                  disabled={isCheckedIn || isLoading || !canMarkAttendance}
                  className={`flex-1 transform hover:scale-105 transition-transform duration-200 ${
                    isCheckedIn || !canMarkAttendance ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Check In'}
                </Button>
                <Button
                  size="lg"
                  onClick={() => handleAttendance('check-out')}
                  disabled={!isCheckedIn || isLoading || !canMarkAttendance}
                  className={`flex-1 transform hover:scale-105 transition-transform duration-200 ${
                    !isCheckedIn || !canMarkAttendance ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Check Out'}
                </Button>
              </div>
              
              {/* Location warning for attendance */}
              {!canMarkAttendance && (
                <p className="text-xs text-gray-500 text-center mb-3">
                  {locationLoading ? 'Checking location...' : 'Must be on campus to mark attendance'}
                </p>
              )}
              
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
                    disabled={!isCheckedIn || isClassLoading || !canMarkAttendance}
                    className={`w-full transform hover:scale-105 transition-transform duration-200 ${
                      !isCheckedIn || !canMarkAttendance
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

                {!canMarkAttendance && isCheckedIn && (
                  <p className="text-xs text-gray-500 text-center mb-3">
                    Must be on campus to check into classes
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
          employeeId={employee_id} 
        />
      )}
    </div>
  );
};

export default AdminPersonalAttendance;