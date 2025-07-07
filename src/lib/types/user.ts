// types/user.ts
export interface User {
    department: string;
    id: number;
    name: string;
    id_number: string;
    role: string;
    phone_number: string;
    gender: string;
    is_active: boolean;
    // New fields
    email: string | null;
    date_of_birth: string | null;
    id_card_path: string | null;
    passport_photo: string | null;
  }