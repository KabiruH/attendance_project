import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Fingerprint, 
  MapPin, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Building2,
  GraduationCap 
} from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { checkLocation } from '@/lib/geofence';

// Types
interface ClassAssignment {
  id: number;
  class: {
    id: number;
    name: string;
    code: string;
    description: string;
    department: string;
    duration_hours: number;
    is_active: boolean;
  };
}

interface ClassAttendance {
  id: number;
  class_id: number;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  auto_checkout: boolean;
}

interface AttendanceStatus {
  isCheckedIn: boolean;
  attendanceData: any[];
  role: string;
}

export default function BiometricCheckin() {
  const { toast } = useToast();
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [workStatus, setWorkStatus] = useState<AttendanceStatus | null>(null);
  const [classAssignments, setClassAssignments] = useState<ClassAssignment[]>([]);
  const [todayClassAttendance, setTodayClassAttendance] = useState<ClassAttendance[]>([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [username, setUsername] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

  // Check work attendance status
  const checkWorkStatus = async () => {
    try {
      const response = await fetch('/api/attendance');
      const data = await response.json();
      if (data.success) {
        setWorkStatus(data);
      }
    } catch (error) {
      console.error('Error checking work status:', error);
    }
  };

  // Check class assignments and attendance - only works if logged in
  const checkClassStatus = async () => {
    try {
      const response = await fetch('/api/attendance/class-checkin');
      const data = await response.json();
      if (data.success) {
        setClassAssignments(data.assignments || []);
        setTodayClassAttendance(data.todayAttendance || []);
      }
    } catch (error) {
      // Class assignments require full login - ignore error for now
      console.log('Class assignments require login');
    }
  };

  // Check biometric availability
  const checkBiometricAvailability = async () => {
    try {
      if (!window.PublicKeyCredential) {
        setBiometricAvailable(false);
        return;
      }
      
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setBiometricAvailable(available);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
    }
  };

  // Load initial data
  useEffect(() => {
    checkBiometricAvailability();
    checkWorkStatus();
    checkClassStatus();
  }, []);

  // Verify location before any check-in
  const verifyLocation = async (): Promise<boolean> => {
    setIsLoadingLocation(true);
    try {
      const isLocationValid = await checkLocation();
      if (!isLocationValid) {
        toast({
          title: "Location Error",
          description: "You must be within the allowed area to check in.",
          variant: "destructive"
        });
        return false;
      }
      return true;
    } catch (error) {
      toast({
        title: "Location Check Failed",
        description: "Please enable location access and try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Handle biometric work attendance (the main function)
  const handleBiometricWorkAction = async (action: 'check-in' | 'check-out') => {
    if (!username.trim()) {
      toast({
        title: "Enter ID Number",
        description: "Please enter your ID number first",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. Verify location first
      const locationValid = await verifyLocation();
      if (!locationValid) return;

      // 2. Generate WebAuthn options
      const optionsResponse = await fetch('/api/webauthn/generate-authentication-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.error || 'Failed to generate authentication options');
      }

      const options = await optionsResponse.json();

      // 3. Start biometric authentication immediately
      const authResponse = await startAuthentication({ 
        optionsJSON: options,
        useBrowserAutofill: false
      });

      // 4. Send both biometric auth and attendance action in one call
      const attendanceResponse = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          username: username.trim(),
          authenticationResponse: authResponse
        })
      });

      const result = await attendanceResponse.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: `${result.message || `Work ${action} successful`}`,
          variant: "default"
        });
        
        // Refresh status
        await checkWorkStatus();
        await checkClassStatus();
      } else {
        throw new Error(result.error || `Work ${action} failed`);
      }

    } catch (error: any) {
      let errorMessage = 'Authentication failed';
      
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Biometric authentication was cancelled. Please try again.';
      } else if (error?.name === 'InvalidStateError') {
        errorMessage = 'This device is not registered for biometric authentication.';
      } else if (error?.name === 'NotSupportedError') {
        errorMessage = 'Biometric authentication is not supported on this device.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle class check-in
  const handleClassCheckin = async (classId: number) => {
    setIsLoading(true);
    setShowClassModal(false);
    
    try {
      // Verify location first
      const locationValid = await verifyLocation();
      if (!locationValid) return;

      const response = await fetch('/api/attendance/class-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          class_id: classId,
          action: 'check-in'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "Class check-in successful",
          variant: "default"
        });
        
        // Refresh class status
        await checkClassStatus();
      } else {
        throw new Error(result.error || 'Class check-in failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Class check-in failed',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get available classes for check-in
  const getAvailableClasses = () => {
    const checkedInClassIds = todayClassAttendance.map(attendance => attendance.class_id);
    return classAssignments.filter(assignment => 
      !checkedInClassIds.includes(assignment.class.id) && assignment.class.is_active
    );
  };

  // Get current active class sessions
  const getActiveClassSessions = () => {
    const now = new Date();
    return todayClassAttendance.filter(attendance => {
      if (!attendance.check_out_time) return true;
      if (attendance.auto_checkout && new Date(attendance.check_out_time) > now) {
        return true;
      }
      return false;
    });
  };

  const activeClassSessions = getActiveClassSessions();
  const availableClasses = getAvailableClasses();
  const isLoggedIn = workStatus?.role === 'employee' || workStatus?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Biometric Attendance</h1>
          <p className="text-gray-600">Use your fingerprint or face ID to check in</p>
        </div>

        {/* ID Number Input */}
        <Card className="bg-white shadow-lg">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="idNumber" className="block text-sm font-medium mb-2">
                  Enter your ID Number
                </label>
                <input
                  id="idNumber"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 30257882"
                  disabled={isLoading}
                />
              </div>
              {biometricAvailable === false && (
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Biometric authentication is not available on this device
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Work Attendance Card */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Work Attendance
            </CardTitle>
            <CardDescription>
              Check in/out for your work shift using biometrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${workStatus?.isCheckedIn ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Clock className={`h-4 w-4 ${workStatus?.isCheckedIn ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="font-medium">
                    {workStatus?.isCheckedIn ? 'Checked In' : 'Not Checked In'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {workStatus?.isCheckedIn ? 'You are currently at work' : 'Ready to start your shift'}
                  </p>
                </div>
              </div>
              <Badge variant={workStatus?.isCheckedIn ? "default" : "secondary"}>
                {workStatus?.isCheckedIn ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleBiometricWorkAction('check-in')}
                disabled={isLoading || isLoadingLocation || biometricAvailable === false || !username.trim()}
                className="h-12 text-lg font-medium"
                variant="default"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Fingerprint className="h-5 w-5 mr-2" />
                )}
                Biometric Check-in
              </Button>

              <Button
                onClick={() => handleBiometricWorkAction('check-out')}
                disabled={isLoading || isLoadingLocation || biometricAvailable === false || !username.trim() || !workStatus?.isCheckedIn}
                className="h-12 text-lg font-medium"
                variant="outline"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Fingerprint className="h-5 w-5 mr-2" />
                )}
                Biometric Check-out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Class Attendance Card - Only show if logged in */}
        {isLoggedIn && (
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Class Attendance
              </CardTitle>
              <CardDescription>
                Check into your assigned classes (requires dashboard login)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active Class Sessions */}
              {activeClassSessions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">Active Class Sessions</h4>
                  {activeClassSessions.map((session) => {
                    const classInfo = classAssignments.find(a => a.class.id === session.class_id)?.class;
                    return (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium text-green-900">{classInfo?.name}</p>
                            <p className="text-sm text-green-700">
                              Checked in at {new Date(session.check_in_time).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Class Check-in Button */}
              <Button
                onClick={() => setShowClassModal(true)}
                disabled={isLoading || isLoadingLocation || !workStatus?.isCheckedIn || availableClasses.length === 0}
                className="w-full h-12 text-lg font-medium"
                variant="outline"
              >
                <GraduationCap className="h-5 w-5 mr-2" />
                Check into Class
              </Button>

              {!workStatus?.isCheckedIn && (
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Check into work first to access class check-in
                </p>
              )}

              {availableClasses.length === 0 && workStatus?.isCheckedIn && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  No available classes to check into
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Location Status */}
        <Card className="bg-white shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isLoadingLocation ? 'bg-yellow-100' : 'bg-green-100'}`}>
                {isLoadingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
                ) : (
                  <MapPin className="h-4 w-4 text-green-600" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {isLoadingLocation ? 'Verifying Location...' : 'Location Verified'}
                </p>
                <p className="text-sm text-gray-600">
                  {isLoadingLocation ? 'Checking if you are in the allowed area' : 'You are in the allowed area'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Class Selection Modal */}
      <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Select Class to Check Into
            </DialogTitle>
            <DialogDescription>
              Choose which class you want to check into
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableClasses.map((assignment) => (
              <Button
                key={assignment.id}
                onClick={() => handleClassCheckin(assignment.class.id)}
                variant="outline"
                className="w-full justify-start p-4 h-auto"
                disabled={isLoading}
              >
                <div className="text-left space-y-1">
                  <div className="font-medium">{assignment.class.name}</div>
                  <div className="text-sm text-gray-600">{assignment.class.code}</div>
                  <div className="text-sm text-gray-500">
                    {assignment.class.department} • {assignment.class.duration_hours}h
                  </div>
                  {assignment.class.description && (
                    <div className="text-xs text-gray-500 mt-1">
                      {assignment.class.description}
                    </div>
                  )}
                </div>
              </Button>
            ))}
            
            {availableClasses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No available classes to check into</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}