// components/profile/AttendanceStats.tsx
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceStats as AttendanceStatsType } from '@/lib/types/profile';

interface AttendanceStatsProps {
  stats: AttendanceStatsType;
}

export function AttendanceStats({ stats }: AttendanceStatsProps) {
  const statItems = [
    { label: 'On time ratio', value: `${stats.attendanceRate.toFixed(1)}%` },
    { label: 'On time Days', value: stats.presentDays, color: 'text-green-600' },
    { label: 'Late Days', value: stats.lateDays, color: 'text-yellow-600' },
    { label: 'Absent Days', value: stats.absentDays, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color || ''}`}>
                {item.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}