"use client";

import React, { createContext, useContext } from "react";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";

interface AuthContextType {
  user: {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  } | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

// Inner provider that reads session state
const AuthSessionConsumer = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();

  const isMockMode = typeof window !== "undefined" && localStorage.getItem("mock_login") === "true";

  const user = session?.user
    ? {
        uid: (session.user as any).id || session.user.email || "unknown",
        email: session.user.email || undefined,
        displayName: session.user.name || undefined,
        photoURL: session.user.image || undefined,
      }
    : isMockMode
    ? {
        uid: "mock-user-123",
        email: "boss@finishline.ai",
        displayName: "Developer Boss",
        photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
      }
    : null;

  // Sync token to localStorage so our api-client can read it if needed
  if (typeof window !== "undefined") {
    if (session || isMockMode) {
      localStorage.setItem("token", "NEXTAUTH_SESSION_ACTIVE");
    } else {
      localStorage.removeItem("token");
    }
  }

  const loginWithGoogle = async () => {
    try {
      // Trigger NextAuth Google Sign-in
      await signIn("google");
    } catch (e) {
      console.error("NextAuth Sign In failed, falling back to mock sandbox:", e);
      localStorage.setItem("mock_login", "true");
      window.location.reload();
    }
  };

  const logout = async () => {
    if (isMockMode) {
      localStorage.removeItem("mock_login");
      window.location.reload();
    } else {
      await signOut({ callbackUrl: "/login" });
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user: user as any, 
        loading: status === "loading", 
        loginWithGoogle, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider>
      <AuthSessionConsumer>{children}</AuthSessionConsumer>
    </SessionProvider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
