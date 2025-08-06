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
        // Check if this is a development environment
        if (isDevEnvironment) {
          // console.log('Development environment detected, bypassing strict location checks');
          // We'll still try to get location, but won't log out on failure
        }

        // First, check if the Geolocation API is available
        if (!navigator.geolocation) {
          console.warn('Geolocation is not supported by this browser');
          if (!isDevEnvironment) {
            setShowLocationPrompt(true);
          }
          return;
        }

        // Check if we have permission to access location
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          
          if (permissionStatus.state === 'prompt' && !initialCheckDone) {
            // Show a custom prompt before the browser's prompt
            setShowLocationPrompt(true);
            return;
          } else if (permissionStatus.state === 'denied') {
            console.warn('Geolocation permission denied');
            if (!isDevEnvironment) {
              toast({
                title: "Location Access Required",
                description: "Please enable location access in your browser settings.",
                variant: "destructive"
              });
              setCheckFailed(true);
              return;
            }
          }
        }

        // Now actually check the location
        const isLocationAllowed = await checkLocation();
        
        if (!isLocationAllowed && !isDevEnvironment) {
          toast({
            title: "Access Denied",
            description: "You've left the allowed area. You will be logged out.",
            variant: "destructive"
          });
          
          // Logout user
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/login');
        }

        initialCheckDone = true;
        setCheckFailed(false);
      } catch (error) {
        console.error('Location check failed:', error);
        setCheckFailed(true);
        
        if (!isDevEnvironment) {
          toast({
            title: "Location Check Failed",
            description: "Please ensure location access is enabled.",
            variant: "destructive"
          });
        }
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
      {checkFailed && !isDevEnvironment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex items-center gap-2 text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Location Error</h2>
            </div>
            <p className="mb-4">We couldn't verify your location. This app requires location access to function properly.</p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleRetryLocationCheck} className="w-full">
                Retry Location Check
              </Button>
              <Button variant="outline" onClick={() => router.push('/login')} className="w-full">
                Return to Login
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showLocationPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Access Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              This app needs access to your location to verify you're in an allowed area.
              Please click "Allow" when prompted by your browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => router.push('/login')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAllowLocation}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(!checkFailed || isDevEnvironment) && children}
    </>
  );
}