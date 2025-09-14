// app/superadmin/page.tsx - Main SuperAdmin dashboard page
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from "jwt-decode";
import SuperAdminDashboard from '@/components/superadmin/SuperAdminDasboard';

interface DecodedToken {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface UserData {
  id: number;
  email: string;
  name: string;
  role: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const checkSuperAdminAuth = async () => {
      try {
        // Check authentication
        const response = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Authentication failed');
        }

        const data = await response.json();
        const decodedToken: DecodedToken = jwtDecode(data.token);

        // Check if user is SuperAdmin
        if (decodedToken.role !== 'super_admin') {
          // Redirect non-SuperAdmin users to regular dashboard
          router.push('/dashboard');
          return;
        }

        setUserData({
          id: decodedToken.id,
          email: decodedToken.email,
          name: decodedToken.name,
          role: decodedToken.role,
        });

      } catch (error) {
        console.error('SuperAdmin auth check failed:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkSuperAdminAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <span className="text-lg">Loading SuperAdmin Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!userData) {
    return null; // Router will handle redirect
  }

  return <SuperAdminDashboard data={userData} />;
}