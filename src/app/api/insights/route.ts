import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { runPatternAgent, runStreakAgent } from "@/lib/gemini";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectsSnapshot = await db
      .collection("projects")
      .where("ownerId", "==", user.uid)
      .get();

    const projectsList = [];
    const projectsForAgent = [];
    for (const doc of projectsSnapshot.docs) {
      const data = doc.data();
      const milestoneSnap = await doc.ref.collection("milestones").get();
      const milestones = milestoneSnap.docs.map((m: any) => m.data());
      const completedCount = milestones.filter((m: any) => m.status === 'completed').length;

      const createdAtDate = data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now());
      const now = new Date();
      const createdAtDaysAgo = Math.round((now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let durationDays = 0;
      let updatedAtDate = createdAtDate;
      if (data.updatedAt) {
        updatedAtDate = data.updatedAt.toDate?.() || new Date(data.updatedAt);
        durationDays = Math.max(1, Math.round((updatedAtDate.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      projectsList.push({
        id: doc.id,
        title: data.title || "Untitled",
        category: data.category || "General",
        status: data.status as "completed" | "abandoned" | "active",
        createdAtDaysAgo,
        durationDays,
        milestonesCount: milestones.length,
        completedMilestonesCount: completedCount,
      });

      projectsForAgent.push({
        project_name: data.title || "Untitled",
        start_date: createdAtDate.toISOString(),
        last_active_date: updatedAtDate.toISOString(),
        completed: data.status === "completed",
        milestones_done: completedCount,
        total_milestones: milestones.length
      });
    }

    const completedOrAbandoned = projectsList.filter((p: any) => p.status === 'completed' || p.status === 'abandoned');
    
    let insights;
    let isLearning = false;

    if (completedOrAbandoned.length >= 3) {
      // Trigger Pattern Agent
      const agentResult = await runPatternAgent(projectsForAgent);
      
      insights = {
        ...agentResult,
        
        // Mapped UI keys to maintain full backward compatibility with the frontend page.tsx
        averageAbandonmentDay: agentResult.abandonment_day_avg || 0,
        commonBlockers: [agentResult.trigger, agentResult.advice],
        predictedAbandonmentWarnings: projectsList
          .filter((p: any) => p.status === 'active')
          .map((p: any) => ({
            projectId: p.id,
            projectTitle: p.title,
            riskLevel: agentResult.risk_level || "high",
            warningReason: agentResult.predicted_next_abandonment || "At risk of abandonment"
          })),
        historicalInsights: [
          agentResult.pattern_summary,
          `Current finish rate is ${agentResult.finish_rate}.`,
          `Historical trigger: ${agentResult.trigger}`
        ],
        mostProductiveDays: ["Monday", "Wednesday"]
      };
      
      // Save analytics report to user document
      await db.collection("users").doc(user.uid).collection("analytics").doc("latest").set({
        ...insights,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      isLearning = true;
      // Return onboarding instructions & mock insights
      insights = {
        averageAbandonmentDay: 0,
        commonBlockers: ["Starting new projects too quickly", "Lack of milestone definitions"],
        predictedAbandonmentWarnings: projectsList
          .filter((p: any) => p.status === 'active')
          .map((p: any) => ({
            projectId: p.id,
            projectTitle: p.title,
            riskLevel: p.createdAtDaysAgo > 3 ? "medium" : "low",
            warningReason: p.createdAtDaysAgo > 3 
              ? `Boss, this project is already ${p.createdAtDaysAgo} days old. Focus on keeping up the momentum.`
              : "Badiya start! FinishLine Pattern Agent is monitoring your habits to unlock analytics."
          })),
        historicalInsights: [
          "Pattern Agent is in learning mode (requires at least 3 completed or abandoned projects).",
          "Try to check in daily or complete small milestones to build your streak.",
          "Keep checking in regularly so we can map out your productivity timeline."
        ],
        mostProductiveDays: ["Monday", "Wednesday"]
      };
    }

    // Get user streak details
    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    const activeProjectNames = projectsList
      .filter((p: any) => p.status === "active")
      .map((p: any) => p.title);

    const streakResult = await runStreakAgent(
      projectsList.length,
      userData.totalCompleted || 0,
      userData.currentStreak || 0,
      userData.maxStreak || 0,
      activeProjectNames
    );

    return NextResponse.json({
      isLearning,
      projectsCount: projectsList.length,
      completedOrAbandonedCount: completedOrAbandoned.length,
      insights,
      streakSummary: streakResult.summary,
      streaks: {
        currentStreak: userData.currentStreak || 0,
        maxStreak: userData.maxStreak || 0,
        totalCompleted: userData.totalCompleted || 0,
        totalAbandoned: userData.totalAbandoned || 0,
        finishRate: userData.finishRate || 0,
      }
    });

  } catch (error) {
    console.error("GET /api/insights error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
