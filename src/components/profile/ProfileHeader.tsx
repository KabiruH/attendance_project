// components/profile/ProfileHeader.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, Briefcase, Lock, Phone, UserCircle, Calendar, FileText, Edit } from 'lucide-react';
import { UserProfile } from '@/lib/types/profile';
import Link from 'next/link';

interface ProfileHeaderProps extends UserProfile {
  onPasswordChange: () => void;
  onEdit: () => void;
}

export function ProfileHeader({ 
  name, 
  email, 
  role, 
  phone_number, 
  id_number,
  gender,
  created_at,
  passport_photo,
  id_card_path,
  date_of_birth,
  onPasswordChange,
  onEdit
}: ProfileHeaderProps) {
  const formattedDate = new Date(created_at).toLocaleDateString();
  const formattedDOB = new Date(date_of_birth).toLocaleDateString();

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-6">
      <div className="flex flex-col items-center">
        <Avatar className="h-32 w-32">
          {passport_photo ? (
            <AvatarImage src={passport_photo} alt={name} />
          ) : (
            <AvatarFallback className="text-4xl">{name?.charAt(0)}</AvatarFallback>
          )}
        </Avatar>
      </div>

      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-gray-500">{role}</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
            <Button variant="outline" onClick={onPasswordChange}>
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center text-gray-600">
              <Mail className="w-4 h-4 mr-2" />
              {email}
            </div>
            <div className="flex items-center text-gray-600">
              <Briefcase className="w-4 h-4 mr-2" />
              {role}
            </div>
            <div className="flex items-center text-gray-600">
              <Phone className="w-4 h-4 mr-2" />
              {phone_number}
            </div>
            <div className="flex items-center text-gray-600">
              <UserCircle className="w-4 h-4 mr-2" />
              Gender: {gender}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              DOB: {formattedDOB}
            </div>
            <div className="flex items-center text-gray-600">
              <FileText className="w-4 h-4 mr-2" />
              ID Number: {id_number}
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              Joined: {formattedDate}
            </div>
            {id_card_path && (
              <Link 
                href={id_card_path}
                className="text-blue-600 hover:text-blue-800 flex items-center"
                target="_blank"
              >
                <FileText className="w-4 h-4 mr-2" />
                View ID Card
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}