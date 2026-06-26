import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { runBlockerAgent } from "@/lib/gemini";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
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
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: "Reason for being stuck is required" }, { status: 400 });
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

    // Fetch Milestones to calculate context
    const milestonesSnap = await projectRef.collection("milestones").orderBy("order", "asc").get();
    const milestones = milestonesSnap.docs.map((doc: any) => doc.data());
    
    const completedMilestones = milestones
      .filter((m: any) => m.status === "completed")
      .map((m: any) => m.title);
    
    const pendingMilestones = milestones
      .filter((m: any) => m.status !== "completed")
      .map((m: any) => m.title);

    const currentMilestone = pendingMilestones[0] || "None";
    const techStack = projectData.category || "General";

    // Call Blocker Agent
    const blockerResult = await runBlockerAgent(
      projectData.title,
      currentMilestone,
      reason,
      techStack,
      completedMilestones
    );

    const { microAction, response } = blockerResult;

    const batch = db.batch();

    // 1. Add Blocker Conversation
    const conversationRef = projectRef.collection("conversations").doc();
    batch.set(conversationRef, {
      timestamp: FieldValue.serverTimestamp(),
      agentName: "Blocker",
      userInput: reason,
      aiResponse: response,
      metadata: {
        microAction,
        model: "gemini-2.5-flash"
      }
    });

    // 2. Add 'stuck' check-in on the timeline
    const checkinRef = projectRef.collection("checkins").doc();
    batch.set(checkinRef, {
      timestamp: FieldValue.serverTimestamp(),
      note: `Stuck: "${reason}" | AI Micro-action suggestion: "${microAction}"`,
      type: "stuck",
    });

    // 3. Update project last check-in and last activity
    batch.update(projectRef, {
      lastCheckIn: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      microAction,
      response,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/stuck error:", error);
    return NextResponse.json({ error: "Failed to resolve blocker" }, { status: 500 });
  }
}
