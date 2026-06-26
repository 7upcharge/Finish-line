"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  const isLoginPage = pathname === "/login";

  // While checking auth status on landing, show a dark loading state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#040406]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-neutral-400">Syncing authentication status...</p>
        </div>
      </div>
    );
  }

  // If we are on the login page or user is not logged in, render child contents full-screen
  if (isLoginPage || !user) {
    return <div className="w-full min-h-screen bg-[#040406]">{children}</div>;
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Scrollable container for main page */}
      <main className="flex-1 flex flex-col min-h-screen md:pl-64 bg-[#040406]">
        <div className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
