// components/profile/BiometricRegistration.tsx - Fixed version
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

export function BiometricRegistration({ userId }: BiometricRegistrationProps) {
  const [registeredCredentials, setRegisteredCredentials] = useState<Credential[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [supported, setSupported] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actualUserId, setActualUserId] = useState<number | null>(null);
  const [idNumber, setIdNumber] = useState<string | null>(null); // ✅ Add state for id_number
  const { toast } = useToast();

  // Debug - log received userId
  useEffect(() => { // Fetch the actual user ID from JWT on component mount
    fetchActualUserId();
  }, [userId]);

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
    if (supported && actualUserId) {
      fetchCredentials();
    }
  }, [supported, actualUserId]);

  // Fetch the current user's ID from server to get the correct Users table ID
  const fetchActualUserId = async () => {
    try {
      const response = await fetch('/api/auth/check', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch current user data');
        setAuthError('Authentication failed. Please log in again.');
        return;
      }

      const id_number = data.user?.id_number;

      // corresponds to the ID in the Users table
      const jwtUserId = data.user?.userId || data.user?.id;

      if (!jwtUserId) {
        console.error('Could not determine user ID from JWT');
        setAuthError('Could not determine your user ID');
        return;
      }

      setActualUserId(Number(jwtUserId));
      setIdNumber(id_number); // ✅ Store id_number in state
    } catch (error) {
      console.error('Error checking authentication:', error);
      setAuthError('Authentication error occurred');
    }
  };

  const fetchCredentials = async () => {
    if (!actualUserId) return;

    setLoadingCredentials(true);
    try {

      const response = await fetch('/api/webauthn/credentials', {
        credentials: 'include',
      });

      if (response.status === 401) {
        setAuthError('You must be logged in to manage biometric credentials');
        setLoadingCredentials(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch credentials:', errorData);
        throw new Error(errorData.error || 'Failed to fetch credentials');
      }

      const data = await response.json();
      setRegisteredCredentials(data.credentials || []);
      setAuthError(null);
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
    if (!actualUserId) {
      toast({
        title: "Error",
        description: "Could not determine your user ID",
        variant: "destructive",
      });
      return;
    }

    if (!idNumber) {
      toast({
        title: "Error",
        description: "Could not determine your ID number",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);

    try {
      // Use the actual user ID from JWT instead of the prop
      const userIdToUse = actualUserId;

      // 1. Get registration options from the server
      const optionsResponse = await fetch('/api/webauthn/generate-registration-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: userIdToUse }),
      });

      if (optionsResponse.status === 401) {
        setAuthError('You must be logged in to register biometrics');
        throw new Error('You must be logged in to register biometrics');
      }

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to get registration options:', errorData);
        throw new Error(errorData.error || 'Failed to get registration options');
      }

      const options = await optionsResponse.json();

      // 2. Pass the options to the browser's WebAuthn API
      const registrationResponse = await startRegistration({
        optionsJSON: options
      });

      // 3. Send the response to the server to verify and save
      const verificationResponse = await fetch('/api/webauthn/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          registrationResponse,
          id_number: idNumber,
        }),
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Verification failed:', errorData);
        throw new Error(errorData.error || 'Verification failed');
      }

      const verificationResult = await verificationResponse.json();

      // 4. Registration successful
      await fetchCredentials();

      toast({
        title: "Success",
        description: "Biometric credential registered successfully",
      });
    } catch (error: unknown) {
      console.error('Registration error:', error);

      // More detailed error handling
      let errorMessage = 'Could not register biometric credential';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Handle common WebAuthn errors
        if (error.name === 'NotAllowedError') {
          errorMessage = 'The operation was canceled by the user or another error occurred during user verification.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'The origin is not secure (must be HTTPS or localhost).';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'This device or browser doesn\'t support the requested authentication method.';
        }
      }

      toast({
        title: "Registration Failed",
        description: errorMessage,
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to remove credential:', errorData);
        throw new Error(errorData.error || 'Failed to remove credential');
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

  if (authError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Biometric Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-red-500">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-red-400" />
            <p>{authError}</p>
            <p className="mt-2 text-sm">Please log in to manage biometric credentials.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actualUserId === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-6 w-6" />
            Biometric Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="ml-2">Checking authentication...</span>
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
          disabled={isRegistering || !actualUserId || !idNumber}
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