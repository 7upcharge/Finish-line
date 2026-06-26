"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signIn } from "next-auth/react";
import { LogIn, Target, Bell, AlertTriangle, ShieldCheck, Flame, Cpu } from "lucide-react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleRealGoogleLogin = async () => {
    try {
      setAuthError(null);
      // Directly call NextAuth Google signIn
      await signIn("google");
    } catch (error) {
      console.error("Google OAuth error:", error);
      setAuthError("Failed to redirect to Google. Check your Client ID credentials.");
    }
  };

  const handleSandboxLogin = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_login", "true");
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#040406]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-neutral-400">Loading your FinishLine...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      {/* Background visual gradients */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40">
        <div className="h-[400px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-[500px] rounded-2xl glass-panel-glow p-8 md:p-10">
        {/* Logo and Tagline */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-4">
            <Target className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Finish<span className="text-violet-500">Line</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-400 font-medium">
            The Anti-Abandonment Agent
          </p>
        </div>

        {/* Info list about the 5 Agents */}
        <div className="mb-8 space-y-4 rounded-xl bg-neutral-900/50 border border-white/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
            Meet Your Accountability Team
          </h2>
          
          <div className="flex gap-3">
            <Target className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-neutral-200">1. Intake Agent</p>
              <p className="text-[11px] text-neutral-400">Generates 3-5 high-impact milestones instantly for new projects.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-neutral-200">2. Watchdog Agent</p>
              <p className="text-[11px] text-neutral-400">Tracks inactivity and nudges you in direct, honest Hinglish after 48h gaps.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-neutral-200">3. Blocker Agent</p>
              <p className="text-[11px] text-neutral-400">Suggests the smallest possible micro-action when you are stuck.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-neutral-200">4. Streak Agent</p>
              <p className="text-[11px] text-neutral-400">Tracks streaks and completion rates to keep your momentum high.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Flame className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-neutral-200">5. Pattern Agent</p>
              <p className="text-[11px] text-neutral-400">Analyzes long-term behavior and warns you before you abandon.</p>
            </div>
          </div>
        </div>

        {authError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 font-medium">
            {authError}
          </div>
        )}

        {/* Auth Buttons Stack */}
        <div className="space-y-3">
          {/* Real Google Login */}
          <button
            onClick={handleRealGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-violet-500 hover:shadow-violet-600/10 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </button>

          {/* Sandbox Local Login */}
          <button
            onClick={handleSandboxLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-neutral-900 border border-white/5 px-5 py-3.5 text-sm font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white"
          >
            <Cpu className="h-5 w-5 text-violet-400 shrink-0" />
            Continue in Sandbox Mode
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Secure OAuth redirects managed by NextAuth.
        </p>
      </div>
    </main>
  );
}
