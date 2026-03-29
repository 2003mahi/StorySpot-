import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, getDocFromServer, updateDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  getDocFromServer,
  updateDoc,
  deleteDoc
};
export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  errorCode?: string;
  userMessage?: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawError = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code || 'unknown';
  
  let userMessage = `Failed to ${operationType} at ${path}.`;

  switch (errorCode) {
    case 'permission-denied':
      userMessage = `Permission denied: You don't have the necessary rights to ${operationType} at ${path}. Check your security rules.`;
      break;
    case 'not-found':
      userMessage = `Not found: The requested document at ${path} was not found.`;
      break;
    case 'already-exists':
      userMessage = `Conflict: A document already exists at ${path}.`;
      break;
    case 'resource-exhausted':
      userMessage = `Quota exceeded: You have reached your Firestore limits.`;
      break;
    case 'failed-precondition':
      userMessage = `Operation failed: This might be due to a missing index or an invalid state.`;
      break;
    case 'unavailable':
      userMessage = `Network error: Firestore is currently unavailable. Check your connection.`;
      break;
    case 'unauthenticated':
      userMessage = `Authentication required: Please sign in to ${operationType} at ${path}.`;
      break;
    default:
      userMessage = `Error during ${operationType}: ${rawError}`;
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawError,
    errorCode,
    userMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
