import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { FieldValue } from "firebase-admin/firestore";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, milestoneId } = await params;

  try {
    const body = await req.json();
    const { status } = body; // 'completed' or 'pending'

    if (status !== "completed" && status !== "pending") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const projectRef = db.collection("projects").doc(id);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();
    if (projectData?.ownerId !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const milestoneRef = projectRef.collection("milestones").doc(milestoneId);
    const milestoneSnap = await milestoneRef.get();

    if (!milestoneSnap.exists) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const milestoneData = milestoneSnap.data() || {};
    const milestoneTitle = milestoneData.title || "Unnamed Milestone";

    const batch = db.batch();

    // 1. Update Milestone Status
    batch.update(milestoneRef, {
      status,
      completedAt: status === "completed" ? FieldValue.serverTimestamp() : null,
    });

    // 2. Fetch all milestones to recalculate project progress (We'll do this by reading snapshot first)
    const milestonesSnap = await projectRef.collection("milestones").get();
    const milestones = milestonesSnap.docs.map((doc: any) => {
      if (doc.id === milestoneId) {
        return { ...doc.data(), status }; // use new status
      }
      return doc.data();
    });

    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m: any) => m.status === "completed").length;
    const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    // 3. Update project details
    batch.update(projectRef, {
      progress,
      updatedAt: FieldValue.serverTimestamp(),
      lastCheckIn: FieldValue.serverTimestamp(),
      watchdogStatus: "ok", // Activity clears watchdog warning
    });

    // 4. Add progress update check-in to project timeline
    const checkinRef = projectRef.collection("checkins").doc();
    batch.set(checkinRef, {
      timestamp: FieldValue.serverTimestamp(),
      note: status === "completed" 
        ? `Completed milestone: "${milestoneTitle}"`
        : `Re-opened milestone: "${milestoneTitle}"`,
      type: "progress",
    });

    // 5. Update user activity log and potential streak
    const userRef = db.collection("users").doc(user.uid);
    batch.update(userRef, {
      lastActivity: FieldValue.serverTimestamp()
    });

    await batch.commit();

    return NextResponse.json({ 
      message: "Milestone status updated", 
      progress,
      milestoneStatus: status
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/milestones/[milestoneId] error:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}
