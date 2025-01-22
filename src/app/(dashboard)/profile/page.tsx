'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit3, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const Profile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<ProfileData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [user, setUser] = useState<ProfileData | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          throw new Error('Failed to fetch profile');
        }
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to load profile data.',
          variant: 'destructive',
        });
      }
    };

    fetchProfile();
  }, [toast]);

  const updateuser = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/employees/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProfile),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Profile updated successfully.',
        });
        const updatedUser = await response.json();
        setUser(updatedUser);
        setIsEditing(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedProfile({});
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-extrabold text-gray-800">Profile</h1>
      {user ? (
        <Card className="bg-white shadow-lg rounded-lg">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-xl font-semibold text-gray-700">Employee Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editedProfile.name || user.name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-lg text-gray-900">{user.name}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              {isEditing ? (
                <input
                  type="email"
                  value={editedProfile.email || user.email}
                  onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-lg text-gray-900">{user.email}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Role</p>
              <p className="text-lg text-gray-900">{user.role}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Created At</p>
              <p className="text-lg text-gray-900">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>

            <div className="flex justify-end space-x-4">
              {isEditing ? (
                <>
                  <Button
                    onClick={updateuser}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md shadow-md transition"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setEditedProfile(user);
                    setIsEditing(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-md transition"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-gray-500">Loading...</p>
      )}
    </div>
  );
};

export default Profile;
