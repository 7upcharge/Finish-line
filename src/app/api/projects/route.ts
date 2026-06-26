import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { runIntakeAgent } from "@/lib/gemini";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectsSnapshot = await db
      .collection("projects")
      .where("ownerId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();

    // Fetch unread watchdog count for this user
    const unreadMessagesSnap = await db.collection("agentMessages")
      .where("userId", "==", user.uid)
      .where("read", "==", false)
      .get();
    const unreadWatchdogCount = unreadMessagesSnap.size;

    const projects = [];
    for (const doc of projectsSnapshot.docs) {
      const data = doc.data();
      
      // Fetch milestones count and completed count to calculate progress on the fly
      const milestonesSnapshot = await doc.ref.collection("milestones").get();
      const milestones = milestonesSnapshot.docs.map((mDoc: any) => ({
        id: mDoc.id,
        ...mDoc.data()
      }));
      
      const completedMilestonesCount = milestones.filter((m: any) => m.status === "completed").length;
      const progress = milestones.length > 0 
        ? Math.round((completedMilestonesCount / milestones.length) * 100) 
        : 0;

      // Fetch latest watchdog message for this project from agentMessages (sorted in memory to avoid missing index errors)
      const messagesSnap = await db.collection("agentMessages")
        .where("projectId", "==", doc.id)
        .where("agentName", "==", "watchdog")
        .get();
      const messages = messagesSnap.docs
        .map((mDoc: any) => mDoc.data())
        .sort((a: any, b: any) => {
          const t1 = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const t2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return t2.getTime() - t1.getTime();
        });
      const latestWatchdogMessage = messages.length > 0 ? messages[0].message : null;

      projects.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        category: data.category,
        watchdogStatus: data.watchdogStatus || "ok",
        progress,
        milestonesCount: milestones.length,
        completedMilestonesCount,
        latestWatchdogMessage,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
        lastCheckIn: data.lastCheckIn?.toDate?.() || null,
        deadline: data.deadline ? (data.deadline.toDate?.() || new Date(data.deadline)) : null,
      });
    }

    return NextResponse.json({ projects, unreadWatchdogCount });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, deadline, priority, category } = body;

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    // Call Intake Agent to generate milestones and kickoff message
    const intakeResult = await runIntakeAgent(title, description, deadline);
    const { milestones, kickoff_message, abandonment_risk, warning } = intakeResult;
    const finalKickoffMessage = kickoff_message || intakeResult.kickoffMessage || "Boss, let's start this!";
    const finalAbandonmentRisk = abandonment_risk || "General abandonment risk";
    const finalWarning = warning || "Keep showing up daily!";

    const batch = db.batch();
    const projectRef = db.collection("projects").doc();
    const projectId = projectRef.id;

    // Define Project Document
    const projectDoc = {
      title,
      description,
      deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastCheckIn: FieldValue.serverTimestamp(),
      progress: 0,
      ownerId: user.uid,
      priority: priority || "medium",
      category: category || "General",
      watchdogStatus: "ok",
      abandonmentRisk: finalAbandonmentRisk,
      warning: finalWarning,
    };

    batch.set(projectRef, projectDoc);

    // Save Milestones
    milestones.forEach((m: any, idx: number) => {
      const milestoneRef = projectRef.collection("milestones").doc();
      batch.set(milestoneRef, {
        title: m.title,
        order: m.order || (idx + 1),
        days: m.days || 1,
        status: "pending",
        completedAt: null,
      });
    });

    // Save Intake Conversation Message
    const conversationRef = projectRef.collection("conversations").doc();
    batch.set(conversationRef, {
      timestamp: FieldValue.serverTimestamp(),
      agentName: "Intake",
      userInput: null,
      aiResponse: finalKickoffMessage,
      metadata: { model: "gemini-2.5-flash" },
    });

    // Write user initial profile/streak if not exists, and update activity
    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      batch.set(userRef, {
        email: user.email || "",
        displayName: user.name || "",
        photoURL: user.picture || "",
        createdAt: FieldValue.serverTimestamp(),
        currentStreak: 1,
        maxStreak: 1,
        totalCompleted: 0,
        totalAbandoned: 0,
        finishRate: 0,
        lastActivity: FieldValue.serverTimestamp(),
      });
    } else {
      batch.update(userRef, {
        lastActivity: FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      projectId, 
      message: "Project created and milestones generated successfully.",
      kickoffMessage: finalKickoffMessage
    });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
