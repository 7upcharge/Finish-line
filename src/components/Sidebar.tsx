"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { LayoutDashboard, PlusCircle, LineChart, Flame, LogOut, Target, Menu, X } from "lucide-react";

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
      {/* Mobile Top Bar */}
      <div className="flex items-center justify-between border-b border-neutral-900 bg-neutral-950 px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Target className="h-5 w-5 text-violet-500" />
          <span className="font-bold tracking-tight text-white">FinishLine</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-neutral-400 hover:text-white"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-900 bg-neutral-950/80 backdrop-blur-md transition-transform duration-300 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
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
          <div className="mx-4 mt-4 flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 text-orange-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Finish Streak
            </span>
            <div className="flex items-center gap-1 font-bold">
              <Flame className="h-5 w-5 fill-current" />
              <span>{streak} Days</span>
            </div>
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
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-violet-600/10 border border-violet-500/20 text-violet-400"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent"
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
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-neutral-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
    </>
  );
}
