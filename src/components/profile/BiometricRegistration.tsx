// components/profile/BiometricRegistration.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Fingerprint, CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Credential = {
  id: string;
  credentialId: string;
  created_at: string | Date;
};

interface BiometricRegistrationProps {
  userId: number;
}

export function BiometricRegistration({ userId }: BiometricRegistrationProps){
 const [registeredCredentials, setRegisteredCredentials] = useState<Credential[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [supported, setSupported] = useState(true);
  const { toast } = useToast();

  // Check if WebAuthn is supported in this browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.PublicKeyCredential) {
        setSupported(false);
      }
    }
  }, []);

  // Fetch existing credentials when component mounts
  useEffect(() => {
    if (supported) {
      fetchCredentials();
    }
  }, [supported]);

  const fetchCredentials = async () => {
    setLoadingCredentials(true);
    try {
      const response = await fetch('/api/webauthn/credentials', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }

      const data = await response.json();
      setRegisteredCredentials(data.credentials || []);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      toast({
        title: "Error",
        description: "Failed to load registered biometric credentials",
        variant: "destructive",
      });
    } finally {
      setLoadingCredentials(false);
    }
  };

  const registerBiometric = async () => {
    setIsRegistering(true);
    
    try {
      // 1. Get registration options from the server
      const optionsResponse = await fetch('/api/webauthn/generate-registration-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.error || 'Failed to get registration options');
      }

      const options = await optionsResponse.json();

      // 2. Pass the options to the browser's WebAuthn API
      const registrationResponse = await startRegistration(options);

      // 3. Send the response to the server to verify and save
      const verificationResponse = await fetch('/api/webauthn/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          registrationResponse,
          userId,
        }),
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      // 4. Registration successful
      await fetchCredentials();
      
      toast({
        title: "Success",
        description: "Biometric credential registered successfully",
      });
    } catch (error: unknown) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: "Could not register biometric credential",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const removeCredential = async (credentialId: string) => {
    try {
      const response = await fetch(`/api/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove credential');
      }

      // Refresh the list of credentials
      await fetchCredentials();
      
      toast({
        title: "Success",
        description: "Biometric credential removed successfully",
      });
    } catch (err) {
      console.error('Error removing credential:', err);
      toast({
        title: "Error",
        description: "Failed to remove biometric credential",
        variant: "destructive",
      });
    }
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Biometric Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>Biometric authentication is not supported in this browser.</p>
            <p className="mt-2 text-sm">Please use a modern browser that supports WebAuthn.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-6 w-6" />
          Biometric Authentication
        </CardTitle>
        <CardDescription>
          Register your fingerprint, face ID, or other biometric for secure authentication
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingCredentials ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {registeredCredentials.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Registered Devices:</h3>
                <ul className="space-y-2">
                  {registeredCredentials.map((cred, index) => (
                    <li key={cred.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span>Device {index + 1}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(cred.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeCredential(cred.credentialId)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Fingerprint className="h-8 w-8 text-gray-400" />
                </div>
                <p>No biometric credentials registered yet</p>
                <p className="text-sm mt-1">Add your fingerprint or face ID for passwordless login</p>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={registerBiometric} 
          disabled={isRegistering} 
          className="w-full"
        >
          {isRegistering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Fingerprint className="mr-2 h-4 w-4" />
              Register New Device
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}