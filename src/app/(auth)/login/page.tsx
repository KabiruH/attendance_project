'use client';
import { useEffect, useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import { Building2, Clock, Users, Shield, MapPin } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { checkLocation } from '@/lib/geofence'; // make sure path is correct
import { useToast } from "@/components/ui/use-toast";

export default function LoginPage() {
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function verifyLocation() {
      try {
        const allowed = await checkLocation();
        setLocationAllowed(allowed);

        if (!allowed) {
          toast({
            title: "Access Denied",
            description: "You are not in an allowed location to log in.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error checking location:", error);
        toast({
          title: "Location Error",
          description: "Could not verify your location. Please enable GPS.",
          variant: "destructive",
        });
      } finally {
        setCheckingLocation(false);
      }
    }

    verifyLocation();
  }, [toast]);

  return (
    <div className="min-h-screen flex">
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
            © 2025 Mukiria Technical Training College. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Login Form or Location Restriction */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-2xl">
          {checkingLocation ? (
            <div className="text-center text-gray-600">Checking your location...</div>
          ) : locationAllowed ? (
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
                <LoginForm />
              </CardContent>
            </Card>
          ) : (
            <div className="text-center text-red-600 space-y-4">
              <MapPin className="mx-auto w-12 h-12 text-red-500" />
              <p className="text-lg font-semibold">You are not in an allowed location to log in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
