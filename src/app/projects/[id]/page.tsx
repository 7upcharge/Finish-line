"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Send, 
  AlertTriangle, 
  User, 
  Bot, 
  Award,
  Zap,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

interface Milestone {
  id: string;
  title: string;
  order: number;
  status: "pending" | "completed";
  completedAt: string | null;
}

interface Checkin {
  id: string;
  timestamp: string;
  note: string;
  type: "progress" | "stuck" | "unstuck";
}

interface Conversation {
  id: string;
  timestamp: string;
  agentName: "Intake" | "Watchdog" | "Pattern" | "Blocker" | "Streak";
  userInput: string | null;
  aiResponse: string;
  metadata?: {
    microAction?: string;
  };
}

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
}

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const { id: projectId } = use(params);

  // States
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Blocker Agent form state
  const [stuckReason, setStuckReason] = useState("");
  const [submittingStuck, setSubmittingStuck] = useState(false);
  const [stuckResponse, setStuckResponse] = useState<{ microAction: string; response: string } | null>(null);
  const [showStuckModal, setShowStuckModal] = useState(false);

  // Quick checkin state
  const [quickNote, setQuickNote] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Milestone toggling lock
  const [togglingMilestoneId, setTogglingMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadProjectDetails = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/projects/${projectId}`);
      setProject(data.project);
      setMilestones(data.milestones || []);
      setCheckins(data.checkins || []);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Failed to load project details:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && projectId) {
      loadProjectDetails();
    }
  }, [user, projectId]);

  // Toggle milestone completion (optimistic update)
  const handleToggleMilestone = async (milestoneId: string, currentStatus: "pending" | "completed") => {
    if (togglingMilestoneId) return;

    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    
    // Optimistic UI updates
    setMilestones(prev => prev.map(m => {
      if (m.id === milestoneId) {
        return { ...m, status: newStatus, completedAt: newStatus === "completed" ? new Date().toISOString() : null };
      }
      return m;
    }));

    try {
      setTogglingMilestoneId(milestoneId);
      const data = await apiRequest(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      if (project) {
        setProject({ ...project, progress: data.progress });
      }

      // Re-fetch checkins/conversations to show updated logs
      const freshData = await apiRequest(`/api/projects/${projectId}`);
      setCheckins(freshData.checkins || []);
      setConversations(freshData.conversations || []);
    } catch (e) {
      console.error("Milestone toggle error:", e);
      // Revert on error
      setMilestones(prev => prev.map(m => {
        if (m.id === milestoneId) {
          return { ...m, status: currentStatus, completedAt: currentStatus === "completed" ? new Date().toISOString() : null };
        }
        return m;
      }));
    } finally {
      setTogglingMilestoneId(null);
    }
  };

  // Declaring stuck (Blocker Agent trigger)
  const handleDeclareStuck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuckReason.trim()) return;

    try {
      setSubmittingStuck(true);
      const result = await apiRequest(`/api/projects/${projectId}/stuck`, {
        method: "POST",
        body: JSON.stringify({ reason: stuckReason }),
      });

      setStuckResponse(result);
      setStuckReason("");

      // Refresh project records (chat logs, checkins)
      const data = await apiRequest(`/api/projects/${projectId}`);
      setProject(data.project);
      setConversations(data.conversations || []);
      setCheckins(data.checkins || []);
    } catch (error) {
      console.error("Stuck submit failed:", error);
    } finally {
      setSubmittingStuck(false);
    }
  };

  // Submit quick checkin
  const handleQuickCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;

    try {
      setSubmittingCheckin(true);
      await apiRequest(`/api/projects/${projectId}/checkins`, {
        method: "POST",
        body: JSON.stringify({
          note: quickNote,
          type: "progress"
        }),
      });

      setQuickNote("");
      
      // Refresh details
      const data = await apiRequest(`/api/projects/${projectId}`);
      setProject(data.project);
      setCheckins(data.checkins || []);
    } catch (error) {
      console.error("Quick checkin submit error:", error);
    } finally {
      setSubmittingCheckin(false);
    }
  };

  // Mark project status completed/abandoned
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const handleUpdateProjectStatus = async (status: "completed" | "abandoned") => {
    if (!confirm(`Are you sure you want to mark this project as ${status}?`)) return;

    try {
      setUpdatingStatus(true);
      await apiRequest(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadProjectDetails();
    } catch (err: any) {
      console.error("Status update failed:", err);
      alert(`Failed to update project status: ${err?.message || "Unknown error"}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-neutral-400">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Header breadcrumb & actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>

        {project.status === "active" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleUpdateProjectStatus("completed")}
              disabled={updatingStatus}
              className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingStatus ? "Updating..." : "Mark Completed"}
            </button>
            <button
              onClick={() => handleUpdateProjectStatus("abandoned")}
              disabled={updatingStatus}
              className="rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updatingStatus ? "Updating..." : "Abandon Project"}
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Columns: Overview, Milestones, and Stuck Agent */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details Banner */}
          <div className={`rounded-xl glass-panel p-6 ${project.watchdogStatus === "warned" ? "border-yellow-500/30 bg-yellow-500/3" : ""}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <span className="rounded-md bg-neutral-900 border border-white/5 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
                {project.category}
              </span>
              <div className="flex gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    project.priority === "high"
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : project.priority === "medium"
                      ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                  }`}
                >
                  {project.priority} priority
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    project.status === "active"
                      ? "bg-violet-500/10 border border-violet-500/20 text-violet-400"
                      : project.status === "completed"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
                >
                  {project.status}
                </span>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white md:text-3xl">{project.title}</h1>
            <p className="text-xs text-neutral-400 font-medium mt-2 leading-relaxed whitespace-pre-wrap">
              {project.description}
            </p>

            {/* Progress indicator */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 mb-1.5">
                <span>Overall Completion</span>
                <span>{project.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Milestones Checklist */}
          <div className="rounded-xl glass-panel p-6">
            <h2 className="text-lg font-bold text-white mb-4">Milestones Checklist</h2>
            <div className="divide-y divide-white/5 space-y-3.5">
              {milestones.map((m) => {
                const isCompleted = m.status === "completed";
                const Icon = isCompleted ? CheckSquare : Square;
                
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 pt-3.5 first:pt-0 ${
                      project.status !== "active" ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    <button
                      onClick={() => handleToggleMilestone(m.id, m.status)}
                      disabled={!!togglingMilestoneId}
                      className={`text-neutral-500 hover:text-violet-400 transition-colors shrink-0 mt-0.5 checkbox-animate`}
                    >
                      {togglingMilestoneId === m.id ? (
                        <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
                      ) : (
                        <Icon className={`h-5 w-5 ${isCompleted ? "text-violet-500" : "text-neutral-500"}`} />
                      )}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold transition-all ${
                          isCompleted ? "text-neutral-500 line-through" : "text-white"
                        }`}
                      >
                        {m.title}
                      </p>
                      {m.completedAt && (
                        <p className="text-[10px] text-neutral-500 font-medium mt-0.5">
                          Done {new Date(m.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocker Agent: Stuck helper */}
          {project.status === "active" && (
            <div className="rounded-xl glass-panel border-dashed border-red-500/20 bg-red-500/2 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  Stuck or Experiencing Decision Paralysis?
                </h3>
                {!showStuckModal && (
                  <button
                    onClick={() => {
                      setShowStuckModal(true);
                      setStuckResponse(null);
                    }}
                    className="rounded-lg bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-all"
                  >
                    I'm Stuck
                  </button>
                )}
              </div>

              {showStuckModal && (
                <div className="mt-4 border-t border-red-500/10 pt-4 space-y-4">
                  <form onSubmit={handleDeclareStuck} className="space-y-3">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      Sach batao yaar, what is the exact roadblock?
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={stuckReason}
                      onChange={(e) => setStuckReason(e.target.value)}
                      placeholder="e.g. I don't know what database library to select or the configuration feels confusing..."
                      className="w-full rounded-lg bg-neutral-950 border border-white/5 p-3 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-red-500 resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowStuckModal(false)}
                        className="rounded-lg bg-neutral-900 border border-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingStuck || !stuckReason.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50"
                      >
                        {submittingStuck ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 fill-current" />
                            Get Next Micro-Action
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Blocker agent response output */}
                  {stuckResponse && (
                    <div className="rounded-lg bg-neutral-950 border border-red-500/15 p-4 space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                        <Bot className="h-4 w-4" />
                        Blocker Agent Suggestion:
                      </div>
                      <p className="text-xs text-neutral-300 italic font-medium leading-relaxed">
                        "{stuckResponse.response}"
                      </p>
                      <div className="rounded border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
                        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
                          Next 10-Minute Action:
                        </p>
                        <p className="text-xs font-bold text-white mt-1">
                          {stuckResponse.microAction}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conversations History */}
          <div className="rounded-xl glass-panel p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Agent Conversation History</h2>
            
            {conversations.length === 0 ? (
              <p className="text-xs text-neutral-500">No agent interactions yet.</p>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {conversations.map((c) => (
                  <div key={c.id} className="space-y-2">
                    {/* User Prompt (If any) */}
                    {c.userInput && (
                      <div className="flex gap-2.5 max-w-[85%] ml-auto justify-end">
                        <div className="rounded-xl bg-violet-600/10 border border-violet-500/20 px-4 py-2.5 text-xs text-neutral-200">
                          <p className="font-semibold text-violet-400 text-[10px] uppercase tracking-wider mb-1">
                            You (Roadblock declared)
                          </p>
                          <p className="leading-relaxed">{c.userInput}</p>
                        </div>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 font-bold text-xs">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}

                    {/* Agent Response */}
                    <div className="flex gap-2.5 max-w-[85%] mr-auto justify-start">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 border border-white/5 text-neutral-400">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-xl bg-neutral-900/50 border border-white/5 px-4 py-2.5 text-xs text-neutral-200">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="font-semibold text-neutral-400 text-[10px] uppercase tracking-wider">
                            {c.agentName} Agent
                          </span>
                          <span className="h-1 w-1 rounded-full bg-neutral-700" />
                          <span className="text-[9px] text-neutral-600">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed text-neutral-300 italic">"{c.aiResponse}"</p>
                        
                        {/* If Blocker Agent returned microAction */}
                        {c.metadata?.microAction && (
                          <div className="mt-2.5 border-t border-white/5 pt-2.5 flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                            <div className="text-[10px]">
                              <span className="text-violet-400 font-semibold uppercase tracking-wider">
                                Micro-action:
                              </span>{" "}
                              <span className="text-white font-semibold">{c.metadata.microAction}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Project Metadata, Timeline checkins, quick updates */}
        <div className="space-y-6">
          {/* Quick Check-in form */}
          {project.status === "active" && (
            <div className="rounded-xl glass-panel p-5">
              <h3 className="text-sm font-bold text-white mb-2">Record Progress Check-in</h3>
              <form onSubmit={handleQuickCheckin} className="space-y-3">
                <textarea
                  required
                  rows={2}
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder="e.g. Worked 40 mins, wrote backend API routes..."
                  className="w-full rounded-lg bg-neutral-950 border border-white/5 p-3 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-violet-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingCheckin || !quickNote.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-xs font-bold text-white transition-all hover:bg-violet-500 disabled:opacity-50"
                >
                  {submittingCheckin ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      Post Update
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Project Stats and dates */}
          <div className="rounded-xl glass-panel p-5 space-y-3.5">
            <h3 className="text-sm font-bold text-white">Project Details</h3>
            
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-neutral-500">Target Deadline</span>
              <span className="font-semibold text-white flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                {project.deadline ? new Date(project.deadline).toLocaleDateString() : "No deadline"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-neutral-500">Last check-in</span>
              <span className="font-semibold text-white flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                {project.lastCheckIn ? new Date(project.lastCheckIn).toLocaleDateString() : "No updates"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Watchdog Status</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                  project.watchdogStatus === "warned"
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {project.watchdogStatus === "warned" ? "Warned" : "Active & OK"}
              </span>
            </div>
          </div>

          {/* Activity Timeline (Check-ins) */}
          <div className="rounded-xl glass-panel p-5">
            <h3 className="text-sm font-bold text-white mb-4">Activity Timeline</h3>
            
            {checkins.length === 0 ? (
              <p className="text-xs text-neutral-500">No activity logged yet.</p>
            ) : (
              <div className="relative border-l border-neutral-900 ml-2 space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {checkins.map((ch) => (
                  <div key={ch.id} className="relative pl-5">
                    {/* Circle Node */}
                    <span
                      className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                        ch.type === "stuck"
                          ? "bg-red-500 border-red-500"
                          : ch.type === "unstuck"
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-violet-600 border-violet-600"
                      }`}
                    />
                    <div>
                      <p className="text-[10px] text-neutral-500 font-medium">
                        {new Date(ch.timestamp).toLocaleDateString()} at{" "}
                        {new Date(ch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-neutral-300 font-semibold leading-relaxed mt-0.5">
                        {ch.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
