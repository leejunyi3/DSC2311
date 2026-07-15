"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  SlidersHorizontal,
  AlertTriangle,
  BookOpen,
  Settings,
  Activity,
  Ship,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquareText },
  { href: "/simulator", label: "What-If Simulator", icon: SlidersHorizontal },
  { href: "/disruptions", label: "Disruptions", icon: AlertTriangle },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
  { href: "/diagnostics", label: "Diagnostics", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-base-600 bg-base-800 p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-1">
        <Ship className="h-6 w-6 text-status-live" aria-hidden />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Tuas Control Tower</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Resilience Monitor
          </p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link ${active ? "nav-link-active" : ""}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-1 pt-4 text-[10px] leading-snug text-slate-600">
        Student prototype. Not official PSA / MPA data.
      </p>
    </aside>
  );
}
