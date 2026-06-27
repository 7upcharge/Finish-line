import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";
import { runWatchdogAgent } from "@/lib/gemini";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  // Check if this is an admin CRON request or a user request
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let userId: string | null = null;

  if (!isCron) {
    // Authenticate user
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.uid;
  }

  try {
    // 1. Fetch active projects
    let query = db.collection("projects").where("status", "==", "active");
    if (userId) {
      query = query.where("ownerId", "==", userId);
    }

    const activeProjectsSnap = await query.get();
    const now = new Date();
    const nudgedProjects: string[] = [];
    const skippedProjects: string[] = [];

    for (const doc of activeProjectsSnap.docs) {
      const data = doc.data();
      const lastCheckIn = data.lastCheckIn?.toDate?.() || new Date(data.createdAt);
      
      const diffTime = Math.abs(now.getTime() - lastCheckIn.getTime());
      const hoursInactive = diffTime / (1000 * 60 * 60);

      // Check if inactive for > 48 hours
      if (hoursInactive >= 48) {
        // To avoid spamming, check if we sent a watchdog warning in the last 24 hours in agentMessages
        const lastWatchdogSnap = await db.collection("agentMessages")
          .where("projectId", "==", doc.id)
          .where("agentName", "==", "watchdog")
          .get();

        let shouldNudge = true;
        if (!lastWatchdogSnap.empty) {
          const messages = lastWatchdogSnap.docs
            .map((d: any) => ({
              createdAt: d.data().createdAt?.toDate?.() || new Date(d.data().createdAt || 0)
            }))
            .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

          const lastNudgeTime = messages[0].createdAt;
          const hoursSinceLastNudge = Math.abs(now.getTime() - lastNudgeTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceLastNudge < 24) {
            // Already nudged within 24 hours, skip
            shouldNudge = false;
            skippedProjects.push(data.title);
          }
        }

        if (shouldNudge) {
          // a. Fetch project data + owner data
          const ownerSnap = await db.collection("users").doc(data.ownerId).get();
          const ownerData = ownerSnap.exists ? ownerSnap.data() : null;

          // b. Fetch last 3 agentMessages for this project (avoid repetition)
          const previousMessagesSnap = await db.collection("agentMessages")
            .where("projectId", "==", doc.id)
            .get();
          
          const previousNudges = previousMessagesSnap.docs
            .map((mDoc: any) => ({
              message: mDoc.data().message,
              createdAt: mDoc.data().createdAt?.toDate?.() || new Date(mDoc.data().createdAt || 0)
            }))
            .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 3)
            .map((x: any) => x.message);

          // Fetch milestones and find last completed in memory (avoids missing Firestore composite index errors)
          const milestonesSnap = await doc.ref.collection("milestones").get();
          const milestones = milestonesSnap.docs.map((mDoc: any) => mDoc.data());
          const completedMilestones = milestones
            .filter((m: any) => m.status === "completed")
            .sort((a: any, b: any) => (b.order || 0) - (a.order || 0));
          const lastMilestone = completedMilestones.length > 0 ? completedMilestones[0].title : "None";

          // c. Fetch user's abandonment pattern from analytics collection
          let abandonmentPattern = "None";
          if (data.ownerId) {
            const analyticsSnap = await db
              .collection("users")
              .doc(data.ownerId)
              .collection("analytics")
              .doc("latest")
              .get();
            if (analyticsSnap.exists) {
              const analyticsData = analyticsSnap.data() || {};
              if (analyticsData.historicalInsights && Array.isArray(analyticsData.historicalInsights)) {
                abandonmentPattern = analyticsData.historicalInsights.join(" | ");
              }
            }
          }

          // d. Call Watchdog Agent with all context
          const daysInactive = Math.floor(hoursInactive / 24);
          const watchdogResult = await runWatchdogAgent(
            data.title,
            daysInactive,
            lastMilestone,
            abandonmentPattern,
            previousNudges
          );

          const { nudge } = watchdogResult;

          // e. Store response in agentMessages collection
          const batch = db.batch();
          
          const messageRef = db.collection("agentMessages").doc();
          batch.set(messageRef, {
            projectId: doc.id,
            userId: data.ownerId,
            agentName: "watchdog",
            message: nudge,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
            metadata: { 
              daysSilent: daysInactive, 
              lastMilestone: lastMilestone 
            }
          });

          // Mark project as warned
          batch.update(doc.ref, {
            watchdogStatus: "warned",
            updatedAt: FieldValue.serverTimestamp()
          });

          // Also write a system checkin for project visibility
          const checkinRef = doc.ref.collection("checkins").doc();
          batch.set(checkinRef, {
            timestamp: FieldValue.serverTimestamp(),
            note: `Watchdog warning sent: "${nudge}"`,
            type: "stuck",
          });

          await batch.commit();
          nudgedProjects.push(data.title);
        }
      }
    }

    return NextResponse.json({
      message: "Watchdog run completed.",
      nudgedCount: nudgedProjects.length,
      nudged: nudgedProjects,
      skippedCount: skippedProjects.length,
      skipped: skippedProjects
    });

  } catch (error) {
    console.error("Watchdog scan error:", error);
    return NextResponse.json({ error: "Failed to run watchdog scan" }, { status: 500 });
  }
}

// Support GET request for easy manual triggering or dashboard loading checks
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messageId } = await req.json();
    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }

    const msgRef = db.collection("agentMessages").doc(messageId);
    const doc = await msgRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const data = doc.data() || {};
    if (data.userId !== user.uid) {
      return NextResponse.json({ error: "Unauthorized to dismiss this message" }, { status: 403 });
    }

    // Mark as read in Firestore
    await msgRef.update({ read: true });

    // Also reset the watchdogStatus of the project
    if (data.projectId) {
      const projectRef = db.collection("projects").doc(data.projectId);
      await projectRef.update({ watchdogStatus: "ok" });
    }

    return NextResponse.json({ message: "Message marked as read" });
  } catch (error) {
    console.error("PUT /api/watchdog error:", error);
    return NextResponse.json({ error: "Failed to mark message as read" }, { status: 500 });
  }
}
