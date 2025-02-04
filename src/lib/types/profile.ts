// types/profile.ts
export interface UserProfile {
    id: number;
    name: string;
    email: string;
    role: string;
    // Employee specific fields
    date_of_birth: string;
    id_card_path: string;
    passport_photo: string;
    // User specific fields
    id_number: string;
    phone_number: string;
    gender: string;
    created_at: string;
  }
  
  export interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }
  
  export interface AttendanceStats {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    attendanceRate: number;
  }