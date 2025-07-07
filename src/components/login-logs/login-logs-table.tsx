// components/admin/login-logs-table.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Monitor, Smartphone, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface LoginLogsTableProps {
  logs: LoginLog[];
}

export default function LoginLogsTable({ logs }: LoginLogsTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case 'blocked':
        return <Badge className="bg-orange-100 text-orange-800">Blocked</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string) => {
    return method === 'biometric' ? (
      <div className="flex items-center gap-1">
        <Smartphone className="h-4 w-4" />
        <span className="capitalize">{method}</span>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <Monitor className="h-4 w-4" />
        <span className="capitalize">{method}</span>
      </div>
    );
  };

  const getDeviceInfo = (userAgent: string) => {
    // Simple device detection
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return { type: 'Mobile', icon: <Smartphone className="h-4 w-4" /> };
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      return { type: 'Tablet', icon: <Monitor className="h-4 w-4" /> };
    } else {
      return { type: 'Desktop', icon: <Monitor className="h-4 w-4" /> };
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  };

  const getFailureReasonText = (reason?: string) => {
    const reasonMap: { [key: string]: string } = {
      'user_not_found': 'User not found',
      'invalid_password': 'Invalid password',
      'account_inactive': 'Account inactive',
      'biometric_mismatch': 'Biometric verification failed',
      'server_error': 'Server error',
    };
    return reason ? reasonMap[reason] || reason : '';
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No login logs found</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>Date & Time</TableHead>
          <TableHead>Failure Reason</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => {
          const deviceInfo = getDeviceInfo(log.user_agent);
          const { date, time } = formatDateTime(log.attempted_at);
          
          return (
            <TableRow key={log.id}>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{log.user_name}</div>
                  <div className="text-sm text-gray-500">
                    {log.user_role} • {log.user_department}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="font-mono text-sm">{log.email}</div>
              </TableCell>
              
              <TableCell>
                {getStatusBadge(log.status)}
              </TableCell>
              
              <TableCell>
                {getMethodIcon(log.login_method)}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <span className="font-mono text-sm">{log.ip_address}</span>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex items-center gap-1">
                  {deviceInfo.icon}
                  <span className="text-sm">{deviceInfo.type}</span>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="space-y-1">
                  <div className="text-sm font-medium">{date}</div>
                  <div className="text-xs text-gray-500">{time}</div>
                </div>
              </TableCell>
              
              <TableCell>
                {log.failure_reason && (
                  <Badge variant="destructive" className="text-xs">
                    {getFailureReasonText(log.failure_reason)}
                  </Badge>
                )}
              </TableCell>
              
              <TableCell>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Login Attempt Details</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-sm text-gray-500">User Information</h4>
                          <div className="mt-1">
                            <p><strong>Name:</strong> {log.user_name}</p>
                            <p><strong>Email:</strong> {log.email}</p>
                            <p><strong>ID Number:</strong> {log.user_id_number}</p>
                            <p><strong>Role:</strong> {log.user_role}</p>
                            <p><strong>Department:</strong> {log.user_department}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-gray-500">Attempt Details</h4>
                          <div className="mt-1">
                            <p><strong>Status:</strong> {getStatusBadge(log.status)}</p>
                            <p><strong>Method:</strong> {log.login_method}</p>
                            <p><strong>Date:</strong> {date}</p>
                            <p><strong>Time:</strong> {time}</p>
                            {log.failure_reason && (
                              <p><strong>Failure Reason:</strong> {getFailureReasonText(log.failure_reason)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-sm text-gray-500">Technical Details</h4>
                          <div className="mt-1">
                            <p><strong>IP Address:</strong> {log.ip_address}</p>
                            <p><strong>Device Type:</strong> {deviceInfo.type}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-gray-500">User Agent</h4>
                          <div className="mt-1">
                            <p className="text-xs bg-gray-100 p-2 rounded font-mono break-all">
                              {log.user_agent}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}