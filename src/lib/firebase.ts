"use client";

import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
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
  useEffect(() => onAuthStateChanged(auth, setUser), []);
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
