// app/admin/login-logs/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, RefreshCw, Download } from "lucide-react";
import LoginLogsTable from '@/components/login-logs/login-logs-table';

interface LoginLog {
  id: number;
  email: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed' | 'blocked';
  failure_reason?: string;
  login_method: 'password' | 'biometric';
  attempted_at: string;
  user_name: string;
  user_id_number: string;
  user_role: string;
  user_department: string;
}

interface LoginStats {
  totalAttempts: number;
  successfulLogins: number;
  failedAttempts: number;
  blockedAttempts: number;
  uniqueUsers: number;
  recentAttempts: number;
  successRate: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function AdminLoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter states - Default to last 7 days
  const getDefaultDateFrom = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 days ago
    return date.toISOString().split('T')[0];
  };

  const getDefaultDateTo = () => {
    return new Date().toISOString().split('T')[0]; // Today
  };

  const [filters, setFilters] = useState({
    status: 'all',
    email: '',
    loginMethod: 'all',
    dateFrom: getDefaultDateFrom(),
    dateTo: getDefaultDateTo(),
    ipAddress: '',
    page: 1,
    limit: 50
  });

  const fetchLogs = async (newFilters = filters) => {
    try {
      setIsRefreshing(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/login-logs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch login logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching login logs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const handlePageChange = (newPage: number) => {
    const newFilters = { ...filters, page: newPage };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const handleQuickFilter = (days: number | 'all') => {
    let newFilters;
    
    if (days === 'all') {
      newFilters = { ...filters, dateFrom: '', dateTo: '', page: 1 };
    } else {
      const dateTo = new Date().toISOString().split('T')[0];
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      
      newFilters = { ...filters, dateFrom: dateFromStr, dateTo: dateTo, page: 1 };
    }
    
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleExport = () => {
    const headers = [
      'Date & Time', 'User Name', 'Email', 'Status', 'Login Method', 
      'IP Address', 'Failure Reason', 'Role', 'Department', 'ID Number'
    ];
    
    const csvData = logs.map(log => [
      new Date(log.attempted_at).toLocaleString(),
      log.user_name,
      log.email,
      log.status,
      log.login_method,
      log.ip_address,
      log.failure_reason || '',
      log.user_role,
      log.user_department,
      log.user_id_number
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `login-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Login Logs</h1>
          <p className="text-gray-500">Monitor user login attempts and security events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttempts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.successfulLogins}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedAttempts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.blockedAttempts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentAttempts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter login logs by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick Date Filters */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Quick Date Filters</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filters.dateFrom === getDefaultDateFrom() && filters.dateTo === getDefaultDateTo() ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter(7)}
              >
                Last 7 Days
              </Button>
              <Button
                variant={filters.dateFrom === new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] && filters.dateTo === getDefaultDateTo() ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter(30)}
              >
                Last 30 Days
              </Button>
              <Button
                variant={filters.dateFrom === new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] && filters.dateTo === getDefaultDateTo() ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter(90)}
              >
                Last 3 Months
              </Button>
              <Button
                variant={!filters.dateFrom && !filters.dateTo ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickFilter('all')}
              >
                All Time
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Login Method</label>
              <Select value={filters.loginMethod} onValueChange={(value) => handleFilterChange('loginMethod', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="biometric">Biometric</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search email..."
                  value={filters.email}
                  onChange={(e) => handleFilterChange('email', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">IP Address</label>
              <Input
                placeholder="Search IP..."
                value={filters.ipAddress}
                onChange={(e) => handleFilterChange('ipAddress', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Login Logs Table */}
      <LoginLogsTable logs={logs} />

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}