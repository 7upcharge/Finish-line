"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { LayoutDashboard, PlusCircle, LineChart, LogOut, Target, Menu, X } from "lucide-react";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [streak, setStreak] = useState(0);

  // Fetch current user streak to show in sidebar
  useEffect(() => {
    if (user) {
      apiRequest("/api/insights")
        .then((data) => {
          if (data?.streaks) {
            setStreak(data.streaks.currentStreak || 0);
          }
        })
        .catch((e) => console.log("Failed to fetch streak for sidebar:", e));
    }
  }, [user, pathname]); // Re-fetch on pathname change to refresh streak

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Add Project", href: "/projects/new", icon: PlusCircle },
    { name: "Insights", href: "/insights", icon: LineChart },
  ];

  if (!user) return null;

  return (
    <>
      {/* Desktop Sidebar container */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden md:flex w-64 flex-col border-r border-neutral-900 bg-neutral-950/80 backdrop-blur-md"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-neutral-900 px-6">
          <Target className="h-6 w-6 text-violet-500" />
          <span className="text-xl font-bold tracking-tight text-white">
            Finish<span className="text-violet-500">Line</span>
          </span>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 border-b border-neutral-900 p-6">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              className="h-10 w-10 rounded-full border border-violet-500/30"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold">
              {user.displayName?.[0] || user.email?.[0] || "U"}
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">
              {user.displayName || "Developer"}
            </p>
            <p className="text-xs text-neutral-500 truncate">{user.email}</p>
          </div>
        </div>

        {/* Streak Counter */}
        {streak > 0 && (
          <div className="mx-6 mt-4 flex items-center gap-1.5 text-xs text-orange-400/90 font-medium">
            <span>🔥</span>
            <span>{streak} Days</span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 py-2.5 pl-3 pr-4 text-sm font-medium transition-all border-l-2 ${
                  isActive
                    ? "border-violet-500 text-violet-400 bg-violet-500/5"
                    : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Log Out */}
        <div className="border-t border-neutral-900 p-4">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-neutral-400 transition-all hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sleek Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/90 backdrop-blur-lg border-t border-neutral-900/60 flex justify-around py-3 md:hidden">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
                isActive ? "text-violet-400" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Icon className="h-5.5 w-5.5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => logout()}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-red-400 transition-all cursor-pointer"
        >
          <LogOut className="h-5.5 w-5.5" />
          <span>Logout</span>
        </button>
      </nav>
    </>
  );
}
