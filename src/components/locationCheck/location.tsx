// components/locationCheck/location.tsx 
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkLocation } from '@/lib/geofence';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { MapPin, AlertTriangle } from 'lucide-react';

export default function LocationCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [isDevEnvironment] = useState(process.env.NODE_ENV === 'development');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let initialCheckDone = false;

  const checkLocationPeriodically = async () => {
  try {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return;
    }

    if (navigator.permissions) {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      
      if (permissionStatus.state === 'prompt' && !initialCheckDone) {
        setShowLocationPrompt(true);
        return;
      } else if (permissionStatus.state === 'denied') {
        toast({
          title: "Location Access Required",
          description: "Please enable location access in your browser settings.",
          variant: "destructive"
        });
        return;
      }
    }

    const isLocationAllowed = await checkLocation();
    
    if (!isLocationAllowed) {
      toast({
        title: "Location Notice",
        description: "You are outside the allowed area. Attendance marking will be restricted.",
        variant: "default"
      });
      // ✅ No logout here
    }

    initialCheckDone = true;
    setCheckFailed(false);
  } catch (error) {
    console.error('Location check failed:', error);
    setCheckFailed(true);
    toast({
      title: "Location Check Failed",
      description: "Please ensure location access is enabled.",
      variant: "destructive"
    });
  }
};

    // Initial check with a slight delay to let UI render first
    const initialCheckTimeout = setTimeout(() => {
      checkLocationPeriodically();
    }, 1000);

    // Check location every 5 minutes
    intervalId = setInterval(checkLocationPeriodically, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, [router, toast, isDevEnvironment]);

  const handleAllowLocation = async () => {
    setShowLocationPrompt(false);
    // This will trigger the browser's location permission prompt
    try {
      await checkLocation();
    } catch (error) {
      console.error('Location check failed after permission:', error);
    }
  };

  const handleRetryLocationCheck = async () => {
    try {
      await checkLocation();
      setCheckFailed(false);
    } catch (error) {
      console.error('Location retry failed:', error);
      toast({
        title: "Location Check Failed",
        description: "Please check your browser settings and try again.",
        variant: "destructive"
      });
    }
  };

  return (
   <>
    {checkFailed && (
      <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-2 text-sm text-center">
        ⚠️ Location unavailable — attendance marking disabled
      </div>
    )}
    {children}
  </>
  );
}