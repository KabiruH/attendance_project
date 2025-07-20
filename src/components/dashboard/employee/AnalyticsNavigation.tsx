// components/navigation/AnalyticsNavigation.tsx
'use client';
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnalyticsNavigationProps {
  userRole?: string;
  totalHours?: number;
  totalSessions?: number;
  showBadge?: boolean;
}

const AnalyticsNavigation: React.FC<AnalyticsNavigationProps> = ({
  userRole,
  totalHours = 0,
  totalSessions = 0,
  showBadge = true
}) => {
  const router = useRouter();
  
  // Only show for trainers/teachers
  const isTrainer = userRole === 'trainer' || userRole === 'employee';
  
  if (!isTrainer) {
    return null;
  }

  const handleNavigateToAnalytics = () => {
    router.push('/dashboard/analytics');
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNavigateToAnalytics}
        className="flex items-center space-x-2 hover:bg-blue-50"
      >
        <BarChart3 className="w-4 h-4" />
        <span>Training Analytics</span>
        {showBadge && totalSessions > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {totalSessions}
          </Badge>
        )}
      </Button>
      
      {/* Quick stats preview */}
      {totalHours > 0 && (
        <div className="hidden md:flex items-center space-x-1 text-xs text-gray-600">
          <GraduationCap className="w-3 h-3" />
          <span>{totalHours.toFixed(1)}h this month</span>
        </div>
      )}
    </div>
  );
};

export default AnalyticsNavigation;

// Alternative: Dropdown menu version
export const AnalyticsDropdown: React.FC<AnalyticsNavigationProps> = ({
  userRole,
  totalHours = 0,
  totalSessions = 0
}) => {
  const router = useRouter();
  const isTrainer = userRole === 'trainer' || userRole === 'employee';
  
  if (!isTrainer) return null;

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center space-x-2"
      >
        <TrendingUp className="w-4 h-4" />
        <span>Analytics</span>
      </Button>
      
      {/* Dropdown content */}
      <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="p-3">
          <div className="text-sm font-medium mb-2">Training Summary</div>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total Hours:</span>
              <span className="font-medium">{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span>Sessions:</span>
              <span className="font-medium">{totalSessions}</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => router.push('/dashboard/analytics')}
            className="w-full mt-3"
          >
            View Full Analytics
          </Button>
        </div>
      </div>
    </div>
  );
};