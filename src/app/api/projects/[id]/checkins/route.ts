import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
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
    const { note, type } = body;

    if (!note) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
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

    const batch = db.batch();

    // 1. Add Check-in Document
    const checkinRef = projectRef.collection("checkins").doc();
    batch.set(checkinRef, {
      timestamp: FieldValue.serverTimestamp(),
      note,
      type: type || "progress",
    });

    // 2. Update Project Metadata
    batch.update(projectRef, {
      lastCheckIn: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      watchdogStatus: "ok",
    });

    // 3. Update User Streak / Last Activity
    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data() || {};
      const lastActivityTimestamp = userData.lastActivity;
      let currentStreak = userData.currentStreak || 1;
      let maxStreak = userData.maxStreak || 1;

      if (lastActivityTimestamp) {
        let lastActivityDate: Date;
        if (typeof lastActivityTimestamp.toDate === "function") {
          lastActivityDate = lastActivityTimestamp.toDate();
        } else if (lastActivityTimestamp._seconds !== undefined) {
          lastActivityDate = new Date(lastActivityTimestamp._seconds * 1000);
        } else if (typeof lastActivityTimestamp === "string") {
          lastActivityDate = new Date(lastActivityTimestamp);
        } else {
          lastActivityDate = new Date(0);
        }
        
        const now = new Date();
        const lastActDateOnly = new Date(lastActivityDate.getFullYear(), lastActivityDate.getMonth(), lastActivityDate.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayDifference = Math.round((nowDateOnly.getTime() - lastActDateOnly.getTime()) / (1000 * 60 * 60 * 24));

        if (dayDifference === 1) {
          currentStreak += 1;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else if (dayDifference > 1) {
          currentStreak = 1;
        }
      }

      batch.update(userRef, {
        currentStreak,
        maxStreak,
        lastActivity: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      message: "Check-in recorded successfully",
      type: type || "progress"
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/checkins error:", error);
    return NextResponse.json({ error: "Failed to post check-in" }, { status: 500 });
  }
}
