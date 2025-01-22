// components/locationCheck/location.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkLocation } from '@/lib/geofence';
import { useToast } from "@/components/ui/use-toast";

export default function LocationCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkLocationPeriodically = async () => {
      try {
        const isLocationAllowed = await checkLocation();
        
        if (!isLocationAllowed) {
          toast({
            title: "Access Denied",
            description: "You've left the allowed area. You will be logged out.",
            variant: "destructive"
          });
          
          // Logout user
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/login');
        }
      } catch (error) {
        console.error('Location check failed:', error);
      }
    };

    // Check location every 5 minutes
    const intervalId = setInterval(checkLocationPeriodically, 5 * 60 * 1000);

    // Initial check
    checkLocationPeriodically();

    return () => clearInterval(intervalId);
  }, [router]);

  return <>{children}</>;
}