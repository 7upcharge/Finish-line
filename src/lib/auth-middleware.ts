import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyAuth(req: NextRequest): Promise<AuthenticatedUser | null> {
  // 1. Try checking NextAuth server-side session first
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return {
        uid: (session.user as any).id || session.user.email || "unknown",
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        picture: session.user.image || undefined,
      };
    }
  } catch (error) {
    console.error("Session verification failed, checking alternate auth header:", error);
  }

  // 2. Check for Authorization header indicating a client mock login session
  const authHeader = req.headers.get("authorization");
  if (authHeader === "Bearer NEXTAUTH_SESSION_ACTIVE") {
    return {
      uid: "mock-user-123",
      email: "boss@finishline.ai",
      name: "Developer Boss",
      picture: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
    };
  }

  // 3. Fallback for offline local sandbox runs when OAuth is not configured
  const hasGoogleOAuth = 
    !!process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID" &&
    !process.env.GOOGLE_CLIENT_ID.startsWith("YOUR_");

  if (!hasGoogleOAuth) {
    return {
      uid: "mock-user-123",
      email: "boss@finishline.ai",
      name: "Developer Boss",
      picture: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
    };
  }

  return null;
}
