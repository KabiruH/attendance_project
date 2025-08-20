// components/dashboard/AttendanceCard.tsx
'use client';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, GraduationCap } from 'lucide-react';
import ClassCheckInModal from './ClassCheckInModal';

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
  activeSessionName = ''
}) => {
  const [showClassModal, setShowClassModal] = useState(false);

  // Check if user is a trainer (adjust role check based on your schema)
  const isTrainer = userRole == 'admin' || userRole == 'employee'; // Adjust as needed

  const handleClassCheckInClick = () => {
    setShowClassModal(true);
  };

  const handleClassCheckIn = (classId: number) => {
    if (onClassCheckIn) {
      onClassCheckIn(classId);
    }
    setShowClassModal(false);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-white via-gray-200 to-gray-300">
          <CardTitle className="font-bold text-slate-900">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          {/* Work Attendance Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Work Attendance</h3>
            <div className="flex justify-center space-x-4 mb-4">
              <Button
                size="lg"
                onClick={onCheckIn}
                disabled={isCheckedIn || isLoading}
                className={`w-32 font-bold ${
                  isCheckedIn ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Processing...' : 'Check In'}
              </Button>
              <Button
                size="lg"
                onClick={onCheckOut}
                disabled={!isCheckedIn || isLoading}
                className={`w-32 font-bold ${
                  !isCheckedIn ? 'bg-gray-400' : 'bg-red-600 hover:bg-slate-900'
                }`}
              >
                {isLoading ? 'Processing...' : 'Check Out'}
              </Button>
            </div>
           
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
                    disabled={!isCheckedIn || isClassLoading}
                    className={`w-40 font-bold ${
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
                  <p className="text-xs text-gray-500 text-center mt-2">
                    You must check into work first
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
        />
      )}
    </>
  );
};

export default AttendanceCard;