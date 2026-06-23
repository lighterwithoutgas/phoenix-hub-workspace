"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Briefcase, FileText, Globe, Link2, LogOut, MapPin, Phone, ShieldCheck, UserCircle, CheckCircle2, Plus, X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Avatar, LeaderBadge, SectionTitle } from "@/components/ui";
import { roleAr } from "@/lib/arabic";
import { getTeam } from "@/lib/selectors";
import { userProfileSchema, type UserProfileInput } from "@/lib/schemas";

export default function SettingsPage() {
  const { currentUser, data, logout } = useWorkspace();

  if (!currentUser) return null;
  const isLeader = currentUser.leaderOfTeamIds.length > 0;
  const teams = currentUser.teamIds.map((id) => getTeam(data, id)?.name).filter(Boolean);
  const ledTeams = currentUser.leaderOfTeamIds.map((id) => getTeam(data, id)?.name).filter(Boolean);
  const profile = currentUser.profile;

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
            {profile?.jobTitle && (
              <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                <Briefcase className="h-3.5 w-3.5" /> {profile.jobTitle}
              </p>
            )}
            <p className="meta" dir="ltr">{currentUser.email}</p>
          </div>
        </div>

        {(profile?.location || profile?.phone) && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            {profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>}
            {profile?.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3.5 w-3.5" /> {profile.phone}</span>}
          </div>
        )}

        {profile?.bio && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-on-surface">نبذة</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">{profile.bio}</p>
          </div>
        )}

        {profile?.skills && profile.skills.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-on-surface">المهارات</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span key={skill} className="badge bg-primary/10 text-primary">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {(profile?.cvUrl || profile?.portfolioUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile?.cvUrl && (
              <a href={profile.cvUrl} target="_blank" rel="noreferrer" className="btn-outline gap-2">
                <FileText className="h-4 w-4" /> السيرة الذاتية
              </a>
            )}
            {profile?.portfolioUrl && (
              <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="btn-outline gap-2">
                <Link2 className="h-4 w-4" /> الأعمال
              </a>
            )}
          </div>
        )}

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

      <ProfileEditor />

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

function ProfileEditor() {
  const { currentUser, updateMyProfile } = useWorkspace();
  const [saved, setSaved] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm<UserProfileInput>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      jobTitle: currentUser?.profile?.jobTitle ?? "",
      phone: currentUser?.profile?.phone ?? "",
      location: currentUser?.profile?.location ?? "",
      bio: currentUser?.profile?.bio ?? "",
      skills: currentUser?.profile?.skills ?? [],
      cvUrl: currentUser?.profile?.cvUrl ?? "",
      portfolioUrl: currentUser?.profile?.portfolioUrl ?? "",
    },
  });

  const skills = watch("skills") ?? [];

  const addSkill = () => {
    const value = skillDraft.trim();
    if (!value || skills.includes(value) || skills.length >= 30) {
      setSkillDraft("");
      return;
    }
    setValue("skills", [...skills, value], { shouldDirty: true });
    setSkillDraft("");
  };

  const removeSkill = (skill: string) => {
    setValue("skills", skills.filter((item) => item !== skill), { shouldDirty: true });
  };

  return (
    <section className="card card-pad">
      <SectionTitle><span className="flex items-center gap-2"><UserCircle className="h-4 w-4" /> ملفي الشخصي</span></SectionTitle>
      <p className="meta -mt-2 mb-3">عرّف بنفسك للفريق: مسماك الوظيفي، مهاراتك، ورابط سيرتك الذاتية.</p>

      {saved && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-secondary/40 bg-secondary/5 px-3 py-2 text-sm text-on-surface">
          <CheckCircle2 className="h-4 w-4 text-secondary" /> تم حفظ ملفك الشخصي.
        </div>
      )}

      <form
        onSubmit={handleSubmit((input) => {
          updateMyProfile(input);
          reset(input);
          setSaved(true);
          window.setTimeout(() => setSaved(false), 3000);
        })}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">المسمى الوظيفي</label>
            <input className="input" placeholder="مثال: مهندس واجهات أمامية" {...register("jobTitle")} />
            {errors.jobTitle && <p className="mt-1 text-xs text-error">{errors.jobTitle.message}</p>}
          </div>
          <div>
            <label className="label">رقم التواصل</label>
            <input dir="ltr" className="input" placeholder="+20…" {...register("phone")} />
            {errors.phone && <p className="mt-1 text-xs text-error">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label className="label">الموقع</label>
          <input className="input" placeholder="المدينة، الدولة" {...register("location")} />
          {errors.location && <p className="mt-1 text-xs text-error">{errors.location.message}</p>}
        </div>

        <div>
          <label className="label">نبذة تعريفية</label>
          <textarea className="input min-h-24" placeholder="اكتب نبذة مختصرة عن خبرتك واهتماماتك المهنية." {...register("bio")} />
          {errors.bio && <p className="mt-1 text-xs text-error">{errors.bio.message}</p>}
        </div>

        <div>
          <label className="label">المهارات</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="أضف مهارة ثم اضغط Enter"
            />
            <button type="button" onClick={addSkill} className="btn-outline shrink-0 gap-1 px-3">
              <Plus className="h-4 w-4" /> إضافة
            </button>
          </div>
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="badge gap-1 bg-primary/10 text-primary">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} className="hover:text-error" aria-label={`إزالة ${skill}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">رابط السيرة الذاتية (CV)</label>
            <input dir="ltr" className="input" placeholder="https://…" {...register("cvUrl")} />
            {errors.cvUrl && <p className="mt-1 text-xs text-error">{errors.cvUrl.message}</p>}
          </div>
          <div>
            <label className="label">رابط الأعمال (Portfolio)</label>
            <input dir="ltr" className="input" placeholder="https://…" {...register("portfolioUrl")} />
            {errors.portfolioUrl && <p className="mt-1 text-xs text-error">{errors.portfolioUrl.message}</p>}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={!isDirty} className="btn-primary disabled:opacity-50">حفظ الملف الشخصي</button>
        </div>
      </form>
    </section>
  );
}
