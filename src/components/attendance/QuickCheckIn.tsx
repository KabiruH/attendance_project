import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Fingerprint, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User, 
  MapPin, 
  BookOpen,
  Building,
  Timer
} from "lucide-react";
import { checkLocation } from '@/lib/geofence';

interface Class {
  id: number;
  name: string;
  code: string;
  description?: string;
  department: string;
  duration_hours: number;
}

interface QuickCheckInProps {
  onSuccess?: () => void;
}

type CheckInStep = 'initial' | 'biometric' | 'location' | 'work_checkin' | 'class_selection' | 'success';

export default function QuickCheckIn({ onSuccess }: QuickCheckInProps) {
  const [currentStep, setCurrentStep] = useState<CheckInStep>('initial');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState<{ name: string; role: string; timeIn: string } | null>(null);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [workAttendanceResult, setWorkAttendanceResult] = useState<any>(null);

  const handleStartCheckIn = async () => {
    setCurrentStep('biometric');
    setError('');
    setIsProcessing(true);

    try {
      // Step 1: Biometric Authentication
      await performBiometricAuth();
      
      // Step 2: Location Check
      setCurrentStep('location');
      await performLocationCheck();
      
      // Step 3: Work Check-in
      setCurrentStep('work_checkin');
      await performWorkCheckIn();
      
      // Step 4: Check if user is a trainer with classes
      await checkForTrainerClasses();
      
    } catch (error) {
      console.error('Check-in process failed:', error);
      setError(error instanceof Error ? error.message : 'Check-in failed');
      setCurrentStep('initial');
    } finally {
      setIsProcessing(false);
    }
  };

  const performBiometricAuth = async () => {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      throw new Error('Biometric authentication is not supported on this device');
    }

    // Get authentication challenge
    const authResponse = await fetch('/api/webauthn/quick-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const authData = await authResponse.json();
    if (!authResponse.ok) {
      throw new Error(authData.error || 'Failed to get authentication challenge');
    }

    console.log('WebAuthn challenge received:', {
      challengeLength: authData.challenge.length,
      allowCredentialsCount: authData.allowCredentials.length,
      challengeId: authData.challengeId
    });

    // Log credential details for debugging
    authData.allowCredentials.forEach((cred: any, index: number) => {
      console.log(`Credential ${index}:`, {
        idLength: cred.id.length,
        type: cred.type,
        transports: cred.transports
      });
    });

    try {
      // Perform WebAuthn authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(authData.challenge),
          allowCredentials: authData.allowCredentials.map((cred: any) => ({
            id: new Uint8Array(cred.id),
            type: 'public-key',
            transports: cred.transports || ['internal']
          })),
          timeout: 60000,
          userVerification: 'preferred',
          rpId: authData.rpId // Use rpId from server if provided
        }
      });

      if (!credential) {
        throw new Error('Biometric authentication was cancelled');
      }

      console.log('WebAuthn authentication successful');

      // Store credential for later use
      const publicKeyCredential = credential as PublicKeyCredential;
      const response = publicKeyCredential.response as AuthenticatorAssertionResponse;
      
      // Store auth result for next steps
      window.tempAuthResult = {
        credentialId: publicKeyCredential.id,
        response: {
          authenticatorData: Array.from(new Uint8Array(response.authenticatorData)),
          clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
          signature: Array.from(new Uint8Array(response.signature)),
          userHandle: response.userHandle ? Array.from(new Uint8Array(response.userHandle)) : null
        },
        challengeId: authData.challengeId
      };
    } catch (webauthnError) {
      console.error('WebAuthn error:', webauthnError);
      
      if (webauthnError instanceof Error) {
        if (webauthnError.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled or not allowed');
        } else if (webauthnError.name === 'InvalidStateError') {
          throw new Error('No registered biometric credentials found. Please register your fingerprint first.');
        } else if (webauthnError.name === 'NotSupportedError') {
          throw new Error('Biometric authentication is not supported on this device');
        } else {
          throw new Error(`Authentication failed: ${webauthnError.message}`);
        }
      } else {
        throw new Error('Biometric authentication failed');
      }
    }
  };

  const performLocationCheck = async () => {
    try {
      const isLocationAllowed = await checkLocation();
      if (!isLocationAllowed) {
        throw new Error('You are not in an allowed location for check-in');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Location check failed in development mode, continuing...');
      } else {
        throw error;
      }
    }
  };

  const performWorkCheckIn = async () => {
    const authResult = (window as any).tempAuthResult;
    
    const response = await fetch('/api/attendance/biometric-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check-in',
        biometric_auth: authResult
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Work check-in failed');
    }

    setWorkAttendanceResult(result);
    setUserInfo({
      name: result.user.name,
      role: result.user.role,
      timeIn: new Date().toLocaleTimeString()
    });

    // Clean up temp auth result
    delete (window as any).tempAuthResult;
  };

  const checkForTrainerClasses = async () => {
    if (!userInfo || !workAttendanceResult) return;

    // Check if user is a trainer with classes
    try {
      const response = await fetch(`/api/trainers/${workAttendanceResult.user.id}/my-classes`);
      if (response.ok) {
        const classes = await response.json();
        if (classes.length > 0) {
          setAvailableClasses(classes);
          setCurrentStep('class_selection');
          return;
        }
      }
    } catch (error) {
      console.log('User has no trainer classes, proceeding to success');
    }

    // If no classes or not a trainer, go to success
    setCurrentStep('success');
  };

  const handleClassSelection = (classId: number, checked: boolean) => {
    setSelectedClassIds(prev => 
      checked 
        ? [...prev, classId]
        : prev.filter(id => id !== classId)
    );
  };

  const handleClassCheckIn = async () => {
    if (selectedClassIds.length === 0) {
      setCurrentStep('success');
      return;
    }

    setIsProcessing(true);
    try {
      // Check into selected classes
      const promises = selectedClassIds.map(classId => 
        fetch('/api/attendance/class-checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            class_id: classId,
            trainer_id: workAttendanceResult.user.id
          }),
        })
      );

      await Promise.all(promises);
      setCurrentStep('success');
    } catch (error) {
      setError('Failed to check into classes');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'initial':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <Fingerprint className="h-12 w-12 text-blue-600 mx-auto" />
              <h3 className="text-lg font-semibold">Ready to Check In</h3>
              <p className="text-sm text-muted-foreground">
                Use your biometric authentication to check in to work
              </p>
            </div>
            
            <Button
              onClick={handleStartCheckIn}
              disabled={isProcessing}
              className="w-full h-12 text-lg"
              size="lg"
            >
              <Fingerprint className="mr-2 h-5 w-5" />
              Start Check-In Process
            </Button>
          </div>
        );

      case 'biometric':
        return (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <Fingerprint className="h-12 w-12 text-blue-600 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold">Biometric Authentication</h3>
            <p className="text-sm text-muted-foreground">
              Please use your fingerprint, face ID, or PIN to authenticate
            </p>
          </div>
        );

      case 'location':
        return (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <MapPin className="h-12 w-12 text-green-600 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold">Verifying Location</h3>
            <p className="text-sm text-muted-foreground">
              Checking that you're in an allowed area...
            </p>
          </div>
        );

      case 'work_checkin':
        return (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <Clock className="h-12 w-12 text-orange-600 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold">Processing Work Check-In</h3>
            <p className="text-sm text-muted-foreground">
              Recording your work attendance...
            </p>
          </div>
        );

      case 'class_selection':
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <BookOpen className="h-8 w-8 text-purple-600 mx-auto" />
              <h3 className="text-lg font-semibold">Select Classes to Check Into</h3>
              <p className="text-sm text-muted-foreground">
                Choose which classes you want to check into today
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {availableClasses.map((classItem) => (
                <Card 
                  key={classItem.id} 
                  className={`cursor-pointer transition-all ${
                    selectedClassIds.includes(classItem.id) 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleClassSelection(classItem.id, !selectedClassIds.includes(classItem.id))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        checked={selectedClassIds.includes(classItem.id)}
                        onChange={() => {}} // Handled by card click
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {classItem.code}
                          </Badge>
                          <span className="font-medium text-sm">{classItem.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {classItem.department}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {classItem.duration_hours}h
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('success')}
                className="flex-1"
              >
                Skip Class Check-In
              </Button>
              <Button 
                onClick={handleClassCheckIn}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Checking In...' : 'Check Into Classes'}
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold text-green-800">Check-In Successful!</h3>
            
            {userInfo && (
              <div className="bg-green-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">{userInfo.name}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700">Checked in at {userInfo.timeIn}</span>
                </div>
                {selectedClassIds.length > 0 && (
                  <div className="text-sm text-green-700">
                    Also checked into {selectedClassIds.length} class{selectedClassIds.length > 1 ? 'es' : ''}
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={() => {
                setCurrentStep('initial');
                setUserInfo(null);
                setSelectedClassIds([]);
                setAvailableClasses([]);
                onSuccess?.();
              }}
              variant="outline"
              className="w-full"
            >
              Check In Another Person
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Quick Check-In</CardTitle>
        <CardDescription>
          Biometric authentication for work and class attendance
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderStepContent()}

        {/* Progress Indicator */}
        <div className="flex justify-center space-x-2 pt-4">
          {(['initial', 'biometric', 'location', 'work_checkin', 'class_selection', 'success'] as CheckInStep[]).map((step, index) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentStep === step
                  ? 'bg-blue-600'
                  : index < (['initial', 'biometric', 'location', 'work_checkin', 'class_selection', 'success'] as CheckInStep[]).indexOf(currentStep)
                  ? 'bg-green-600'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}