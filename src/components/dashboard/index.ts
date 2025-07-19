// components/dashboard/index.ts
export { default as EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
export { default as WelcomeHeader } from '@/components/dashboard/WelcomeHeader';
export { default as AttendanceCard } from '@/components/dashboard/AttendanceCard';
export { default as StatisticsCards } from '@/components/dashboard/StatisticsCards';
export { default as AttendanceCharts } from '@/components/dashboard/AttendanceCharts';

// Re-export types and utilities for convenience
export * from '@/lib/types/dashboard';
export * from '@/lib/utils/dashboardUtils';
export { useDashboardData } from '@/hooks/useDashboardData';