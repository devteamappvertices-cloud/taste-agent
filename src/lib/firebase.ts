"use client";

import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { EntityCard } from "./qloo";

// Firebase web config is public by design; access is enforced by Firestore rules (users/{uid}/chats only).
const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: "AIzaSyD2754yTkPnBk2MXYB5CAXF0WEQkkI3trc",
      authDomain: "tasteagent-official.firebaseapp.com",
      projectId: "tasteagent-official",
      storageBucket: "tasteagent-official.firebasestorage.app",
      messagingSenderId: "837014100704",
      appId: "1:837014100704:web:8ba6ba674c275dd5bace85",
    });
const auth = getAuth(app);
const db = getFirestore(app);

/** Signed-in user; `undefined` while Firebase restores the session. */
export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [, rerender] = useState(0);
  useEffect(() => {
    // A new email account gets its name a moment after sign-in; re-render so it shows.
    const refresh = () => rerender((n) => n + 1);
    window.addEventListener("taste-agent:profile", refresh);
    const stop = onAuthStateChanged(auth, setUser);
    return () => {
      stop();
      window.removeEventListener("taste-agent:profile", refresh);
    };
  }, []);
  return user;
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    // Popups blocked (common on phones): fall back to a full-page redirect.
    if ((err as { code?: string }).code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
    else if ((err as { code?: string }).code !== "auth/popup-closed-by-user") throw err;
  }
}

export const logOut = () => signOut(auth);

export const signInEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);

export async function signUpEmail(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name.trim()) {
    await updateProfile(user, { displayName: name.trim() });
    window.dispatchEvent(new Event("taste-agent:profile"));
  }
}

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

/** Firebase error codes in words a person can act on. */
export function authMessage(err: unknown) {
  const code = (err as { code?: string }).code ?? "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with this email. Create one instead.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/weak-password": "Use at least 6 characters for your password.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Enter your password.",
    "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
  };
  return messages[code] ?? "Something went wrong. Please try again.";
}

export interface SavedChat {
  id: string;
  title: string;
  /** Favorites the chat was based on, for "picked up from your past searches". */
  seeds: EntityCard[];
  turns: unknown[];
  updatedAt?: { toMillis(): number } | null;
}

const chats = (uid: string) => collection(db, "users", uid, "chats");

/** Latest chats, live. Returns the unsubscribe function. */
export function watchChats(uid: string, onChange: (list: SavedChat[]) => void) {
  return onSnapshot(query(chats(uid), orderBy("updatedAt", "desc"), limit(25)), (snap) =>
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedChat, "id">) }))),
  );
}

export function saveChat(uid: string, chat: Omit<SavedChat, "updatedAt">) {
  const { id, ...data } = chat;
  // Firestore rejects `undefined` fields; JSON round-trip drops them.
  return setDoc(doc(chats(uid), id), { ...JSON.parse(JSON.stringify(data)), updatedAt: serverTimestamp() });
}

export const deleteChat = (uid: string, id: string) => deleteDoc(doc(chats(uid), id));
