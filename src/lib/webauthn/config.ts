// lib/webauthn/config.ts

interface UserWithId {
  id: string | number;
}

// The origin should be your app's origin
export const rpName = 'attendance_project'; // Replace with your application name
export const rpID = process.env.NODE_ENV === 'production' 
  ? 'your-domain.com'  // Replace with your production domain
  : 'localhost';

export const origin = process.env.NODE_ENV === 'production'
  ? `https://${rpID}`
  : `http://${rpID}:3000`;

export function getUserWebAuthnId(user: UserWithId): string {
  // WebAuthn requires a string ID
  return user.id.toString();
}