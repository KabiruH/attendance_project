// components/dashboard/AttendanceCard.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, GraduationCap, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import ClassCheckInModal from './ClassCheckInModal';
import { checkLocationWithDistance } from '@/lib/geofence';

interface LocationResult {
  isWithinArea: boolean;
  distanceFromCenter: number;
  distanceFromEdge: number;
  userLocation: { latitude: number; longitude: number };
  formattedDistance: string;
}

interface AttendanceCardProps {
  isCheckedIn: boolean;
  isLoading: boolean;
  todayHours: string;
  onCheckIn: () => void;
  onCheckOut: () => void;
  userRole?: string;
  onClassCheckIn?: (classId: number) => void;
  onClassCheckOut?: (attendanceId: number) => void;
  isClassLoading?: boolean;
  hasActiveSession?: boolean;
  activeSessionName?: string;
  employeeId?: string | null;
}

const AttendanceCard: React.FC<AttendanceCardProps> = ({
  isCheckedIn,
  isLoading,
  todayHours,
  onCheckIn,
  onCheckOut,
  userRole,
  onClassCheckIn,
  onClassCheckOut,
  isClassLoading = false,
  hasActiveSession = false,
  activeSessionName = '',
  employeeId
}) => {
  const [showClassModal, setShowClassModal] = useState(false);
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>('');
  const { toast } = useToast();

  // Check if user is a trainer (adjust role check based on your schema)
  const isTrainer = userRole == 'admin' || userRole == 'employee';

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

  // Enhanced check-in handler with location verification
  const handleCheckIn = () => {
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: `You must be on campus to check in. Currently ${locationResult?.formattedDistance || 'location unknown'}.`,
        variant: 'destructive',
      });
      return;
    }
    onCheckIn();
  };

  // Enhanced check-out handler with location verification
  const handleCheckOut = () => {
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: `You must be on campus to check out. Currently ${locationResult?.formattedDistance || 'location unknown'}.`,
        variant: 'destructive',
      });
      return;
    }
    onCheckOut();
  };

  const handleClassCheckInClick = () => {
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

  const handleClassCheckIn = (classId: number) => {
    if (!locationResult?.isWithinArea) {
      toast({
        title: 'Location Required',
        description: 'You must be on campus to check into classes.',
        variant: 'destructive',
      });
      return;
    }
    
    if (onClassCheckIn) {
      onClassCheckIn(classId);
    }
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
    checkUserLocation();
    
    // Refresh location every 5 minutes
    const interval = setInterval(checkUserLocation, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-300">
          <CardTitle className="font-bold text-slate-900">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          {/* Location Status */}
          <Alert className={`mb-4 ${getLocationStatusColor()}`}>
            <div className="flex items-center space-x-2">
              {getLocationStatusIcon()}
              <AlertDescription className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    Location: {getLocationStatusText()}
                  </span>
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
                  <p className="text-xs mt-1 text-gray-600">
                    You must be on campus to mark attendance.
                  </p>
                )}
              </AlertDescription>
            </div>
          </Alert>

          {/* Work Attendance Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Work Attendance</h3>
            <div className="flex justify-center space-x-4 mb-4">
              <Button
                size="lg"
                onClick={handleCheckIn}
                disabled={isCheckedIn || isLoading || !canMarkAttendance}
                className={`w-32 font-bold ${
                  isCheckedIn || !canMarkAttendance ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Processing...' : 'Check In'}
              </Button>
              <Button
                size="lg"
                onClick={handleCheckOut}
                disabled={!isCheckedIn || isLoading || !canMarkAttendance}
                className={`w-32 font-bold ${
                  !isCheckedIn || !canMarkAttendance ? 'bg-gray-400' : 'bg-red-600 hover:bg-slate-900'
                }`}
              >
                {isLoading ? 'Processing...' : 'Check Out'}
              </Button>
            </div>

            {/* Location warning for work attendance */}
            {!canMarkAttendance && (
              <p className="text-xs text-gray-500 text-center mb-3">
                {locationLoading ? 'Checking location...' : 'Must be on campus to mark work attendance'}
              </p>
            )}
           
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
          </div>

          {/* Class Attendance Section - Only show for trainers */}
          {isTrainer && (
            <>
              <hr className="my-4 border-gray-200" />
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Class Attendance</h3>
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleClassCheckInClick}
                    disabled={!isCheckedIn || isClassLoading || !canMarkAttendance}
                    className={`w-40 font-bold ${
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
                  <p className="text-xs text-gray-500 text-center mt-2">
                    You must check into work first
                  </p>
                )}

                {!canMarkAttendance && isCheckedIn && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Must be on campus to check into classes
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Class Check-in Modal */}
      {isTrainer && (
        <ClassCheckInModal
          isOpen={showClassModal}
          onClose={() => setShowClassModal(false)}
          onCheckIn={handleClassCheckIn}
          isLoading={isClassLoading}
          hasActiveSession={hasActiveSession}
          activeSessionName={activeSessionName}
          employeeId={employeeId} 
        />
      )}
    </>
  );
};

export default AttendanceCard;