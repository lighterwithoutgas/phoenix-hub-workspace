"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { isElevated } from "@/lib/permissions";
import { roleAr } from "@/lib/arabic";
import { Avatar, LeaderBadge } from "./ui";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ListChecks, ClipboardList, Users2, FolderKanban, Calendar,
  BarChart3, FileStack, Megaphone, Bell, History, Settings, Search, Plus,
  LogOut, Menu, X, ChevronRight, HelpCircle, Home, UserCircle, Flame,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  show: (role: string, elevated: boolean) => boolean;
}

interface QuickItem {
  href: string;
  label: string;
  show: (role: string, elevated: boolean) => boolean;
}

const NAV: NavItem[] = [
  { href: "/overview", label: "نظرة عامة", icon: LayoutDashboard, show: () => true },
  { href: "/my-tasks", label: "مهامي", icon: ListChecks, show: (r) => r !== "viewer" },
  { href: "/tasks", label: "جميع المهام", icon: ClipboardList, show: (r, e) => e || r === "team_leader" },
  { href: "/team-tasks", label: "مهام الفرق", icon: Users2, show: () => true },
  { href: "/projects", label: "المشاريع", icon: FolderKanban, show: () => true },
  { href: "/teams", label: "الفرق", icon: Users2, show: () => true },
  { href: "/members", label: "الأعضاء", icon: Users2, show: (r, e) => e },
  { href: "/calendar", label: "التقويم", icon: Calendar, show: () => true },
  { href: "/analytics", label: "التحليلات", icon: BarChart3, show: (r, e) => e || r === "team_leader" },
  { href: "/templates", label: "القوالب", icon: FileStack, show: (r, e) => e || r === "team_leader" },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone, show: () => true },
  { href: "/notifications", label: "الإشعارات", icon: Bell, show: () => true },
  { href: "/activity", label: "سجل النشاط", icon: History, show: (r, e) => e || r === "team_leader" },
  { href: "/settings", label: "الإعدادات", icon: Settings, show: () => true },
];

const QUICK: QuickItem[] = [
  { label: "إنشاء مهمة", href: "/tasks/new?type=individual", show: (r, e) => e || r === "team_leader" },
  { label: "إنشاء مهمة فريق", href: "/tasks/new?type=team_shared", show: (r, e) => e || r === "team_leader" },
  { label: "إنشاء فريق", href: "/teams?create=1", show: (_r, e) => e },
  { label: "إنشاء مشروع", href: "/projects?create=1", show: (_r, e) => e },
  { label: "دعوة عضو", href: "/members?invite=1", show: (_r, e) => e },
  { label: "نشر إعلان", href: "/announcements?create=1", show: (r, e) => e || r === "team_leader" },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/overview", label: "الرئيسية", icon: Home, show: () => true },
  { href: "/my-tasks", label: "مهامي", icon: ListChecks, show: (r) => r !== "viewer" },
  { href: "/team-tasks", label: "مهام الفريق", icon: Users2, show: () => true },
  { href: "/notifications", label: "الإشعارات", icon: Bell, show: () => true },
  { href: "/settings", label: "حسابي", icon: UserCircle, show: () => true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, data, logout, ready } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (ready && !currentUser) router.replace("/login");
  }, [ready, currentUser, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
        <span className="animate-pulse">جارٍ تحميل مساحة العمل…</span>
      </div>
    );
  }
  if (!currentUser) return null;

  const elevated = isElevated(currentUser);
  const items = NAV.filter((n) => n.show(currentUser.role, elevated));
  const quickItems = QUICK.filter((item) => item.show(currentUser.role, elevated));
  const mobileItems = MOBILE_NAV.filter((item) => item.show(currentUser.role, elevated));
  const unread = data.notifications.filter((n) => n.recipientId === currentUser.id && !n.read).length;
  const isLeader = currentUser.leaderOfTeamIds.length > 0;
  const team = data.teams.find((t) => currentUser.teamIds.includes(t.id));

  const SidebarInner = (
    <>
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-card bg-primary text-on-primary">
          <Flame className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-on-surface">Phoenix Hub</p>
            <p className="meta">مساحة العمل</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2" aria-label="التنقل الرئيسي">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const showCount = item.href === "/notifications" && unread > 0;
          return (
            <Link key={item.href} href={item.href} className={cn("nav-link", active && "nav-link-active", collapsed && "justify-center")} title={item.label}>
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && showCount && (
                <span className="badge bg-error text-white">{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline-variant/60 p-3">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Avatar name={currentUser.name} size={36} />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-on-surface">{currentUser.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <span className="meta">{roleAr[currentUser.role]}</span>
              </div>
              {isLeader && <div className="mt-1"><LeaderBadge /></div>}
              {team && !isLeader && <p className="meta mt-0.5">{team.name}</p>}
            </div>
          )}
        </div>
        <button onClick={logout} className="btn-ghost mt-2 w-full text-error" aria-label="تسجيل الخروج">
          <LogOut className="h-4 w-4" />
          {!collapsed && "تسجيل الخروج"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar (right) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-l border-outline-variant/60 bg-surface-lowest transition-all md:flex",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {SidebarInner}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -left-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-surface-lowest text-on-surface-variant shadow-sm md:flex"
          aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute bottom-0 right-0 top-0 flex w-72 flex-col bg-surface-lowest">
            <button onClick={() => setMobileOpen(false)} className="absolute left-3 top-3 text-on-surface-variant" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-outline-variant/60 bg-surface-lowest/90 px-3 py-2.5 backdrop-blur sm:px-5">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2 md:hidden" aria-label="القائمة">
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input pr-9"
              placeholder="ابحث عن مهمة أو عضو أو فريق أو مشروع..."
              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/tasks?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`); }}
              aria-label="بحث"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {quickItems.length > 0 && (
              <div className="relative">
                <button onClick={() => setQuickOpen((o) => !o)} className="btn-primary px-3" aria-haspopup="menu" aria-expanded={quickOpen}>
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">إنشاء</span>
                </button>
                {quickOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setQuickOpen(false)} />
                    <div className="absolute left-0 z-20 mt-2 w-52 rounded-card border border-outline-variant bg-surface-lowest p-1.5 shadow-lg" role="menu">
                      {quickItems.map((q) => (
                        <Link key={q.label} href={q.href} className="block rounded-card px-3 py-2 text-sm text-on-surface hover:bg-surface-container" onClick={() => setQuickOpen(false)}>
                          {q.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <Link href="/notifications" className="btn-ghost relative p-2" aria-label={`الإشعارات (${unread} غير مقروءة)`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-mono text-[10px] text-white">
                  {unread}
                </span>
              )}
            </Link>
            <button className="btn-ghost hidden p-2 sm:flex" aria-label="مساعدة"><HelpCircle className="h-5 w-5" /></button>
            <Link href="/settings" aria-label="الحساب"><Avatar name={currentUser.name} size={32} /></Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-24 pt-4 sm:px-5 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 right-0 left-0 z-30 grid grid-cols-5 border-t border-outline-variant/60 bg-surface-lowest md:hidden" aria-label="التنقل السفلي">
          {mobileItems.map((it) => {
            const active = pathname.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "text-primary" : "text-on-surface-variant")}>
                <it.icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
