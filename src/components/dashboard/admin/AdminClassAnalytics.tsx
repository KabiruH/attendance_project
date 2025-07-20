// components/dashboard/admin/AdminClassAnalytics.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  BookOpen, 
  TrendingUp, 
  Users, 
  Clock,
  Target,
  Activity,
  Calendar
} from 'lucide-react';

interface ClassUtilizationData {
  className: string;
  classCode: string;
  department: string;
  totalSessions: number;
  totalHours: number;
  activeTrainers: number;
  utilizationRate: number;
}

interface DepartmentData {
  name: string;
  classes: number;
  hours: number;
  trainers: number;
}

interface WeeklyClassTrend {
  week: string;
  sessions: number;
  hours: number;
  trainers: number;
}

interface ClassMetrics {
  totalClasses: number;
  activeClasses: number;
  totalTrainers: number;
  activeTrainers: number;
  totalSessionsToday: number;
  totalHoursToday: number;
  averageClassUtilization: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const AdminClassAnalytics: React.FC = () => {
  const [classUtilization, setClassUtilization] = useState<ClassUtilizationData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyClassTrend[]>([]);
  const [metrics, setMetrics] = useState<ClassMetrics>({
    totalClasses: 0,
    activeClasses: 0,
    totalTrainers: 0,
    activeTrainers: 0,
    totalSessionsToday: 0,
    totalHoursToday: 0,
    averageClassUtilization: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');

  const fetchClassAnalytics = async () => {
    // Only show loading for initial load, not for interval refreshes
    if (classUtilization.length === 0) {
      setIsLoading(true);
    }
    
    try {
      // Fetch class overview data
      const overviewResponse = await fetch('/api/admin/class-overview', {
        method: 'GET',
        credentials: 'include',
      });

      // Fetch detailed class analytics
      const analyticsResponse = await fetch(`/api/admin/class-analytics?range=${timeRange}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (overviewResponse.ok && analyticsResponse.ok) {
        const overviewData = await overviewResponse.json();
        const analyticsData = await analyticsResponse.json();

        setMetrics(analyticsData.metrics || {});
        setClassUtilization(analyticsData.classUtilization || []);
        setDepartmentData(analyticsData.departmentData || []);
        setWeeklyTrend(analyticsData.weeklyTrend || []);
      }
    } catch (error) {
      console.error('Error fetching class analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassAnalytics();
    
    // Only set up interval refresh, don't refresh on every timeRange change
    // Manual refresh when timeRange changes is sufficient
    const interval = setInterval(fetchClassAnalytics, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, []); // Remove timeRange dependency

  // Separate effect for timeRange changes with debounce
  useEffect(() => {
    if (timeRange) {
      const timeoutId = setTimeout(() => {
        fetchClassAnalytics();
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [timeRange]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader className="bg-gray-200">
                <div className="h-6 bg-gray-300 rounded w-3/4"></div>
              </CardHeader>
              <CardContent className="h-[300px] pt-6">
                <div className="h-full bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Class Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Total Classes</p>
                <p className="text-2xl font-bold">{metrics.totalClasses}</p>
                <p className="text-xs opacity-75">{metrics.activeClasses} active</p>
              </div>
              <BookOpen className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Trainers</p>
                <p className="text-2xl font-bold">{metrics.totalTrainers}</p>
                <p className="text-xs opacity-75">{metrics.activeTrainers} active today</p>
              </div>
              <Users className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Sessions Today</p>
                <p className="text-2xl font-bold">{metrics.totalSessionsToday}</p>
                <p className="text-xs opacity-75">{metrics.totalHoursToday.toFixed(1)}h total</p>
              </div>
              <Activity className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white">
              <div>
                <p className="text-sm font-medium opacity-90">Utilization</p>
                <p className="text-2xl font-bold">{metrics.averageClassUtilization.toFixed(0)}%</p>
                <p className="text-xs opacity-75">Average rate</p>
              </div>
              <Target className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Selector */}
      <div className="flex justify-end">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['week', 'month', 'quarter'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="text-sm"
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Utilization Chart */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <CardTitle className="text-white flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Class Utilization ({timeRange})
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classUtilization.slice(0, 8)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="classCode" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'totalSessions') return [value, 'Sessions'];
                    if (name === 'totalHours') return [`${Number(value).toFixed(1)}h`, 'Hours'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => {
                    const classItem = classUtilization.find(c => c.classCode === label);
                    return classItem ? classItem.className : label;
                  }}
                />
                <Bar dataKey="totalSessions" fill="#3B82F6" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600">
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Hours by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="hours"
                  label={({ name, hours }) => `${name}: ${hours.toFixed(1)}h`}
                  labelLine={false}
                  fontSize={12}
                >
                  {departmentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Hours']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600">
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Class Training Trend ({timeRange})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'hours') return [`${Number(value).toFixed(1)}h`, 'Hours'];
                  return [value, name];
                }}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="sessions" 
                stroke="#3B82F6" 
                strokeWidth={3}
                name="Sessions"
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="hours" 
                stroke="#10B981" 
                strokeWidth={3}
                name="Hours"
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performing Classes */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-amber-600 to-orange-600">
          <CardTitle className="text-white flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Top Performing Classes ({timeRange})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classUtilization.slice(0, 6).map((classItem, index) => (
              <div key={classItem.classCode} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{classItem.className}</h4>
                  <Badge variant="secondary">{classItem.classCode}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium">{classItem.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sessions:</span>
                    <span className="font-medium">{classItem.totalSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hours:</span>
                    <span className="font-medium">{classItem.totalHours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trainers:</span>
                    <span className="font-medium">{classItem.activeTrainers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilization:</span>
                    <Badge className={`${
                      classItem.utilizationRate >= 80 ? 'bg-green-500' :
                      classItem.utilizationRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {classItem.utilizationRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminClassAnalytics;
