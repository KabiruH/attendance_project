// globals.d.ts
declare global {
  var quickCheckInChallenges: Map<string, {
    challenge: string;
    timestamp: number;
    expires: number;
  }> | undefined;

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