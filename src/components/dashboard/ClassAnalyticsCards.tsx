import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  GraduationCap, 
  Clock, 
  TrendingUp, 
  BookOpen,
  Target,
  Award,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface ClassAnalyticsCardsProps {
  userId?: string | null;
  showFullAnalytics?: boolean;
  onViewFullAnalytics?: () => void;
}

interface ClassAttendanceRecord {
  id: number;
  trainer_id: number;
  class_id: number;
  date: string;
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const ClassAnalyticsCards: React.FC<ClassAnalyticsCardsProps> = ({ 
  userId, 
  showFullAnalytics = false,
  onViewFullAnalytics 
}) => {
  const [attendanceHistory, setAttendanceHistory] = React.useState<ClassAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [timeRange, setTimeRange] = useState('month');

  React.useEffect(() => {
    if (userId) {
      fetchClassAnalytics();
    }
  }, [userId, timeRange]);

  const fetchClassAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/class-status', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceHistory(data.attendanceHistory || []);
      }
    } catch (error) {
      console.error('Error fetching class analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSessionHours = (record: ClassAttendanceRecord): number => {
    if (!record.check_out_time) return 0;
    
    const checkIn = new Date(record.check_in_time);
    const checkOut = new Date(record.check_out_time);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  };

  const getFilteredData = () => {
    const now = new Date();
    const filterDate = new Date();
    
    switch (timeRange) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        filterDate.setMonth(now.getMonth() - 3);
        break;
      default:
        filterDate.setMonth(now.getMonth() - 1);
    }

    return attendanceHistory.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= filterDate && record.check_out_time;
    });
  };

  const processClassData = () => {
    const filteredData = getFilteredData();
    const classMap = new Map();

    filteredData.forEach(record => {
      const classId = record.class.id;
      const sessionHours = calculateSessionHours(record);

      if (classMap.has(classId)) {
        const existing = classMap.get(classId);
        existing.hours += sessionHours;
        existing.sessions += 1;
      } else {
        classMap.set(classId, {
          name: record.class.name,
          code: record.class.code,
          department: record.class.department,
          hours: sessionHours,
          sessions: 1,
          color: COLORS[classMap.size % COLORS.length]
        });
      }
    });

    return Array.from(classMap.values()).sort((a, b) => b.hours - a.hours);
  };

  const classData = processClassData();
  const filteredData = getFilteredData();
  
  const totalHours = classData.reduce((sum, item) => sum + item.hours, 0);
  const totalSessions = classData.reduce((sum, item) => sum + item.sessions, 0);
  const averageSessionLength = totalSessions > 0 ? totalHours / totalSessions : 0;
  const topClass = classData.length > 0 ? classData[0] : null;

  // Department data for pie chart
  const departmentData = classData.reduce((acc, curr) => {
    const existing = acc.find((item: { name: any; }) => item.name === curr.department);
    if (existing) {
      existing.value += curr.hours;
    } else {
      acc.push({ name: curr.department, value: curr.hours });
    }
    return acc;
  }, [] as {name: string, value: number}[]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading class analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Class Training Summary
            </span>
            <div className="flex gap-1">
              {['week', 'month', 'quarter'].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className="text-xs px-2 py-1 h-6"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <GraduationCap className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No class training sessions found</p>
            <p className="text-sm">for the selected {timeRange}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Training Hours</p>
                <p className="text-lg font-bold">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Sessions</p>
                <p className="text-lg font-bold">{totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Classes</p>
                <p className="text-lg font-bold">{classData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Avg Session</p>
                <p className="text-lg font-bold">{averageSessionLength.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Class Training Analytics ({timeRange})
            </span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {['week', 'month', 'quarter'].map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="text-xs px-2 py-1 h-6"
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Button>
                ))}
              </div>
              {onViewFullAnalytics && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewFullAnalytics}
                  className="text-xs px-2 py-1 h-6"
                >
                  View Full Analytics
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Classes */}
            <div>
              <h4 className="text-sm font-medium mb-3">Top Classes by Hours</h4>
              <div className="space-y-2">
                {classData.slice(0, 5).map((classItem, index) => (
                  <div key={classItem.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: classItem.color }}
                      />
                      <span className="text-sm font-medium">{classItem.name}</span>
                      <Badge variant="secondary" className="text-xs">{classItem.code}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{classItem.hours.toFixed(1)}h</div>
                      <div className="text-xs text-gray-500">{classItem.sessions} sessions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Distribution */}
            <div>
              <h4 className="text-sm font-medium mb-3">Hours by Department</h4>
              {departmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={departmentData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}h`}
                      labelLine={false}
                      fontSize={10}
                    >
                      {departmentData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Hours']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Top Performer Badge */}
          {topClass && (
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium">Most Active Class</span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-700">{topClass.name}</div>
                  <div className="text-sm text-gray-600">{topClass.hours.toFixed(1)}h • {topClass.sessions} sessions</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassAnalyticsCards;