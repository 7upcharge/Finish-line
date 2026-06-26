"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { Target, Calendar, ClipboardList, Layers, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AddProject() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState("Coding");

  // Loading animation state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const categories = ["Coding", "Design", "Writing", "Learning", "Business", "Personal", "Other"];

  const loadingMessages = [
    "Intake Agent: Reading project scope...",
    "Intake Agent: Splitting project into actionable phases...",
    "Intake Agent: Generating 3-5 logical milestones in direct Hinglish...",
    "Streak Agent: Initializing completion streak records...",
    "Firestore: Storing project, milestones, and conversation logs...",
    "FinishLine: Done! Redirecting to detail page..."
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Handle cycle of loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < loadingMessages.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    try {
      setLoading(true);
      setLoadingStep(0);
      setErrorMsg(null);
      
      const result = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          deadline: deadline || null,
          priority,
          category
        })
      });

      if (result?.projectId) {
        // Wait a tiny bit on the final success message
        setTimeout(() => {
          router.push(`/projects/${result.projectId}`);
        }, 1000);
      }
    } catch (err: any) {
      console.error("Failed to create project:", err);
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back button */}
      <div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
      </div>

      {loading ? (
        /* Loading Animation Screen */
        <div className="rounded-xl glass-panel-glow p-10 flex flex-col items-center justify-center min-h-[350px] text-center">
          <div className="relative mb-6">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-500/20 border-t-violet-500"></div>
            <Target className="absolute inset-0 m-auto h-6 w-6 text-violet-400 animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Project</h3>
          <div className="h-6 overflow-hidden max-w-sm w-full">
            <p className="text-sm text-violet-400 font-semibold transition-all duration-300">
              {loadingMessages[loadingStep]}
            </p>
          </div>
          {/* Progress loader */}
          <div className="h-1 w-48 rounded-full bg-neutral-900 overflow-hidden mt-4 border border-white/5">
            <div 
              className="h-full bg-violet-500 transition-all duration-500" 
              style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
            />
          </div>
        </div>
      ) : (
        /* Form Card */
        <div className="rounded-xl glass-panel p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Create New Project</h1>
            <p className="text-xs text-neutral-400 mt-1">
              Add your project details. The Intake Agent will immediately break it down.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}
            {/* Title */}
            <div>
              <label htmlFor="title" className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2">
                Project Title
              </label>
              <input
                type="text"
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Build FinishLine SaaS App"
                className="w-full rounded-lg bg-neutral-950 border border-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2">
                Project Description
              </label>
              <textarea
                id="description"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to achieve, core features, and technology stack. Be as specific as possible so the Intake Agent can generate accurate milestones."
                className="w-full rounded-lg bg-neutral-950 border border-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {/* Deadline */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="deadline" className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                  Target Deadline
                </label>
                <input
                  type="date"
                  id="deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-lg bg-neutral-950 border border-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-neutral-400" />
                  Category
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-neutral-950 border border-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-neutral-400" />
                Priority
              </label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${
                      priority === p
                        ? p === "high"
                          ? "bg-red-500/10 border-red-500/40 text-red-400"
                          : p === "medium"
                          ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400"
                          : "bg-blue-500/10 border-blue-500/40 text-blue-400"
                        : "bg-neutral-900 border-white/5 text-neutral-400 hover:bg-neutral-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/10"
            >
              Analyze & Generate Milestones
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
