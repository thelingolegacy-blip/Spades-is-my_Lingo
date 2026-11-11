import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SoloProgression, TrackerState } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore with Database ID from config
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Error Handling Infrastructure
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Secure Diagnostic Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test the Firestore connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection test completed successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Client is offline.");
    }
  }
}

// Google Login Provider Setup
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Log-Out Error:', error);
    throw error;
  }
}

// --- DB OPERATION WRAPPERS ---

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  avatarId: string;
  themeId: string;
  deckStyle: string;
  purchasedDecks: string[];
  chips: number;
  sweepstakesTickets: number;
  xp: number;
  level: number;
  activeSweepstakesEntries: number;
  streakDays: number;
  updatedAt: string;
  createdAt: string;
}

// Fetch or create a preference-only user profile in Firestore.
// Economic progression is local-only until the authoritative wallet API is deployed.
export async function syncUserProfile(user: User, existingProgress?: SoloProgression, existingTheme?: string, existingAvatar?: string, existingDeckStyle?: string, existingPurchasedDecks?: string[]): Promise<UserProfileData | null> {
  const path = `users/${user.uid}`;
  const timestamp = new Date().toISOString();
  const localProgress: SoloProgression = existingProgress || {
    chips: 2500, sweepstakesTickets: 3, xp: 120, level: 1,
    activeSweepstakesEntries: 0, streakDays: 1
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userSnapshot = await getDoc(userDocRef);
    let profilePreferences: Pick<UserProfileData, 'uid' | 'email' | 'displayName' | 'avatarId' | 'themeId' | 'deckStyle' | 'purchasedDecks' | 'updatedAt' | 'createdAt'>;

    if (userSnapshot.exists()) {
      const stored = userSnapshot.data() as Partial<UserProfileData>;
      profilePreferences = {
        uid: user.uid,
        email: user.email || stored.email || '',
        displayName: stored.displayName || user.displayName || 'Spades Master',
        avatarId: stored.avatarId || existingAvatar || 'avatar_rookie',
        themeId: stored.themeId || existingTheme || 'theme_cyber',
        deckStyle: stored.deckStyle || existingDeckStyle || 'deck_classic',
        purchasedDecks: existingPurchasedDecks || ['deck_classic'],
        updatedAt: stored.updatedAt || timestamp,
        createdAt: stored.createdAt || timestamp
      };
    } else {
      profilePreferences = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Spades Master',
        avatarId: existingAvatar || 'avatar_rookie',
        themeId: existingTheme || 'theme_cyber',
        deckStyle: 'deck_classic',
        purchasedDecks: ['deck_classic'],
        updatedAt: timestamp,
        createdAt: timestamp
      };
      await setDoc(userDocRef, profilePreferences);
    }

    return { ...profilePreferences, ...localProgress };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export type UserProfilePreferenceUpdates = Partial<Pick<UserProfileData, 'displayName' | 'avatarId' | 'themeId' | 'deckStyle'>>;

// Update only non-economic user profile preferences.
export async function updateUserProfile(uid: string, updates: UserProfilePreferenceUpdates): Promise<void> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const safeUpdates: Record<string, string> = { updatedAt: new Date().toISOString() };
    for (const key of ['displayName', 'avatarId', 'themeId', 'deckStyle'] as const) {
      const value = updates[key];
      if (typeof value === 'string') safeUpdates[key] = value;
    }
    if (Object.keys(safeUpdates).length > 1) await updateDoc(docRef, safeUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Historical scorecard session interface
export interface ScorecardSession {
  id: string;
  userId: string;
  teamAName: string;
  teamAScore: number;
  teamABags: number;
  teamBName: string;
  teamBScore: number;
  teamBBags: number;
  winningScore: number;
  rounds: any[];
  updatedAt: string;
  createdAt: string;
}

// Save a scoreboard session to Firestore
export async function saveScorecardSession(uid: string, session: Omit<ScorecardSession, 'userId' | 'updatedAt' | 'createdAt'>): Promise<void> {
  const path = `users/${uid}/sessions/${session.id}`;
  try {
    const sessionDocRef = doc(db, 'users', uid, 'sessions', session.id);
    const timestamp = new Date().toISOString();
    
    const completeSession: ScorecardSession = {
      ...session,
      userId: uid,
      updatedAt: timestamp,
      createdAt: timestamp
    };

    await setDoc(sessionDocRef, completeSession);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch all saved tracker sessions for user
export async function getScorecardSessions(uid: string): Promise<ScorecardSession[]> {
  const path = `users/${uid}/sessions`;
  try {
    const sessionsCol = collection(db, 'users', uid, 'sessions');
    const sessionsQuery = query(sessionsCol, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(sessionsQuery);
    
    const sessions: ScorecardSession[] = [];
    querySnapshot.forEach((docSnap) => {
      sessions.push(docSnap.data() as ScorecardSession);
    });
    return sessions;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Delete a saved tracker session
export async function deleteScorecardSession(uid: string, sessionId: string): Promise<void> {
  const path = `users/${uid}/sessions/${sessionId}`;
  try {
    const sessionDocRef = doc(db, 'users', uid, 'sessions', sessionId);
    await deleteDoc(sessionDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
