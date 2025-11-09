import { User as FirebaseUser } from 'firebase/auth';

declare module 'firebase/auth' {
  interface User extends FirebaseUser {
    uid: string;
    email: string | null;
    role?: string;
    // Add any other custom properties you have on your user object
  }
}

export {};
