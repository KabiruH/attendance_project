// components/dashboard/StatisticsCards.tsx
'use client';

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { UserCheck, UserX, AlertTriangle, Timer } from 'lucide-react';
import { AttendanceStats } from '../../../lib/types/dashboard';

interface StatisticsCardsProps {
  stats: AttendanceStats;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ stats }) => {
  const cards = [
    {
      title: 'On Time Days',
      value: stats.presentDays,
      icon: UserCheck,
      bgColor: 'bg-blue-200',
      iconColor: 'text-blue-700'
    },
    {
      title: 'Late Days',
      value: stats.lateDays,
      icon: AlertTriangle,
      bgColor: 'bg-yellow-500',
      iconColor: 'text-yellow-600'
    },
    {
      title: 'Absent Days',
      value: stats.absentDays,
      icon: UserX,
      bgColor: 'bg-red-400',
      iconColor: 'text-red-500'
    },
    {
      title: 'This Month',
      value: `${stats.totalHoursThisMonth}h`,
      subtitle: 'Completed work only',
      icon: Timer,
      bgColor: 'bg-green-400',
      iconColor: 'text-green-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="shadow-md">
          <CardContent className="pt-6">
            <div className={`flex items-center justify-between p-4 ${card.bgColor} rounded-lg`}>
              <div>
                <p className="text-sm font-bold text-slate-900">{card.title}</p>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-slate-700">{card.subtitle}</p>
                )}
              </div>
              <card.icon className={`w-12 h-12 ${card.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatisticsCards;