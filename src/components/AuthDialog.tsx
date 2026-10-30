"use client";

import { useEffect, useRef, useState } from "react";
import { authMessage, resetPassword, signIn, signInEmail, signUpEmail } from "@/lib/firebase";
import { GoogleIcon } from "@/components/Sidebar";

export type AuthMode = "signin" | "signup";

/** Sign in or create an account: Google, or email and password. Native <dialog> handles focus and Escape. */
export function AuthDialog({ mode: initial, reason, onClose }: { mode: AuthMode; reason?: string; onClose: () => void }) {
  const box = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const signup = mode === "signup";

  useEffect(() => {
    box.current?.showModal();
  }, []);

  async function run(task: () => Promise<unknown>, done = true) {
    setError("");
    setNote("");
    setWorking(true);
    try {
      await task();
      if (done) onClose();
      return true;
    } catch (err) {
      setError(authMessage(err));
      return false;
    } finally {
      setWorking(false);
    }
  }

  function switchTo(next: AuthMode) {
    setMode(next);
    setError("");
    setNote("");
  }

  const field =
    "mt-1 w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none placeholder:text-muted focus:border-forest focus-visible:outline-none";

  return (
    <dialog
      ref={box}
      onClose={onClose}
      onClick={(e) => e.target === box.current && box.current?.close()}
      aria-labelledby="auth-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-title" className="font-display text-2xl font-bold tracking-tight">
              {signup ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {reason ?? (signup ? "Save your chats and favorites, and get picks based on past searches." : "Sign in to see your saved chats and favorites.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => box.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper hover:text-ink"
          >
            ×
          </button>
        </div>

        <button
          type="button"
          disabled={working}
          onClick={() => run(signIn)}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-surface px-4 py-2.5 font-semibold ring-1 ring-line transition-colors hover:ring-forest disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => (signup ? signUpEmail(name, email, password) : signInEmail(email, password)));
          }}
          className="space-y-3"
        >
          {signup && (
            <label className="block text-sm font-medium">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" className={field} />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={field}
            />
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-baseline justify-between">
              Password
              {!signup && (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => {
                    if (!email.trim()) return setError("Enter your email first, then tap Forgot password.");
                    run(() => resetPassword(email.trim()), false).then((ok) => ok && setNote(`If an account exists for ${email.trim()}, a reset link is on its way.`));
                  }}
                  className="text-xs font-medium text-forest hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? "At least 6 characters" : "Your password"}
              className={field}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {note && (
            <p role="status" className="rounded-xl bg-mint px-3 py-2 text-sm text-forest">
              {note}
            </p>
          )}

          <button
            type="submit"
            disabled={working}
            className="w-full rounded-full bg-forest px-4 py-3 font-semibold text-forest-ink shadow-[0_10px_24px_-10px_var(--forest)] transition-transform duration-300 ease-[var(--ease-out)] hover:scale-[1.02] disabled:opacity-50"
          >
            {working ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {signup ? "Already have an account?" : "New to Taste Agent?"}{" "}
          <button type="button" onClick={() => switchTo(signup ? "signin" : "signup")} className="font-semibold text-forest hover:underline">
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </dialog>
  );
}
