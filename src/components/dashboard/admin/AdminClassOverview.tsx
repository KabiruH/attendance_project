// components/dashboard/admin/AdminClassOverview.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  GraduationCap, 
  Users, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  BookOpen,
  UserCheck,
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface ActiveClassSession {
  id: number;
  trainer_id: number;
  trainer_name: string;
  class_id: number;
  class_name: string;
  class_code: string;
  department: string;
  check_in_time: string;
  check_out_time?: string;
  auto_checkout: boolean;
  duration_hours: number;
}

interface ClassMetrics {
  totalActiveClasses: number;
  totalTrainersInClass: number;
  totalClassHoursToday: number;
  averageSessionLength: number;
  classUtilizationRate: number;
}

interface TrainerClassPerformance {
  trainer_id: number;
  trainer_name: string;
  total_sessions: number;
  total_hours: number;
  classes_taught: string[];
  last_session: string;
  status: 'active' | 'inactive';
}

const AdminClassOverview: React.FC = () => {
  const [activeClassSessions, setActiveClassSessions] = useState<ActiveClassSession[]>([]);
  const [classMetrics, setClassMetrics] = useState<ClassMetrics>({
    totalActiveClasses: 0,
    totalTrainersInClass: 0,
    totalClassHoursToday: 0,
    averageSessionLength: 0,
    classUtilizationRate: 0
  });
  const [trainerPerformance, setTrainerPerformance] = useState<TrainerClassPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');

  const fetchClassOverviewData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/class-overview', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setActiveClassSessions(data.activeClassSessions || []);
        setClassMetrics(data.metrics || {});
        setTrainerPerformance(data.trainerPerformance || []);
      }
    } catch (error) {
      console.error('Error fetching class overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassOverviewData();
    const interval = setInterval(fetchClassOverviewData, 600000);
    return () => clearInterval(interval);
  }, [timeRange]);

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
    const effectiveDuration = Math.min(durationHours, 2); // 2-hour max
    const autoCheckoutTime = new Date(checkIn.getTime() + (effectiveDuration * 60 * 60 * 1000));
    const now = new Date();
    const remaining = autoCheckoutTime.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Auto-checkout reached';
    
    const remainingMinutes = Math.floor(remaining / (1000 * 60));
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    
    if (hours === 0) return `${minutes}m left`;
    return `${hours}h ${minutes}m left`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading class overview...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Class Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Active Classes</p>
                <p className="text-3xl font-bold">{classMetrics.totalActiveClasses}</p>
              </div>
              <BookOpen className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Trainers in Class</p>
                <p className="text-3xl font-bold">{classMetrics.totalTrainersInClass}</p>
              </div>
              <UserCheck className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Class Hours Today</p>
                <p className="text-3xl font-bold">{classMetrics.totalClassHoursToday.toFixed(1)}h</p>
              </div>
              <Clock className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Avg Session</p>
                <p className="text-3xl font-bold">{classMetrics.averageSessionLength.toFixed(1)}h</p>
              </div>
              <TrendingUp className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Utilization</p>
                <p className="text-3xl font-bold">{classMetrics.classUtilizationRate.toFixed(0)}%</p>
              </div>
              <Calendar className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Class Sessions */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600">
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center">
              <GraduationCap className="w-5 h-5 mr-2" />
              Active Class Sessions
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchClassOverviewData}
              className="text-white hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeClassSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No active class sessions at the moment</p>
              <p className="text-sm">Trainers will appear here when they check into classes</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Trainer</TableHead>
                    <TableHead className="font-semibold">Class</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Started</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeClassSessions.map((session) => (
                    <TableRow key={session.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <TableCell className="font-medium">{session.trainer_name}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{session.class_name}</div>
                          <div className="text-sm text-gray-500">{session.class_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{session.department}</Badge>
                      </TableCell>
                      <TableCell>{formatTime(session.check_in_time)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-blue-600">
                            {calculateDuration(session.check_in_time)}
                          </div>
                          {session.auto_checkout && (
                            <div className="text-xs text-gray-500">
                              {getRemainingTime(session.check_in_time, session.duration_hours)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span>Active</span>
                          </div>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trainer Performance Summary */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Trainer Performance (This Week)
            </span>
            <div className="flex gap-1">
              {['today', 'week', 'month'].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className="text-xs px-2 py-1 h-6 text-white hover:bg-white/20"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trainerPerformance.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No trainer performance data available</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Trainer</TableHead>
                    <TableHead className="font-semibold">Sessions</TableHead>
                    <TableHead className="font-semibold">Total Hours</TableHead>
                    <TableHead className="font-semibold">Classes</TableHead>
                    <TableHead className="font-semibold">Last Session</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainerPerformance.map((trainer) => (
                    <TableRow key={trainer.trainer_id} className="hover:bg-gray-50 transition-colors duration-200">
                      <TableCell className="font-medium">{trainer.trainer_name}</TableCell>
                      <TableCell className="text-center">{trainer.total_sessions}</TableCell>
                      <TableCell className="font-mono">{trainer.total_hours.toFixed(1)}h</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {trainer.classes_taught.slice(0, 2).map((className, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {className}
                            </Badge>
                          ))}
                          {trainer.classes_taught.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{trainer.classes_taught.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {trainer.last_session ? new Date(trainer.last_session).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          trainer.status === 'active' 
                            ? 'bg-green-500 hover:bg-green-600' 
                            : 'bg-gray-500 hover:bg-gray-600'
                        }>
                          {trainer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminClassOverview;