'use client';
import { useEffect, useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { Building2, Clock, Users, Shield, MapPin, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { checkLocationWithDistance } from '@/lib/geofence';
import { useToast } from "@/components/ui/use-toast";

interface LocationResult {
  isWithinArea: boolean;
  distanceFromCenter: number;
  distanceFromEdge: number;
  userLocation: { latitude: number; longitude: number };
  formattedDistance: string;
}

export default function LoginPage() {
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    async function verifyLocation() {
      try {
        const result = await checkLocationWithDistance();
        setLocationResult(result);
        
        if (!result.isWithinArea) {
          toast({
            title: "Location Notice",
            description: `You are ${result.formattedDistance}. You can still login, but attendance marking will require being on campus.`,
            variant: "default",
          });
        }
      } catch (error: any) {
        console.error("Error checking location:", error);
        setLocationError(error.message || 'Could not verify location');
        toast({
          title: "Location Error",
          description: "Could not verify your location. Please enable GPS and refresh the page.",
          variant: "destructive",
        });
      } finally {
        setCheckingLocation(false);
      }
    }

    verifyLocation();
  }, [toast]);

  const getLocationStatusColor = () => {
    if (!locationResult) return 'bg-gray-100 text-gray-600';
    return locationResult.isWithinArea 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const getLocationIcon = () => {
    if (!locationResult) return <MapPin className="w-4 h-4" />;
    return locationResult.isWithinArea 
      ? <MapPin className="w-4 h-4" />
      : <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen flex">
      {/* Location Status Banner - Top Left */}
      <div className="absolute top-4 left-4 z-10">
        {checkingLocation ? (
          <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-sm font-medium">Checking location...</span>
          </div>
        ) : locationError ? (
          <div className="bg-red-100 text-red-800 px-3 py-2 rounded-lg border border-red-200 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Location unavailable</span>
          </div>
        ) : (
          <div className={`px-3 py-2 rounded-lg border flex items-center space-x-2 ${getLocationStatusColor()}`}>
            {getLocationIcon()}
            <span className="text-sm font-medium">
              {locationResult?.formattedDistance || 'Location unknown'}
            </span>
          </div>
        )}
      </div>

      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col justify-between p-16">
        <div className="flex flex-col justify-center items-center h-full">
          <h1 className="text-4xl font-bold text-white mb-6">
            Welcome to our Attendance System
          </h1>
          <p className="text-blue-100 text-2xl mb-12">
            Streamline your attendance tracking with our modern platform.
          </p>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Clock className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Instant work & class check-in</p>
            </div>
            <div className="flex items-center space-x-4">
              <Shield className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Location-verified attendance</p>
            </div>
            <div className="flex items-center space-x-4">
              <Users className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Track team attendance</p>
            </div>
            <div className="flex items-center space-x-4">
              <Building2 className="w-9 h-9 text-blue-200" />
              <p className="text-white text-xl">Multi-branch support</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-blue-200 text-sm">
            © 2025 Mukiria Technical Training Institute. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-2xl">
          {checkingLocation ? (
            <div className="text-center text-gray-600 space-y-4">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p>Checking your location...</p>
            </div>
          ) : (
            <Card className="border-gray-200 bg-white">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Sign In to Your Account
                  </h2>
                  <p className="text-gray-600">
                    Access your dashboard and account settings
                  </p>
                </div>

                {/* Location Notice for Off-Campus Users */}
                {locationResult && !locationResult.isWithinArea && (
                  <Alert className="mb-6 border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Notice:</strong> You are currently {locationResult.formattedDistance}. 
                      You can login and access the system, but you'll need to be on campus to mark attendance.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Location Success for On-Campus Users */}
                {locationResult && locationResult.isWithinArea && (
                  <Alert className="mb-6 border-green-200 bg-green-50">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Perfect!</strong> You are {locationResult.formattedDistance} and can mark attendance after login.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Location Error */}
                {locationError && (
                  <Alert className="mb-6 border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <strong>Location Error:</strong> {locationError}. 
                      Please enable GPS and refresh the page for full functionality.
                    </AlertDescription>
                  </Alert>
                )}

                <LoginForm />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}