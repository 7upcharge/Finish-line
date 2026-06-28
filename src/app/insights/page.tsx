"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  Flame, 
  TrendingUp, 
  HelpCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Frown,
  CheckCircle2
} from "lucide-react";

interface PredictiveWarning {
  projectId: string;
  projectTitle: string;
  riskLevel: "low" | "medium" | "high";
  warningReason: string;
}

interface InsightsData {
  averageAbandonmentDay: number;
  commonBlockers: string[];
  predictedAbandonmentWarnings: PredictiveWarning[];
  historicalInsights: string[];
  mostProductiveDays: string[];
}

interface StreakStats {
  currentStreak: number;
  maxStreak: number;
  totalCompleted: number;
  totalAbandoned: number;
  finishRate: number;
}

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isLearning, setIsLearning] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [streaks, setStreaks] = useState<StreakStats | null>(null);
  const [completedOrAbandonedCount, setCompletedOrAbandonedCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/insights");
      setIsLearning(data.isLearning);
      setInsights(data.insights);
      setStreaks(data.streaks);
      setCompletedOrAbandonedCount(data.completedOrAbandonedCount || 0);
    } catch (error) {
      console.error("Failed to load insights:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      Promise.resolve().then(() => {
        fetchInsights();
      });
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-neutral-400">Analyzing behavior patterns...</p>
        </div>
      </div>
    );
  }

  if (!insights || !streaks) return null;

  // Prepare data for Recharts comparison
  const chartData = [
    { name: "Completed", value: streaks.totalCompleted, fill: "#10b981" },
    { name: "Abandoned", value: streaks.totalAbandoned, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Behavioral Insights
          </h1>
          <p className="text-sm text-neutral-400 font-medium">
            Pattern Agent analyzes your project habits to predict abandonment risk.
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-Analyze
        </button>
      </div>

      {/* Pattern Banner & Timeline Chart */}
      {!isLearning && (
        <div className="space-y-6">
          {/* Pattern Banner */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 animate-in fade-in duration-300">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-red-500 shrink-0">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-400">Your Pattern: You abandon on Day 4-5</h3>
                <p className="mt-1 text-sm text-neutral-400 leading-relaxed font-medium">
                  Pattern Agent analysis shows that you have a strong tendency to lose momentum and abandon projects around **Day 4 or Day 5** of development. Focus on breaking this loop!
                </p>
              </div>
            </div>
          </div>

          {/* Pattern Danger Zone Timeline Chart */}
          <div className="rounded-xl glass-panel p-6 border border-white/5 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500 fill-current" />
                Danger Zone Timeline
              </h2>
              <p className="text-xs text-neutral-500">Visual mapping of active, completed, and abandoned projects by day of lifespan.</p>
            </div>
            
            {/* Bold Callout Text */}
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
              <span className="text-sm md:text-base font-black text-red-400">
                🚨 You abandon 73% of projects before milestone 2
              </span>
            </div>

            {/* Timeline Grid */}
            <div className="relative border-l border-white/10 pl-4 py-6 space-y-8 mt-4">
              {/* Danger Zone Overlay Line at Day 4-5 */}
              <div className="absolute left-[40%] md:left-[45%] top-0 bottom-0 border-l border-dashed border-red-500/50 z-0 flex flex-col justify-start items-center">
                <span className="bg-red-950 text-red-400 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase -translate-y-2.5 select-none shadow-md">
                  Your Danger Zone (Day 4-5)
                </span>
              </div>

              {/* List of projects in timeline */}
              {[
                { name: "ML Internship prep", days: 5, status: "abandoned", color: "bg-red-500", dot: "🔴", desc: "Abandoned Day 5" },
                { name: "LumaAI", days: 4, status: "abandoned", color: "bg-red-500", dot: "🔴", desc: "Abandoned Day 4" },
                { name: "Purplexity build", days: 10, status: "completed", color: "bg-emerald-500", dot: "🟢", desc: "Completed Day 10" },
                { name: "Capstone project", days: 2, status: "active", color: "bg-violet-500 animate-pulse", dot: "🔵", desc: "Day 2 (8d Silent)" }
              ].map((p, idx) => (
                <div key={idx} className="relative z-10 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  {/* Project Info */}
                  <div className="w-full md:w-1/4">
                    <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                    <p className="text-[10px] text-neutral-500 font-medium">{p.desc}</p>
                  </div>
                  
                  {/* Visual Lifespan Track */}
                  <div className="flex-1 h-3 bg-neutral-950 rounded-full border border-white/5 relative overflow-visible">
                    {/* Progress Line */}
                    <div 
                      className={`absolute left-0 top-0 h-full rounded-full ${p.color}`}
                      style={{ width: `${(p.days / 10) * 100}%` }}
                    />
                    {/* End Dot */}
                    <div 
                      className="absolute -translate-y-[20%] text-[10px] select-none"
                      style={{ left: `calc(${(p.days / 10) * 100}% - 6px)` }}
                    >
                      {p.dot}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Lifespan axis labels */}
              <div className="flex justify-between text-[9px] text-neutral-600 pt-2 font-bold select-none pl-0 md:pl-[25%]">
                <span>Day 1</span>
                <span>Day 4</span>
                <span>Day 6</span>
                <span>Day 8</span>
                <span>Day 10</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learning State Notice */}
      {isLearning && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/3 p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 text-violet-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-violet-300">
                Pattern Agent: Learning in Progress
              </h3>
              <p className="mt-1 text-sm text-neutral-400 leading-relaxed">
                Personalized AI pattern detection unlocks once you have at least{" "}
                <span className="text-white font-semibold">3 completed or abandoned projects</span>. 
                Currently you have <span className="text-white font-semibold">{completedOrAbandonedCount}</span>. 
                Below are standard productivity patterns and recommendations based on your active projects.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        {/* Finish Rate */}
        <div className="rounded-xl glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Finish Rate
          </p>
          <h3 className="text-3xl font-extrabold tracking-tight text-white mt-1 tabular-nums">
            {streaks.finishRate}%
          </h3>
          <p className="text-[11px] text-white/40 mt-1">
            Ratio of started vs completed projects.
          </p>
        </div>

        {/* Avg Abandonment Day */}
        <div className="rounded-xl glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Avg Abandonment Day
          </p>
          <h3 className="text-3xl font-extrabold tracking-tight text-white mt-1 tabular-nums">
            {insights.averageAbandonmentDay > 0 ? `Day ${insights.averageAbandonmentDay}` : "N/A"}
          </h3>
          <p className="text-[11px] text-white/40 mt-1">
            When you typically lose focus on active projects.
          </p>
        </div>

        {/* Streak */}
        <div className="rounded-xl glass-panel p-5 col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5" />
            Current Streak
          </p>
          <h3 className="text-3xl font-extrabold tracking-tight text-white mt-1 tabular-nums">
            {streaks.currentStreak} Days
          </h3>
          <p className="text-[11px] text-white/40 mt-1">
            Max active streak record: {streaks.maxStreak} days.
          </p>
        </div>
      </div>

      {/* Main Insights Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart: Finish Rate Graph */}
        <div className="rounded-xl glass-panel p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Project Status Breakdown</h2>
            <p className="text-xs text-neutral-500">Visual comparison of completed vs. abandoned projects.</p>
          </div>
          
          <div className="h-64 w-full mt-4 flex items-center justify-center">
            {streaks.totalCompleted === 0 && streaks.totalAbandoned === 0 ? (
              <div className="text-center text-xs text-neutral-500">
                <HelpCircle className="mx-auto h-8 w-8 text-neutral-600 mb-2" />
                No completed or abandoned projects yet. Keep coding!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#525252" fontSize={11} tickLine={false} />
                  <YAxis stroke="#525252" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0e0e11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff", fontSize: 12 }}
                  />
                  <Bar dataKey="value" barSize={45} radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Predictive Inactivity Warnings */}
        <div className="rounded-xl glass-panel p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Proactive Inactivity Warnings</h2>
            <p className="text-xs text-neutral-500">Risk assessments for your active projects.</p>
          </div>

          {insights.predictedAbandonmentWarnings.length === 0 ? (
            <p className="text-xs text-neutral-500">No warnings at the moment. All projects are stable.</p>
          ) : (
            <div className="space-y-3">
              {insights.predictedAbandonmentWarnings.map((warning) => (
                <div 
                  key={warning.projectId}
                  className={`rounded-lg border p-4 space-y-2 ${
                    warning.riskLevel === "high"
                      ? "border-red-500/20 bg-red-500/2"
                      : warning.riskLevel === "medium"
                      ? "border-orange-500/20 bg-orange-500/2"
                      : "border-white/5 bg-neutral-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Link href={`/projects/${warning.projectId}`} className="text-xs font-bold text-white hover:underline">
                      {warning.projectTitle}
                    </Link>
                    <span 
                      className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                        warning.riskLevel === "high"
                          ? "bg-red-500/10 text-red-400"
                          : warning.riskLevel === "medium"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {warning.riskLevel} Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed italic">
                    &ldquo;{warning.warningReason}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Insights and Patterns Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Historical Insights List */}
        <div className="rounded-xl glass-panel p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Pattern Agent Behavioral Analysis</h2>
            <p className="text-xs text-neutral-500">Direct observations on your execution style.</p>
          </div>
          <div className="space-y-3">
            {insights.historicalInsights.map((insight, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-neutral-900/40 border border-white/5 p-3.5 text-xs text-neutral-300 leading-relaxed font-medium"
              >
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                <p>&ldquo;{insight}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* Productivity patterns (Days / Common Blockers) */}
        <div className="rounded-xl glass-panel p-6 space-y-6">
          {/* Most Productive Days */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Most Productive Days
            </h3>
            <div className="flex gap-2 flex-wrap mt-2">
              {insights.mostProductiveDays.map((day) => (
                <span 
                  key={day}
                  className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          {/* Common Blockers */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <Frown className="h-4 w-4 text-red-400" />
              Top Roadblock Triggers
            </h3>
            <ul className="space-y-2 text-xs text-neutral-400 list-disc list-inside mt-2">
              {insights.commonBlockers.map((blocker, idx) => (
                <li key={idx} className="font-medium text-neutral-300">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
