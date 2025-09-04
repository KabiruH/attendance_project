// components/dashboard/ClassCheckInModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, GraduationCap, Calendar } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ClassAssignment {
  id: number;
  class: {
    id: number;
    name: string;
    code: string;
    description?: string;
    department: string;
    duration_hours: number;
  };
  assigned_at: string;
  is_active: boolean;
}

interface TodayClassAttendance {
  id: number;
  class_id: number;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  auto_checkout: boolean;
}

interface ClassCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (classId: number) => void;
  isLoading: boolean;
  hasActiveSession?: boolean;
  activeSessionName?: string;
  employeeId?: string | null;
}

const ClassCheckInModal: React.FC<ClassCheckInModalProps> = ({
  isOpen,
  onClose,
  onCheckIn,
  isLoading,
  hasActiveSession = false,
  activeSessionName = '',
  employeeId,
}) => {
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<TodayClassAttendance[]>([]);
  const [fetchingClasses, setFetchingClasses] = useState(false);
  const { toast } = useToast();

const fetchAssignedClasses = async () => {
  setFetchingClasses(true);
  try {
    // Include employeeId in the request
    const url = employeeId 
      ? `/api/attendance/class-checkin?employee_id=${employeeId}`
      : '/api/attendance/class-checkin';
    
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch assigned classes');
    }

    const data = await response.json();
    
    
    // The class-checkin endpoint returns assignments, not classes
    setClasses(data.assignments || []);
    setTodayAttendance(data.todayAttendance || []);
  } catch (error) {
    console.error('Error fetching classes:', error);
    toast({
      title: 'Error',
      description: 'Failed to load your assigned classes',
      variant: 'destructive',
    });
  } finally {
    setFetchingClasses(false);
  }
};

  useEffect(() => {
    if (isOpen) {
      fetchAssignedClasses();
    }
  }, [isOpen]);

  const handleClassCheckOut = async (attendanceId: number) => {
    try {
      const response = await fetch('/api/attendance/class-checkin', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'check-out',
          attendance_id: attendanceId 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check out of class');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: result.message || 'Successfully checked out of class',
      });

      // Refresh the attendance data
      fetchAssignedClasses();
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: 'Error',
        description: 'Failed to check out of class',
        variant: 'destructive',
      });
    }
  };

  const isCheckedInToClass = (classId: number) => {
    const now = new Date();
    return todayAttendance.find(att => {
      if (att.class_id !== classId) return false;
      
      // If no checkout time, definitely checked in
      if (!att.check_out_time) return true;
      
      // If auto-checkout and time hasn't passed yet, still checked in
      if (att.auto_checkout && new Date(att.check_out_time) > now) {
        return true;
      }
      
      // Otherwise not checked in
      return false;
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5" />
            <span>Check into Class</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Active Session Warning */}
          {hasActiveSession && (
            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <p className="text-sm text-orange-800">
                  <strong>Active Session:</strong> You are currently checked into {activeSessionName}. 
                  You must check out first before joining another class.
                </p>
              </div>
            </div>
          )}

          {fetchingClasses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading your classes...</span>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No classes assigned to you</p>
              <p className="text-sm">Contact your administrator to get assigned to classes</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {classes.map((assignment) => {
                const attendanceRecord = isCheckedInToClass(assignment.class.id);
                const isCheckedIn = !!attendanceRecord;
                
                return (
                  <div
                    key={assignment.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {assignment.class.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {assignment.class.code} • {assignment.class.department}
                        </p>
                        {assignment.class.description && (
                          <p className="text-xs text-gray-500 mt-1">
                            {assignment.class.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={isCheckedIn ? "default" : "secondary"}>
                        {isCheckedIn ? "Checked In" : "Available"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{assignment.class.duration_hours}h</span>
                        </span>
                        {isCheckedIn && attendanceRecord && (
                          <span className="text-green-600 font-medium">
                            Since {formatTime(attendanceRecord.check_in_time)}
                          </span>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        {isCheckedIn ? (
                          <div className="flex flex-col space-y-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleClassCheckOut(attendanceRecord!.id)}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Early Check Out
                            </Button>
                            {attendanceRecord?.auto_checkout && (
                              <span className="text-xs text-gray-500 text-center">
                                Auto-checkout in {assignment.class.duration_hours}h
                              </span>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => onCheckIn(assignment.class.id)}
                            disabled={isLoading || hasActiveSession}
                            className={`bg-green-600 hover:bg-green-700 ${
                              hasActiveSession ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Check In'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-checkout info */}
          {classes.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                <strong>Important:</strong>
              </p>
              <ul className="text-xs text-blue-700 mt-1 space-y-1">
                <li>• Classes have a maximum duration of 2 hours</li>
                <li>• You'll be automatically checked out after the class duration (max 2h)</li>
                <li>• You can only be checked into one class at a time</li>
                <li>• Use "Early Check Out" if you need to leave before the scheduled time</li>
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClassCheckInModal;