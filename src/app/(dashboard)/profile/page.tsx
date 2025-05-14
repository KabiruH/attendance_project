'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PasswordChangeForm } from '@/components/profile/PasswordChangeForm';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { AttendanceStats } from '@/components/profile/AttendanceStats';
import { BiometricRegistration } from '@/components/profile/BiometricRegistration';
import { UserProfile, PasswordForm, AttendanceStats as AttendanceStatsType } from '@/lib/types/profile';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<AttendanceStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        // Check authentication first
        const authResponse = await fetch('/api/auth/check', {
          credentials: 'include'
        });

        if (!authResponse.ok) {
          router.push('/dashboard');
          return;
        }

        // If authenticated, fetch profile data
        fetchProfileData();
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/dashboard');
      }
    };

    checkAuthAndFetchData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const profileResponse = await fetch('/api/profile', {
        credentials: 'include',
      });

      if (!profileResponse.ok) {
        const error = await profileResponse.json();
        if (profileResponse.status === 401) {
          router.push('/dashboard');
          return;
        }
        throw new Error(error.message || 'Failed to fetch profile data');
      }

      const profileData = await profileResponse.json();
      setProfile(profileData);

      // Fetch attendance data
      const attendanceResponse = await fetch('/api/attendance/status', {
        credentials: 'include',
      });

      if (!attendanceResponse.ok) {
        throw new Error('Failed to fetch attendance data');
      }

      const attendanceData = await attendanceResponse.json();
      
      // Use the stats directly from the API response
      setStats(attendanceData.stats);
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load profile data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (data: Partial<UserProfile>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const updatedData = await response.json();
      setProfile(updatedData.data);
      setShowEditForm(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      setShowPasswordForm(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {profile && (
        <>
          <ProfileHeader
            {...profile}
            onPasswordChange={() => setShowPasswordForm(!showPasswordForm)}
            onEdit={() => setShowEditForm(!showEditForm)}
          />

          {showEditForm && (
            <ProfileEditForm
              profile={profile}
              onSubmit={handleEditSubmit}
              onCancel={() => setShowEditForm(false)}
              isSubmitting={isSubmitting}
            />
          )}

          {showPasswordForm && (
            <PasswordChangeForm
              onSubmit={handlePasswordChange}
              onCancel={() => setShowPasswordForm(false)}
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Biometric Registration Section */}
          <BiometricRegistration userId={profile.id} />

          {stats && <AttendanceStats stats={stats} />}
        </>
      )}
    </div>
  );
}