// globals.d.ts
interface ChallengeData {
  challenge: string;
  expires: number;
}

declare global {
  var quickCheckInChallenges: Map<string, ChallengeData> | undefined;
  
  interface Window {
    tempAuthResult?: {
      credentialId: string;
      response: {
        authenticatorData: number[];
        clientDataJSON: number[];
        signature: number[];
        userHandle: number[] | null;
      };
      challengeId: string;
    };
  }
}

export {};