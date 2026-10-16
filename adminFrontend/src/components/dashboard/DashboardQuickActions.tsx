"use client";

import Link from "next/link";
import { PlusCircle, Mic2, ListMusic, Shield } from "lucide-react";

export function DashboardQuickActions() {
  const actions = [
    {
      title: "Add Song",
      subtitle: "Upload & transcode",
      href: "/songs",
      icon: PlusCircle,
    },
    {
      title: "Manage Artists",
      subtitle: "Profiles & covers",
      href: "/artists",
      icon: Mic2,
    },
    {
      title: "Curate Playlists",
      subtitle: "Featured mixes",
      href: "/playlists",
      icon: ListMusic,
    },
    {
      title: "User Accounts",
      subtitle: "Roles & security",
      href: "/users",
      icon: Shield,
    },
  ];

  return (
    <div className="lg:col-span-2 bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-white">Quick Actions</h2>
          <p className="text-xs text-zinc-400">Fast shortcuts to common admin workflows</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-white">{action.title}</span>
              <span className="text-[11px] text-zinc-400 mt-1">{action.subtitle}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
