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
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown
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
  watchdogStatus: "ok" | "warned";
  milestonesCount: number;
  completedMilestonesCount: number;
  latestWatchdogMessage?: string | null;
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
  const [scanningWatchdog, setScanningWatchdog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 1. Fetch projects
      const projData = await apiRequest("/api/projects");
      const activeProj = projData.projects || [];
      setProjects(activeProj);

      // 2. Fetch stats & insights
      const insightsData = await apiRequest("/api/insights");
      if (insightsData?.streaks) {
        setStats(insightsData.streaks);
      }

    } catch (e) {
      console.error("Error loading dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleRunWatchdogScan = async () => {
    if (scanningWatchdog) return;
    try {
      setScanningWatchdog(true);
      const watchdogData = await apiRequest("/api/watchdog", { method: "POST" });
      
      // Re-fetch project list
      const refreshedProjData = await apiRequest("/api/projects");
      setProjects(refreshedProjData.projects || []);
      
      console.log(`Watchdog scan completed! Nudged ${watchdogData?.nudgedCount || 0} projects.`);
    } catch (e) {
      console.error("Error triggering watchdog scan:", e);
    } finally {
      setScanningWatchdog(false);
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

  // Extract recent watchdog alerts to display during render (no useEffect, no extra state)
  const watchdogAlerts = projects
    .filter(p => p.watchdogStatus === "warned" && p.status === "active")
    .map(p => ({
      id: p.id,
      title: p.title,
      message: p.latestWatchdogMessage || "Aapka is project par progress ruk gaya hai! Double check detail page for Watchdog callout."
    }));

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

      {/* Watchdog Callout Banner */}
      {watchdogAlerts.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2 text-yellow-500">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-yellow-400">
                Watchdog Alert: Inactivity Detected!
              </h3>
              <p className="mt-1 text-sm text-neutral-300">
                You haven&apos;t updated some active projects in over 48 hours. The Watchdog Agent is not happy.
              </p>
              <div className="mt-3 space-y-2">
                {watchdogAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={`/projects/${alert.id}`}
                    className="flex items-center justify-between rounded-lg bg-neutral-900/60 hover:bg-neutral-900 border border-white/5 px-4 py-2.5 text-sm text-white transition-all group"
                  >
                    <span className="font-semibold">{alert.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-violet-400 font-medium group-hover:underline">
                      See accountability nudges
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
            <button
              onClick={handleRunWatchdogScan}
              disabled={scanningWatchdog}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-all flex items-center gap-1.5 bg-neutral-900/40 border border-white/5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
            >
              {scanningWatchdog ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent"></div>
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="h-3.5 w-3.5 text-yellow-500" />
                  <span>Scan Health</span>
                </>
              )}
            </button>
          </div>

          {activeProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 p-12 text-center">
              <Target className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
              <h3 className="text-lg font-bold text-white">No active projects</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Arey yaar, a free mind is a playground for abandonment. Add a project!
              </p>
              <Link
                href="/projects/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/5 px-4 py-2 text-sm font-semibold text-white transition-all"
              >
                Create Project
              </Link>
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

                      {/* Title & Desc */}
                      <Link href={`/projects/${p.id}`} className="group block">
                        <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors line-clamp-1">
                          {p.title}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 min-h-[2.5rem]">
                          {p.description}
                        </p>
                      </Link>

                      {/* Watchdog Warning Banner */}
                      {p.watchdogStatus === "warned" && (
                        <div className="mt-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/5 p-2.5 text-xs text-yellow-400 flex items-start gap-1.5">
                          <AlertOctagon className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold">Watchdog Alert:</span>{" "}
                            <span className="italic text-neutral-300">
                              &ldquo;{p.latestWatchdogMessage || "Aapka is project par progress ruk gaya hai!"}&rdquo;
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Progress bar with violet-to-emerald gradient */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-1">
                          <span>Progress</span>
                          <span>{p.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-500"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                      </div>

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
                        <Link
                          href={`/projects/${p.id}`}
                          className="rounded-lg bg-neutral-900 border border-white/5 px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white"
                        >
                          &rarr; Open
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
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
