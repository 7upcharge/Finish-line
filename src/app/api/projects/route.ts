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
    let projectsSnapshot = await db
      .collection("projects")
      .where("ownerId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();

    // Seeding logic for first-time login/demo sandbox
    if (projectsSnapshot.empty) {
      console.log(`Seeding demo projects for user: ${user.uid}`);
      const batch = db.batch();

      // Project 1: "ML Internship prep" — abandoned day 5
      const p1Ref = db.collection("projects").doc();
      const p1CreatedAt = new Date();
      p1CreatedAt.setDate(p1CreatedAt.getDate() - 15);
      const p1UpdatedAt = new Date(p1CreatedAt);
      p1UpdatedAt.setDate(p1UpdatedAt.getDate() + 5);

      batch.set(p1Ref, {
        title: "ML Internship prep",
        description: "Preparing for Machine Learning internships and coding rounds.",
        status: "abandoned",
        createdAt: Timestamp.fromDate(p1CreatedAt),
        updatedAt: Timestamp.fromDate(p1UpdatedAt),
        lastCheckIn: Timestamp.fromDate(p1UpdatedAt),
        deadline: Timestamp.fromDate(new Date(p1CreatedAt.getTime() + 30 * 86400000)),
        progress: 50,
        ownerId: user.uid,
        priority: "high",
        category: "Coding",
        watchdogStatus: "ok"
      });
      // Milestones for P1
      const p1m1 = p1Ref.collection("milestones").doc();
      batch.set(p1m1, { title: "Complete ML crash course", order: 1, days: 2, status: "completed", completedAt: Timestamp.fromDate(p1UpdatedAt) });
      const p1m2 = p1Ref.collection("milestones").doc();
      batch.set(p1m2, { title: "Practice 50 LeetCode problems", order: 2, days: 5, status: "pending", completedAt: null });

      // Project 2: "Purplexity build" — completed
      const p2Ref = db.collection("projects").doc();
      const p2CreatedAt = new Date();
      p2CreatedAt.setDate(p2CreatedAt.getDate() - 30);
      const p2UpdatedAt = new Date(p2CreatedAt);
      p2UpdatedAt.setDate(p2UpdatedAt.getDate() + 10);

      batch.set(p2Ref, {
        title: "Purplexity build",
        description: "A AI-powered search tool utilizing LLM APIs.",
        status: "completed",
        createdAt: Timestamp.fromDate(p2CreatedAt),
        updatedAt: Timestamp.fromDate(p2UpdatedAt),
        lastCheckIn: Timestamp.fromDate(p2UpdatedAt),
        deadline: Timestamp.fromDate(new Date(p2CreatedAt.getTime() + 15 * 86400000)),
        progress: 100,
        ownerId: user.uid,
        priority: "medium",
        category: "Coding",
        watchdogStatus: "ok"
      });
      // Milestones for P2
      const p2m1 = p2Ref.collection("milestones").doc();
      batch.set(p2m1, { title: "Define search architecture & API keys", order: 1, days: 2, status: "completed", completedAt: Timestamp.fromDate(p2UpdatedAt) });
      const p2m2 = p2Ref.collection("milestones").doc();
      batch.set(p2m2, { title: "Implement UI and search API query flow", order: 2, days: 5, status: "completed", completedAt: Timestamp.fromDate(p2UpdatedAt) });

      // Project 3: "LumaAI" — abandoned day 4
      const p3Ref = db.collection("projects").doc();
      const p3CreatedAt = new Date();
      p3CreatedAt.setDate(p3CreatedAt.getDate() - 25);
      const p3UpdatedAt = new Date(p3CreatedAt);
      p3UpdatedAt.setDate(p3UpdatedAt.getDate() + 4);

      batch.set(p3Ref, {
        title: "LumaAI",
        description: "Testing out 3D NeRF generation models.",
        status: "abandoned",
        createdAt: Timestamp.fromDate(p3CreatedAt),
        updatedAt: Timestamp.fromDate(p3UpdatedAt),
        lastCheckIn: Timestamp.fromDate(p3UpdatedAt),
        deadline: Timestamp.fromDate(new Date(p3CreatedAt.getTime() + 10 * 86400000)),
        progress: 50,
        ownerId: user.uid,
        priority: "low",
        category: "Research",
        watchdogStatus: "ok"
      });
      // Milestones for P3
      const p3m1 = p3Ref.collection("milestones").doc();
      batch.set(p3m1, { title: "Review NeRF papers & download dataset", order: 1, days: 2, status: "completed", completedAt: Timestamp.fromDate(p3UpdatedAt) });
      const p3m2 = p3Ref.collection("milestones").doc();
      batch.set(p3m2, { title: "Train baseline model", order: 2, days: 5, status: "pending", completedAt: null });

      // Active Project: "Capstone project" — silent for 8 days
      const p4Ref = db.collection("projects").doc();
      const p4CreatedAt = new Date();
      p4CreatedAt.setDate(p4CreatedAt.getDate() - 10);
      const p4LastCheckin = new Date(p4CreatedAt);
      p4LastCheckin.setDate(p4LastCheckin.getDate() + 2); // checked in 8 days ago

      batch.set(p4Ref, {
        title: "Capstone project",
        description: "The main final year submission project.",
        status: "active",
        createdAt: Timestamp.fromDate(p4CreatedAt),
        updatedAt: Timestamp.fromDate(p4LastCheckin),
        lastCheckIn: Timestamp.fromDate(p4LastCheckin),
        deadline: Timestamp.fromDate(new Date(p4CreatedAt.getTime() + 30 * 86400000)),
        progress: 66,
        ownerId: user.uid,
        priority: "high",
        category: "Coding",
        watchdogStatus: "warned"
      });
      const p4m1 = p4Ref.collection("milestones").doc();
      batch.set(p4m1, { title: "Scope & design architecture", order: 1, days: 2, status: "completed", completedAt: Timestamp.fromDate(p4LastCheckin) });
      const p4m2 = p4Ref.collection("milestones").doc();
      batch.set(p4m2, { title: "Develop core engine and auth", order: 2, days: 5, status: "completed", completedAt: Timestamp.fromDate(p4LastCheckin) });
      const p4m3 = p4Ref.collection("milestones").doc();
      batch.set(p4m3, { title: "Integrate dashboard with analytics", order: 3, days: 4, status: "pending", completedAt: null });

      // Seed unread watchdog alert
      const msgRef = db.collection("agentMessages").doc();
      batch.set(msgRef, {
        projectId: p4Ref.id,
        userId: user.uid,
        agentName: "watchdog",
        message: "Capstone project is 8 days silent. Kya chal raha hai?",
        createdAt: Timestamp.fromDate(new Date()),
        read: false,
        metadata: {
          daysSilent: 8,
          lastMilestone: "Develop core engine and auth"
        }
      });

      // User stats document
      const userRef = db.collection("users").doc(user.uid);
      batch.set(userRef, {
        email: user.email || "",
        displayName: user.name || "Ronak",
        photoURL: user.picture || "",
        createdAt: FieldValue.serverTimestamp(),
        currentStreak: 2,
        maxStreak: 2,
        totalCompleted: 1,
        totalAbandoned: 2,
        finishRate: 33, // 1 completed / 3 finished/abandoned
        lastActivity: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // Refetch
      projectsSnapshot = await db
        .collection("projects")
        .where("ownerId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .get();
    }

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
        .map((mDoc: any) => ({ id: mDoc.id, ...mDoc.data() }))
        .sort((a: any, b: any) => {
          const t1 = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const t2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return t2.getTime() - t1.getTime();
        });
      const latestWatchdogMessage = messages.length > 0 ? messages[0].message : null;
      const latestWatchdogMessageId = messages.length > 0 ? messages[0].id : null;
      const latestWatchdogMessageRead = messages.length > 0 ? messages[0].read : false;

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
        latestWatchdogMessageId,
        latestWatchdogMessageRead,
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
