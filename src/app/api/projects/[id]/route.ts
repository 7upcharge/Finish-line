import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const projectRef = db.collection("projects").doc(id);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();
    if (projectData?.ownerId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch and mark watchdog messages as read, and reset project watchdogStatus
    const unreadMessagesSnap = await db.collection("agentMessages")
      .where("projectId", "==", id)
      .where("userId", "==", user.uid)
      .where("read", "==", false)
      .get();

    let updatedWatchdogStatus = projectData?.watchdogStatus || "ok";
    if (!unreadMessagesSnap.empty || projectData?.watchdogStatus === "warned") {
      const batch = db.batch();
      unreadMessagesSnap.docs.forEach((mDoc: any) => {
        batch.update(mDoc.ref, { read: true });
      });
      if (projectData?.watchdogStatus === "warned") {
        batch.update(projectRef, { watchdogStatus: "ok" });
        updatedWatchdogStatus = "ok";
      }
      await batch.commit();
    }

    // Fetch Milestones
    const milestonesSnap = await projectRef.collection("milestones").orderBy("order", "asc").get();
    const milestones = milestonesSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      completedAt: doc.data().completedAt?.toDate?.() || null,
    }));

    // Fetch Checkins
    const checkinsSnap = await projectRef.collection("checkins").orderBy("timestamp", "desc").get();
    const checkins = checkinsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || null,
    }));

    // Fetch Conversation history
    const conversationsSnap = await projectRef.collection("conversations").orderBy("timestamp", "asc").get();
    const conversations = conversationsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || null,
    }));

    // Calculate progress on the fly to keep synced
    const completedCount = milestones.filter((m: any) => m.status === "completed").length;
    const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

    return NextResponse.json({
      project: {
        id: projectSnap.id,
        ...projectData,
        watchdogStatus: updatedWatchdogStatus,
        progress,
        createdAt: projectData?.createdAt?.toDate?.() || null,
        updatedAt: projectData?.updatedAt?.toDate?.() || null,
        lastCheckIn: projectData?.lastCheckIn?.toDate?.() || null,
        deadline: projectData?.deadline?.toDate?.() || null,
      },
      milestones,
      checkins,
      conversations,
    });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to retrieve project details" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, title, description, priority, category } = body;

    const projectRef = db.collection("projects").doc(id);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();
    if (projectData?.ownerId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (category !== undefined) updates.category = category;

    // Handle project status changes (which trigger the Streak Agent stats update)
    if (status !== undefined && status !== projectData.status) {
      updates.status = status;

      const userRef = db.collection("users").doc(user.uid);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data() || {};
        let totalCompleted = userData.totalCompleted || 0;
        let totalAbandoned = userData.totalAbandoned || 0;
        let currentStreak = userData.currentStreak || 0;
        let maxStreak = userData.maxStreak || 0;

        if (status === "completed") {
          totalCompleted += 1;
          currentStreak += 1;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else if (status === "abandoned") {
          totalAbandoned += 1;
          currentStreak = 0; // Reset streak on abandonment
        }

        const totalProjects = totalCompleted + totalAbandoned;
        const finishRate = totalProjects > 0 ? Math.round((totalCompleted / totalProjects) * 100) : 0;

        await userRef.update({
          totalCompleted,
          totalAbandoned,
          currentStreak,
          maxStreak,
          finishRate,
          lastActivity: FieldValue.serverTimestamp(),
        });
      }
    }

    await projectRef.update(updates);

    return NextResponse.json({ message: "Project updated successfully" });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
