"use client";

import React, { useEffect, useState } from "react";
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
  X, 
  Send,
  Bell
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
  const [watchdogAlerts, setWatchdogAlerts] = useState<{ id: string; title: string; message: string }[]>([]);
  const [unreadWatchdogCount, setUnreadWatchdogCount] = useState(0);
  const [coachFeedback, setCoachFeedback] = useState("");
  const [scanningWatchdog, setScanningWatchdog] = useState(false);

  // Check-in modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinType, setCheckinType] = useState<"progress" | "stuck">("progress");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 1. Fetch projects
      const projData = await apiRequest("/api/projects");
      const activeProj = projData.projects || [];
      setProjects(activeProj);
      setUnreadWatchdogCount(projData.unreadWatchdogCount || 0);

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
  };

  const handleRunWatchdogScan = async () => {
    if (scanningWatchdog) return;
    try {
      setScanningWatchdog(true);
      const watchdogData = await apiRequest("/api/watchdog", { method: "POST" });
      
      // Re-fetch project list and unread alert count
      const refreshedProjData = await apiRequest("/api/projects");
      setProjects(refreshedProjData.projects || []);
      setUnreadWatchdogCount(refreshedProjData.unreadWatchdogCount || 0);
      
      console.log(`Watchdog scan completed! Nudged ${watchdogData?.nudgedCount || 0} projects.`);
    } catch (e) {
      console.error("Error triggering watchdog scan:", e);
    } finally {
      setScanningWatchdog(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Extract recent watchdog alerts to display
  useEffect(() => {
    const alerts: { id: string; title: string; message: string }[] = [];
    
    // Find active projects that are flagged as warned
    projects.forEach(p => {
      if (p.watchdogStatus === "warned" && p.status === "active") {
        alerts.push({
          id: p.id,
          title: p.title,
          message: p.latestWatchdogMessage || "Aapka is project par progress ruk gaya hai! Double check detail page for Watchdog callout."
        });
      }
    });
    setWatchdogAlerts(alerts);
  }, [projects]);

  const handleOpenCheckin = (project: Project) => {
    setSelectedProject(project);
    setCheckinNote("");
    setCheckinType("progress");
  };

  const handleCloseCheckin = () => {
    setSelectedProject(null);
  };

  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !checkinNote.trim()) return;

    try {
      setSubmittingCheckin(true);
      await apiRequest(`/api/projects/${selectedProject.id}/checkins`, {
        method: "POST",
        body: JSON.stringify({
          note: checkinNote,
          type: checkinType,
        }),
      });

      // Refresh page data
      await fetchData();
      handleCloseCheckin();
    } catch (error) {
      console.error("Checkin submit error:", error);
    } finally {
      setSubmittingCheckin(false);
    }
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

  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Welcome back, {user?.displayName?.split(" ")[0] || "Boss"}!
            </h1>
            {unreadWatchdogCount > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse shrink-0">
                <Bell className="h-3 w-3 animate-bounce" />
                <span>{unreadWatchdogCount} Alert{unreadWatchdogCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-violet-400 font-semibold mt-1.5 whitespace-pre-line max-w-2xl bg-violet-950/20 border border-violet-800/10 rounded-xl p-3.5 shadow-inner">
            {coachFeedback || "Chalo, let's finish what you started today. No excuses."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleRunWatchdogScan}
            disabled={scanningWatchdog}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 border border-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-neutral-800 hover:border-white/20 disabled:opacity-50"
          >
            {scanningWatchdog ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <AlertOctagon className="h-4 w-4 text-yellow-500 animate-pulse" />
                <span>Run Watchdog Scan</span>
              </>
            )}
          </button>
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-violet-500"
          >
            Add New Project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
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
                You haven't updated some active projects in over 48 hours. The Watchdog Agent is not happy.
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Streak */}
        <div className="rounded-xl glass-panel p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Current Streak
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-1">
              {stats.currentStreak} Days
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              Best record: {stats.maxStreak} days
            </p>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 text-orange-400">
            <Flame className="h-6 w-6 fill-current" />
          </div>
        </div>

        {/* Finish Rate */}
        <div className="rounded-xl glass-panel p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Finish Rate
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-1">
              {stats.finishRate}%
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              Completed vs Abandoned
            </p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Active Projects */}
        <div className="rounded-xl glass-panel p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Active Projects
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-1">
              {activeProjects.length}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              In-progress projects
            </p>
          </div>
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3 text-violet-400">
            <Target className="h-6 w-6" />
          </div>
        </div>

        {/* Completed vs Abandoned */}
        <div className="rounded-xl glass-panel p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Project History
            </p>
            <h3 className="text-2xl font-extrabold text-white mt-1.5">
              {stats.totalCompleted} <span className="text-xs font-normal text-neutral-500">Done</span> / {stats.totalAbandoned} <span className="text-xs font-normal text-neutral-500">Drop</span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1">
              Total archived projects
            </p>
          </div>
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-blue-400">
            <CheckCircle2 className="h-6 w-6" />
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
                if (p.lastCheckIn) {
                  const checkinDate = new Date(p.lastCheckIn);
                  const diff = Math.abs(new Date().getTime() - checkinDate.getTime());
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  daysSinceCheckin = days === 0 ? "Updated today" : `${days} day${days > 1 ? "s" : ""} ago`;
                }

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl glass-panel p-5 flex flex-col justify-between transition-all hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-600/5 ${
                      p.watchdogStatus === "warned" ? "border-yellow-500/30 bg-yellow-500/5" : ""
                    }`}
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
                              "{p.latestWatchdogMessage || "Aapka is project par progress ruk gaya hai!"}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-1">
                          <span>Progress</span>
                          <span>{p.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all duration-500"
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
                          <span className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-neutral-400 shrink-0" />
                            {daysSinceCheckin}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenCheckin(p)}
                          className="rounded-lg bg-neutral-900 border border-white/5 px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white"
                        >
                          Check-in
                        </button>
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

      {/* Check-in Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-[450px] rounded-xl glass-panel-glow p-6 relative">
            <button
              onClick={handleCloseCheckin}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-white">
              Check-in: <span className="text-violet-400">{selectedProject.title}</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Add details of what you worked on. Watchdog will register your progress.
            </p>

            <form onSubmit={handleSubmitCheckin} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Status Type
                </label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setCheckinType("progress")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      checkinType === "progress"
                        ? "bg-violet-600/10 border-violet-500 text-violet-400"
                        : "bg-neutral-900 border-white/5 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    Doing Great (Progress)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckinType("stuck")}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                      checkinType === "stuck"
                        ? "bg-red-500/10 border-red-500/40 text-red-400"
                        : "bg-neutral-900 border-white/5 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    I'm Stuck
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  What's the update, Boss?
                </label>
                <textarea
                  required
                  rows={3}
                  value={checkinNote}
                  onChange={(e) => setCheckinNote(e.target.value)}
                  placeholder={
                    checkinType === "progress"
                      ? "Completed core user login flow and verified DB..."
                      : "Stuck on configuring Firestore rules for subcollections. Feeling overwhelmed."
                  }
                  className="w-full rounded-lg bg-neutral-950 border border-white/5 p-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500 mt-1 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingCheckin}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-xs font-bold text-white transition-all hover:bg-violet-500 disabled:opacity-50 disabled:pointer-events-none"
              >
                {submittingCheckin ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Submit Check-in
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
