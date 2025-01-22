'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from "jwt-decode";
import { useToast } from '@/components/ui/use-toast';
import AdminDashboard from './adminDashboard';
import EmployeeDashboard from './employeeDashboard';

interface DecodedToken {
  id: number;
  email: string;
  role: 'admin' | 'employee';
  name: string;
}

interface UserData {
  id: number;
  email: string;
  name: string;
  role: string;
}

const Dashboard = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get user data from auth endpoint
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        const data = await response.json();
        const decodedToken: DecodedToken = jwtDecode(data.token);
        
        // Set the full user data
        setUserData({
          id: decodedToken.id,
          email: decodedToken.email,
          name: decodedToken.name,
          role: decodedToken.role,
        });
        
      } catch (error) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again',
          variant: 'destructive',
        });
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null; // Router will handle redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {userData.role === 'admin' && <AdminDashboard data={userData} />}
      {userData.role === 'employee' && <EmployeeDashboard data={userData} />}
    </div>
  );
};

export default Dashboard;