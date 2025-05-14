// lib/webauthn/session.ts
import { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || 'this-should-be-at-least-32-characters-long',
  cookieName: 'webauthn-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  },
};

// For challenge storage during registration (in-memory)
type ChallengeStore = {
  [userId: string]: {
    challenge: string;
    timeout?: NodeJS.Timeout;
  };
};

const challengeStore: ChallengeStore = {};

export function storeChallenge(userId: string, challenge: string): void {
  // Clear any existing timeout
  if (challengeStore[userId]?.timeout) {
    clearTimeout(challengeStore[userId].timeout);
  }
  
  // Store the new challenge with a 5-minute timeout
  const timeout = setTimeout(() => {
    delete challengeStore[userId];
  }, 5 * 60 * 1000); // 5 minutes
  
  challengeStore[userId] = { challenge, timeout };
}

export function getChallenge(userId: string): string | null {
  return challengeStore[userId]?.challenge || null;
}

export function clearChallenge(userId: string): void {
  if (challengeStore[userId]?.timeout) {
    clearTimeout(challengeStore[userId].timeout);
  }
  delete challengeStore[userId];
}

// Type declarations for iron-session
declare module 'iron-session' {
  interface IronSessionData {
    authChallenge?: string;
    userId?: number;
  }
}