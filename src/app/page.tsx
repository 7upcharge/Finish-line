"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { 
  Flame, 
  Target, 
  Calendar, 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Cpu
} from "lucide-react";

interface Project {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "abandoned";
  priority: "low" | "medium" | "high";
  category: string;
  progress: number;
  lastCheckIn: string | null;
  deadline: string | null;
  createdAt: string;
  watchdogStatus: "ok" | "warned";
  milestonesCount: number;
  completedMilestonesCount: number;
  latestWatchdogMessage?: string | null;
  latestWatchdogMessageId?: string | null;
  latestWatchdogMessageRead?: boolean;
}

interface StreakStats {
  currentStreak: number;
  maxStreak: number;
  totalCompleted: number;
  totalAbandoned: number;
  finishRate: number;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<StreakStats>({
    currentStreak: 0,
    maxStreak: 0,
    totalCompleted: 0,
    totalAbandoned: 0,
    finishRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [coachFeedback, setCoachFeedback] = useState("");

  // Onboarding hook states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Blocker agent inline state
  const [stuckProjectId, setStuckProjectId] = useState<string | null>(null);
  const [stuckReason, setStuckReason] = useState("");
  const [submittingStuck, setSubmittingStuck] = useState(false);
  const [blockerResponses, setBlockerResponses] = useState<Record<string, { microAction: string; response: string }>>({});

  const handleCompleteOnboarding = useCallback(() => {
    localStorage.setItem("seen_onboarding", "true");
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem("seen_onboarding");
      if (!seen && user) {
        Promise.resolve().then(() => {
          setShowOnboarding(true);
        });
      }
    }
  }, [user]);

  useEffect(() => {
    if (!showOnboarding) return;

    const timer1 = setTimeout(() => setOnboardingStep(1), 1000);
    const timer2 = setTimeout(() => setOnboardingStep(2), 2600);
    const timer3 = setTimeout(() => setOnboardingStep(3), 4200);
    const timer4 = setTimeout(() => {
      setOnboardingStep(4);
      setTimeout(() => {
        handleCompleteOnboarding();
      }, 1000);
    }, 6500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [showOnboarding, handleCompleteOnboarding]);

  const getAbandonmentRisk = (p: Project) => {
    let daysSilent = 0;
    if (p.lastCheckIn) {
      const checkinDate = new Date(p.lastCheckIn);
      const diff = Math.abs(new Date().getTime() - checkinDate.getTime());
      daysSilent = Math.floor(diff / (1000 * 60 * 60 * 24));
    } else {
      const createdDate = new Date(p.createdAt);
      const diff = Math.abs(new Date().getTime() - createdDate.getTime());
      daysSilent = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    let daysUntilDeadline = 999;
    if (p.deadline) {
      const deadlineDate = new Date(p.deadline);
      const diff = deadlineDate.getTime() - new Date().getTime();
      daysUntilDeadline = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    if (daysSilent >= 4 || (p.deadline && daysUntilDeadline < 0 && p.progress < 100)) {
      return { label: "High", color: "text-red-400 border-red-500/20 bg-red-500/5", emoji: "🔴" };
    } else if (daysSilent >= 2 || (p.progress < 50 && daysUntilDeadline <= 7)) {
      return { label: "Medium", color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/5", emoji: "🟡" };
    } else {
      return { label: "Low", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5", emoji: "🟢" };
    }
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Auto run watchdog scan when opening the app
      await apiRequest("/api/watchdog", { method: "POST" });
      
      // 1. Fetch projects
      const projData = await apiRequest("/api/projects");
      const activeProj = projData.projects || [];
      setProjects(activeProj);

      // 2. Fetch stats & insights
      const insightsData = await apiRequest("/api/insights");
      if (insightsData?.streaks) {
        setStats(insightsData.streaks);
      }
      if (insightsData?.streakSummary) {
        setCoachFeedback(insightsData.streakSummary);
      }

    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDismissWatchdog = async (messageId: string | null | undefined, projectId: string) => {
    if (!messageId) return;
    try {
      await apiRequest("/api/watchdog", {
        method: "PUT",
        body: JSON.stringify({ messageId })
      });
      // Update local state immediately
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            watchdogStatus: "ok",
            latestWatchdogMessageRead: true
          };
        }
        return p;
      }));
    } catch (e) {
      console.error("Failed to dismiss watchdog message:", e);
    }
  };

  const handleStuckSubmit = async (projectId: string) => {
    if (!stuckReason.trim()) return;
    try {
      setSubmittingStuck(true);
      const res = await apiRequest(`/api/projects/${projectId}/stuck`, {
        method: "POST",
        body: JSON.stringify({ reason: stuckReason })
      });
      if (res && res.microAction) {
        setBlockerResponses(prev => ({
          ...prev,
          [projectId]: {
            microAction: res.microAction,
            response: res.response || "Here is a suggested next action."
          }
        }));
      }
      setStuckProjectId(null);
      setStuckReason("");
    } catch (e) {
      console.error("Failed to submit stuck reason:", e);
    } finally {
      setSubmittingStuck(false);
    }
  };

  useEffect(() => {
    if (user) {
      Promise.resolve().then(() => {
        fetchData();
      });
    }
  }, [user, fetchData]);

  const activeProjects = projects.filter((p) => p.status === "active");

  const getContextualHeading = () => {
    // 1. Check for silent projects (4+ days silent)
    let mostSilentProject: { title: string; days: number } | null = null;
    let maxDays = 0;
    
    for (const p of activeProjects) {
      if (p.lastCheckIn) {
        const checkinDate = new Date(p.lastCheckIn);
        const diff = new Date().getTime() - checkinDate.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days >= 4 && days > maxDays) {
          maxDays = days;
          mostSilentProject = { title: p.title, days };
        }
      }
    }

    if (mostSilentProject) {
      const title = (mostSilentProject as { title: string; days: number }).title;
      const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);
      return `${capitalizedTitle} is ${(mostSilentProject as { title: string; days: number }).days} days silent. Kya chal raha hai?`;
    }

    // 2. Check streak
    if (stats.currentStreak > 0) {
      return `${stats.currentStreak} day streak. Don't break it today.`;
    }

    // 3. All good
    if (activeProjects.length > 0) {
      return `${activeProjects.length} project${activeProjects.length > 1 ? "s" : ""} running. Pick one and move it forward.`;
    }

    return "No projects running. Pick a goal and get started!";
  };

  if (showOnboarding) {
    return (
      <div className={`fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-center transition-opacity duration-1000 ${
        onboardingStep === 4 ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}>
        <div className="max-w-lg px-6 text-center space-y-8 font-mono select-none">
          {onboardingStep >= 1 && (
            <div className="h-8">
              <p className="text-xl md:text-2xl font-light text-white typewriter-text animate-typewriter-1">
                You&apos;ve started 11 projects.
              </p>
            </div>
          )}
          {onboardingStep >= 2 && (
            <div className="h-8">
              <p className="text-xl md:text-2xl font-light text-white typewriter-text animate-typewriter-2">
                You&apos;ve finished 2.
              </p>
            </div>
          )}
          {onboardingStep >= 3 && (
            <div className="h-10">
              <p className="text-2xl md:text-3xl font-black text-violet-500 typewriter-text animate-typewriter-3">
                FinishLine changes that.
              </p>
            </div>
          )}
        </div>
        
        <button
          onClick={handleCompleteOnboarding}
          className="absolute bottom-6 right-6 text-xs text-neutral-500 hover:text-white transition-all bg-neutral-900/50 border border-white/5 rounded px-3.5 py-1.5 font-sans cursor-pointer"
        >
          Skip &rarr;
        </button>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-neutral-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Minimal Top Bar - 3 Columns Centered Grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center border-b border-white/5 pb-4 mb-2">
        <div className="text-xs text-neutral-500 font-medium sm:text-left text-center">
          Good morning, {user?.displayName?.split(" ")[0] || "Ronak"}
        </div>
        <div className="text-xs font-semibold text-neutral-400 sm:text-center text-center">
          {activeProjects.length} active &middot; {stats.totalCompleted} finished &middot; {Math.round(stats.finishRate)}% finish rate
        </div>
        <div className="sm:text-right text-center">
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white transition-all border border-white/5"
          >
            Add Project
          </Link>
        </div>
      </div>

      {/* Dynamic Contextual Heading */}
      <div className="pt-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl lg:text-4xl">
          {getContextualHeading()}
        </h1>
      </div>

      {/* Watchdog Dismissible Alert Card at Top */}
      {activeProjects.some(p => p.watchdogStatus === "warned" && !p.latestWatchdogMessageRead) && (
        <div className="space-y-3">
          {activeProjects
            .filter(p => p.watchdogStatus === "warned" && !p.latestWatchdogMessageRead && p.latestWatchdogMessage)
            .map(p => (
              <div 
                key={p.id} 
                className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 shadow-lg border-l-4 border-l-red-500 flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-red-500 shrink-0">
                    <AlertOctagon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-400">
                      Watchdog Warning: <span className="font-extrabold text-white">{p.title}</span> is silent!
                    </h3>
                    <p className="mt-1 text-sm text-neutral-300 italic">
                      &ldquo;{p.latestWatchdogMessage}&rdquo;
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDismissWatchdog(p.latestWatchdogMessageId, p.id)}
                  className="rounded-lg bg-neutral-900 border border-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ))
          }
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
        {/* Streak: Orange Accent, Flame Icon, Slightly Larger */}
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 shadow-lg shadow-orange-500/5 p-6 flex items-center justify-between transition-all scale-105 hover:scale-108 duration-300">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-400">
              Current Streak
            </p>
            <h3 className="text-4xl font-black text-white mt-1">
              {stats.currentStreak} Days
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              Best record: {stats.maxStreak} days
            </p>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 text-orange-400">
            <Flame className="h-7 w-7 fill-current" />
          </div>
        </div>

        {/* Finish Rate: Green if >= 50%, Red if < 50%, with Trend Arrow */}
        {(() => {
          const isHigh = stats.finishRate >= 50;
          return (
            <div className={`rounded-xl glass-panel p-5 flex items-center justify-between transition-all border ${
              isHigh ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"
            }`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Finish Rate
                </p>
                <h3 className={`text-3xl font-extrabold mt-1 ${isHigh ? "text-emerald-400" : "text-rose-400"}`}>
                  {stats.finishRate}%
                </h3>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Completed vs Abandoned
                </p>
              </div>
              <div className={`rounded-xl p-3 ${
                isHigh ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
              }`}>
                {isHigh ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
            </div>
          );
        })()}

        {/* Active Projects: Yellow warning if > 3 projects running */}
        {(() => {
          const isWarning = activeProjects.length > 3;
          return (
            <div className={`rounded-xl glass-panel p-5 flex items-center justify-between transition-all border ${
              isWarning ? "border-yellow-500/30 bg-yellow-500/5" : "border-white/5"
            }`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Active Projects
                </p>
                <h3 className={`text-3xl font-extrabold mt-1 ${isWarning ? "text-yellow-400" : "text-white"}`}>
                  {activeProjects.length}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {isWarning ? "Overload! Focus on finishing." : "In-progress projects"}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${
                isWarning ? "bg-yellow-500/10 text-yellow-500" : "bg-violet-500/10 text-violet-400"
              }`}>
                {isWarning ? <AlertOctagon className="h-6 w-6 animate-pulse" /> : <Target className="h-6 w-6" />}
              </div>
            </div>
          );
        })()}

        {/* Project History: Muted, Smallest, Archive Data */}
        <div className="rounded-xl glass-panel p-4 flex items-center justify-between opacity-60 scale-95 origin-center transition-all border border-white/5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Project History
            </p>
            <h3 className="text-xl font-bold text-neutral-300 mt-0.5">
              {stats.totalCompleted} <span className="text-[10px] font-normal text-neutral-500">Done</span> / {stats.totalAbandoned} <span className="text-[10px] font-normal text-neutral-500">Drop</span>
            </h3>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Archive data
            </p>
          </div>
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-2 text-neutral-500">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Main Section layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Active Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Active Projects
              <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
                {activeProjects.length}
              </span>
            </h2>
          </div>

          {activeProjects.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-12 text-center max-w-xl mx-auto space-y-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                <Target className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  11 shuru. 2 khatam.
                </h3>
                <p className="text-lg font-bold text-violet-400">
                  Aaj kaunsa finish karte hain?
                </p>
                <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto">
                  Abandonment loop ko todne ka time aa gaya hai. Let&apos;s build habits that stick.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/projects/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all"
                >
                  Add Your First Project &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeProjects.map((p) => {
                // Calculate days since last check-in
                let daysSinceCheckin = "No updates yet";
                let days = 0;
                let isSilent = false;
                let healthBorderClass = "border-l-emerald-500";
                
                if (p.lastCheckIn) {
                  const checkinDate = new Date(p.lastCheckIn);
                  const diff = Math.abs(new Date().getTime() - checkinDate.getTime());
                  days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  daysSinceCheckin = days === 0 ? "Updated today" : `${days} day${days > 1 ? "s" : ""} ago`;
                  
                  if (days === 0) {
                    healthBorderClass = "border-l-emerald-500";
                  } else if (days >= 2 && days <= 3) {
                    healthBorderClass = "border-l-yellow-500";
                  } else if (days >= 4) {
                    healthBorderClass = "border-l-rose-500";
                    isSilent = true;
                  } else {
                    healthBorderClass = "border-l-emerald-500"; // 1 day silent is still green
                  }
                } else {
                  // Never updated is red health (4+ days silent)
                  healthBorderClass = "border-l-rose-500";
                  isSilent = true;
                }

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl glass-panel p-5 border-l-4 ${healthBorderClass} flex flex-col justify-between transition-all hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-600/5`}
                  >
                    <div>
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="rounded-md bg-neutral-900 border border-white/5 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
                          {p.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Abandonment Risk Badge */}
                          {(() => {
                            const risk = getAbandonmentRisk(p);
                            return (
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold border ${risk.color}`}>
                                Risk: {risk.label} {risk.emoji}
                              </span>
                            );
                          })()}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              p.priority === "high"
                                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                : p.priority === "medium"
                                ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                                : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                            }`}
                          >
                            {p.priority}
                          </span>
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <Link href={`/projects/${p.id}`} className="group block">
                        <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors line-clamp-1">
                          {p.title}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 min-h-[2.5rem]">
                          {p.description}
                        </p>
                      </Link>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Progress bar with violet-to-emerald gradient */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-1">
                          <span>Progress</span>
                          <span>{p.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-neutral-950 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Watchdog warning message displayed inline below progress bar */}
                      {p.watchdogStatus === "warned" && p.latestWatchdogMessage && (
                        <p className="text-[11px] text-orange-400 font-medium italic mt-2 leading-relaxed">
                          &ldquo;{p.latestWatchdogMessage}&rdquo;
                        </p>
                      )}

                      {/* Bottom Info & Action */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                            Last Update
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${
                            isSilent ? "text-red-500 font-extrabold" : "font-bold text-neutral-300"
                          }`}>
                            <Clock className={`h-3 w-3 shrink-0 ${isSilent ? "text-red-500" : "text-neutral-400"}`} />
                            {daysSinceCheckin}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setStuckProjectId(stuckProjectId === p.id ? null : p.id);
                              setStuckReason("");
                            }}
                            className="rounded-lg bg-red-600 hover:bg-red-500 border border-red-500/20 px-2.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer"
                          >
                            I&apos;m Stuck
                          </button>
                          <Link
                            href={`/projects/${p.id}`}
                            className="rounded-lg bg-neutral-900 border border-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white"
                          >
                            &rarr; Open
                          </Link>
                        </div>
                      </div>

                      {/* Stuck Blocker Input Box */}
                      {stuckProjectId === p.id && (
                        <div className="mt-3 p-3 bg-red-950/20 border border-red-500/20 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">What is blocking you, Boss?</p>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={stuckReason}
                              onChange={(e) => setStuckReason(e.target.value)}
                              placeholder="Describe roadblock (e.g. config errors or feeling lazy)..."
                              className="flex-1 rounded bg-neutral-950 border border-white/5 px-2.5 py-1 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-red-500"
                            />
                            <button
                              onClick={() => handleStuckSubmit(p.id)}
                              disabled={submittingStuck || !stuckReason.trim()}
                              className="rounded bg-red-600 hover:bg-red-500 px-3 py-1 text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {submittingStuck ? "..." : "Help Me"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Blocker Agent Inline Response */}
                      {blockerResponses[p.id] && (
                        <div className="mt-3 p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-2 relative animate-in fade-in duration-300">
                          <button 
                            onClick={() => setBlockerResponses(prev => {
                              const next = { ...prev };
                              delete next[p.id];
                              return next;
                            })}
                            className="absolute top-2.5 right-2.5 text-neutral-400 hover:text-white text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                            <span>🤖 Blocker Agent suggestion:</span>
                          </div>
                          <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                            {blockerResponses[p.id].response}
                          </p>
                          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                            <span className="font-extrabold text-red-300">Smallest Next Step (&lt; 10 min):</span>{" "}
                            <span className="text-white italic">{blockerResponses[p.id].microAction}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Coach Agent Card (Bottom Left of Left Column) */}
          {coachFeedback && (
            <div className="rounded-xl border border-white/5 bg-neutral-950/85 p-4 shadow-lg flex items-start gap-3 max-w-md mt-6">
              <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 text-violet-400 shrink-0">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider">Coach Agent</h4>
                <p className="mt-1 text-xs text-neutral-300 leading-relaxed line-clamp-3">
                  {coachFeedback}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Deadlines & Watchdog info */}
        <div className="space-y-6">
          {/* Upcoming Deadlines */}
          <div className="rounded-xl glass-panel p-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-neutral-400" />
              Deadlines
            </h2>

            {activeProjects.length === 0 ? (
              <p className="text-xs text-neutral-500">No active deadlines.</p>
            ) : (
              <div className="space-y-3">
                {activeProjects
                  .filter((p) => p.deadline)
                  .map((p) => {
                    const daysLeft = p.deadline
                      ? Math.ceil(
                          (new Date(p.deadline).getTime() - new Date().getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0;

                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="flex items-center justify-between rounded-lg bg-neutral-950 border border-white/5 px-3 py-2.5 transition-all hover:border-neutral-800"
                      >
                        <div className="overflow-hidden pr-2">
                          <p className="text-xs font-semibold text-white truncate">
                            {p.title}
                          </p>
                          <p className="text-[10px] text-neutral-500 font-medium">
                            {p.deadline ? new Date(p.deadline).toLocaleDateString() : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                            daysLeft < 0
                              ? "bg-red-500/10 border border-red-500/20 text-red-400"
                              : daysLeft <= 3
                              ? "bg-orange-500/10 border border-orange-500/20 text-orange-400"
                              : "bg-neutral-900 border border-white/5 text-neutral-400"
                          }`}
                        >
                          {daysLeft < 0
                            ? "Overdue"
                            : daysLeft === 0
                            ? "Today"
                            : `${daysLeft}d left`}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
