// components/dashboard/ClassStatusCard.tsx
'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Clock, LogOut } from 'lucide-react';

interface ActiveClassSession {
  id: number;
  class_id: number;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  auto_checkout: boolean;
  class: {
    id: number;
    name: string;
    code: string;
    department: string;
    duration_hours: number;
  };
}

interface ClassStatusCardProps {
  activeClassSessions: ActiveClassSession[];
  todayClassHours: string;
  onClassCheckOut: (attendanceId: number) => void;
  isLoading?: boolean;
}

const ClassStatusCard: React.FC<ClassStatusCardProps> = ({
  activeClassSessions,
  todayClassHours,
  onClassCheckOut,
  isLoading = false
}) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-KE', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (checkInTime: string) => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - checkIn.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getRemainingTime = (checkInTime: string, durationHours: number) => {
    const checkIn = new Date(checkInTime);
    // Cap duration at 2 hours maximum
    const effectiveDuration = Math.min(durationHours, 2);
    const autoCheckoutTime = new Date(checkIn.getTime() + (effectiveDuration * 60 * 60 * 1000));
    const now = new Date();
    const remaining = autoCheckoutTime.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Auto-checkout reached';
    
    const remainingMinutes = Math.floor(remaining / (1000 * 60));
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    
    if (hours === 0) return `${minutes}m remaining`;
    return `${hours}h ${minutes}m remaining`;
  };

  if (activeClassSessions.length === 0) {
    return null; // Don't show the card if no active sessions
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-green-50 via-green-100 to-green-200">
        <CardTitle className="font-bold text-green-900 flex items-center space-x-2">
          <GraduationCap className="w-5 h-5" />
          <span>Active Classes</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        <div className="space-y-4">
          {activeClassSessions.map((session) => (
            <div
              key={session.id}
              className="border rounded-lg p-4 bg-green-50 border-green-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {session.class.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {session.class.code} • {session.class.department}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Started {formatTime(session.check_in_time)}</span>
                  </span>
                  <span className="text-green-600 font-medium">
                    {calculateDuration(session.check_in_time)}
                  </span>
                  {session.auto_checkout && (
                    <span className="text-blue-600 text-xs">
                      {getRemainingTime(session.check_in_time, session.class.duration_hours)}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onClassCheckOut(session.id)}
                  disabled={isLoading}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <LogOut className="w-3 h-3 mr-1" />
                  Early Check Out
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Today's Class Hours Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Today's Class Hours</p>
            <div className="flex items-center justify-center space-x-2">
              <GraduationCap className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                {todayClassHours}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClassStatusCard;