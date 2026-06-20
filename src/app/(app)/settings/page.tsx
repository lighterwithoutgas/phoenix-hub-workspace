"use client";

import { Bell, Globe, LogOut, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Avatar, LeaderBadge, SectionTitle } from "@/components/ui";
import { roleAr } from "@/lib/arabic";
import { getTeam } from "@/lib/selectors";

export default function SettingsPage() {
  const { currentUser, data, logout } = useWorkspace();

  if (!currentUser) return null;
  const isLeader = currentUser.leaderOfTeamIds.length > 0;
  const teams = currentUser.teamIds.map((id) => getTeam(data, id)?.name).filter(Boolean);
  const ledTeams = currentUser.leaderOfTeamIds.map((id) => getTeam(data, id)?.name).filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">الإعدادات</h1>
        <p className="meta mt-1">الملف الشخصي وتفضيلات الحساب</p>
      </header>

      <section className="card card-pad">
        <div className="flex items-center gap-3">
          <Avatar name={currentUser.name} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-on-surface">{currentUser.name}</h2>
              {isLeader && <LeaderBadge />}
            </div>
            <p className="meta" dir="ltr">{currentUser.email}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-outline-variant/40 pb-2">
            <dt className="text-on-surface-variant">الدور</dt>
            <dd className="font-medium text-on-surface">{roleAr[currentUser.role]}</dd>
          </div>
          <div className="flex justify-between border-b border-outline-variant/40 pb-2">
            <dt className="text-on-surface-variant">الفرق</dt>
            <dd className="font-medium text-on-surface">{teams.join("، ") || "-"}</dd>
          </div>
          {ledTeams.length > 0 && (
            <div className="flex justify-between border-b border-outline-variant/40 pb-2">
              <dt className="text-on-surface-variant">يقود</dt>
              <dd className="font-medium text-on-surface">{ledTeams.join("، ")}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card card-pad">
        <SectionTitle><span className="flex items-center gap-2"><Bell className="h-4 w-4" /> الإشعارات</span></SectionTitle>
        <div className="space-y-2">
          {[["إشعارات داخل التطبيق", true], ["البريد الإلكتروني", true], ["الإشعارات الفورية", false]].map(([label, on]) => (
            <label key={label as string} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
              <span className="text-sm text-on-surface">{label as string}</span>
              <input type="checkbox" defaultChecked={on as boolean} className="h-4 w-4 accent-primary" />
            </label>
          ))}
        </div>
      </section>

      <section className="card card-pad">
        <SectionTitle><span className="flex items-center gap-2"><Globe className="h-4 w-4" /> العرض</span></SectionTitle>
        <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
          <span className="text-sm text-on-surface">اللغة والاتجاه</span>
          <span className="meta">العربية · من اليمين لليسار (RTL)</span>
        </div>
      </section>

      <section className="card card-pad border-error/30">
        <SectionTitle><span className="flex items-center gap-2 text-error"><ShieldCheck className="h-4 w-4" /> منطقة الحساب</span></SectionTitle>
        <button onClick={() => logout()} className="btn-outline w-full justify-center gap-2">
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </section>
    </div>
  );
}
