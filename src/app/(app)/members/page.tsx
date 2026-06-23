"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Briefcase, CheckCircle2, Copy, FileText, KeyRound, Link2, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Trash2, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { apiResetMemberPassword } from "@/lib/api/workspace";
import { can, isElevated } from "@/lib/permissions";
import { inviteSchema, type InviteInput } from "@/lib/schemas";
import { Avatar, ConfirmDialog, EmptyState, LeaderBadge } from "@/components/ui";
import { accountStatusAr, fmtRelative, invitationAr, roleAr } from "@/lib/arabic";
import type { User, UserRole } from "@/lib/types";

export default function MembersPage() {
  const { currentUser, data, inviteMember, resendInvitation, setMemberStatus, removeMember, cancelInvitation, updateMemberRole } = useWorkspace();
  const params = useSearchParams();
  const [showInvite, setShowInvite] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  useEffect(() => {
    if (params.get("invite") === "1") setShowInvite(true);
  }, [params]);

  if (!currentUser) return null;
  if (!isElevated(currentUser)) {
    return (
      <div className="card card-pad text-center">
        <EmptyState title="غير مصرح" hint="إدارة الأعضاء متاحة للمدراء فقط." icon={ShieldCheck} />
      </div>
    );
  }

  const teamName = (id: string) => data.teams.find((team) => team.id === id)?.name ?? id;
  const roleOptions: UserRole[] = ["admin", "team_leader", "member", "viewer"];
  const copyInviteLink = async (token?: string) => {
    if (!token || typeof window === "undefined") return;
    const url = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">الأعضاء</h1>
          <p className="meta mt-1">إدارة المستخدمين والأدوار والدعوات</p>
        </div>
        {can(currentUser, "invite_members") && (
          <button onClick={() => setShowInvite(true)} className="btn-primary gap-2">
            <UserPlus className="h-4 w-4" /> دعوة عضو
          </button>
        )}
      </header>

      {sent && (
        <div className="card card-pad flex items-center gap-2 border-secondary/40 bg-secondary/5 text-sm text-on-surface">
          <CheckCircle2 className="h-4 w-4 text-secondary" /> تم إنشاء الدعوة وإرسالها إلى <strong dir="ltr">{sent}</strong>.
        </div>
      )}
      {copied && (
        <div className="card card-pad flex items-center gap-2 border-secondary/40 bg-secondary/5 text-sm text-on-surface">
          <CheckCircle2 className="h-4 w-4 text-secondary" /> تم نسخ رابط الدعوة. يمكنك إرساله يدويا إذا لم يصل الإيميل.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
              <tr>
                <th className="p-3 font-medium">العضو</th>
                <th className="p-3 font-medium">الدور</th>
                <th className="p-3 font-medium">الفرق</th>
                <th className="p-3 font-medium">الحالة</th>
                <th className="p-3 font-medium">آخر دخول</th>
                <th className="p-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.users.map((user) => {
                const isLeader = user.leaderOfTeamIds.length > 0;
                const invitation = data.invitations.find((item) => item.email === user.email);
                const canChangeRole = can(currentUser, "manage_members") && user.id !== currentUser.id && user.role !== "owner";
                return (
                  <tr key={user.id} className="hover:bg-surface-container-low/50">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setProfileUser(user)}
                        className="flex items-center gap-2 rounded-card text-right transition hover:opacity-80"
                        title="عرض الملف الشخصي"
                      >
                        <Avatar name={user.name} size={32} />
                        <div>
                          <p className="font-medium text-on-surface underline-offset-4 hover:underline">{user.name}</p>
                          <p className="meta" dir="ltr">{user.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {canChangeRole ? (
                          <select
                            aria-label="تغيير الدور"
                            className="input h-9 min-w-36 py-1 text-sm"
                            value={user.role}
                            onChange={(event) => updateMemberRole(user.id, event.target.value as UserRole)}
                          >
                            {roleOptions.map((item) => (
                              <option key={item} value={item}>{roleAr[item]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-on-surface">{roleAr[user.role]}</span>
                        )}
                        {isLeader && <LeaderBadge />}
                      </div>
                    </td>
                    <td className="p-3 text-on-surface-variant">{user.teamIds.map(teamName).join("، ") || "-"}</td>
                    <td className="p-3">
                      <span className={`badge ${user.accountStatus === "active" ? "bg-secondary/10 text-secondary" : user.accountStatus === "invited" ? "bg-amber/10 text-amber" : "bg-error/10 text-error"}`}>
                        {accountStatusAr[user.accountStatus]}
                        {user.accountStatus === "invited" && user.invitationStatus ? ` · ${invitationAr[user.invitationStatus]}` : ""}
                      </span>
                    </td>
                    <td className="p-3 text-on-surface-variant">{user.lastActiveAt ? fmtRelative(user.lastActiveAt) : "-"}</td>
                    <td className="p-3">
                      {user.id === currentUser.id || user.role === "owner" ? (
                        <span className="meta">-</span>
                      ) : user.accountStatus === "invited" ? (
                        <div className="flex items-center gap-1">
                          {invitation && !["accepted", "cancelled"].includes(invitation.status) && (
                            <button onClick={() => resendInvitation(invitation.id)} className="btn-ghost gap-1 px-2 py-1 text-secondary hover:bg-secondary/10">
                              <Mail className="h-3.5 w-3.5" /> إعادة الإرسال
                            </button>
                          )}
                          {invitation && !["accepted", "cancelled"].includes(invitation.status) && (
                            <button onClick={() => void copyInviteLink(invitation.token)} className="btn-ghost gap-1 px-2 py-1 text-on-surface-variant hover:bg-surface-container">
                              <Copy className="h-3.5 w-3.5" /> نسخ الرابط
                            </button>
                          )}
                          <button onClick={() => cancelInvitation(invitation?.id ?? "")} className="btn-ghost gap-1 px-2 py-1 text-error hover:bg-error/10">
                            <Ban className="h-3.5 w-3.5" /> إلغاء الدعوة
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {user.accountStatus === "active" ? (
                            <button onClick={() => setMemberStatus(user.id, "suspended")} className="btn-ghost gap-1 px-2 py-1 text-amber hover:bg-amber/10" title="تعليق الحساب">
                              <UserMinus className="h-3.5 w-3.5" /> تعليق
                            </button>
                          ) : (
                            <button onClick={() => setMemberStatus(user.id, "active")} className="btn-ghost gap-1 px-2 py-1 text-secondary hover:bg-secondary/10" title="إعادة تفعيل">
                              <UserCheck className="h-3.5 w-3.5" /> تفعيل
                            </button>
                          )}
                          {can(currentUser, "manage_members") && (
                            <button onClick={() => setResetUser(user)} className="btn-ghost gap-1 px-2 py-1 text-on-surface-variant hover:bg-surface-container" title="إعادة تعيين كلمة المرور">
                              <KeyRound className="h-3.5 w-3.5" /> كلمة المرور
                            </button>
                          )}
                          <button onClick={() => setConfirmRemove(user.id)} className="btn-ghost px-2 py-1 text-error hover:bg-error/10" aria-label="إزالة العضو">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(() => {
        const user = confirmRemove ? data.users.find((candidate) => candidate.id === confirmRemove) : null;
        return (
          <ConfirmDialog
            open={!!confirmRemove}
            title="إزالة العضو"
            message={user ? `سيتم إزالة "${user.name}" من المساحة وإلغاء إسناده من الفرق والمهام الفردية. لا يمكن التراجع.` : ""}
            confirmLabel="نعم، أزل"
            onConfirm={() => {
              if (confirmRemove) removeMember(confirmRemove);
              setConfirmRemove(null);
            }}
            onCancel={() => setConfirmRemove(null)}
          />
        );
      })()}

      {profileUser && (
        <MemberProfileDialog
          user={profileUser}
          teamNames={profileUser.teamIds.map(teamName)}
          onClose={() => setProfileUser(null)}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          actorId={currentUser.id}
          onClose={() => setResetUser(null)}
        />
      )}

      {showInvite && (
        <InviteDialog
          teams={data.teams}
          onClose={() => setShowInvite(false)}
          onInvite={(input) => {
            const invitation = inviteMember(input);
            if (!invitation) return false;
            setSent(input.email);
            setCopied(false);
            setShowInvite(false);
            return true;
          }}
        />
      )}
    </div>
  );
}

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function ResetPasswordDialog({
  user,
  actorId,
  onClose,
}: {
  user: User;
  actorId: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState(() => generatePassword());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (password.trim().length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiResetMemberPassword(user.id, password.trim(), actorId);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إعادة تعيين كلمة المرور.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(password.trim());
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <KeyRound className="h-5 w-5 text-primary" /> إعادة تعيين كلمة المرور
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-on-surface-variant">
          سيتم تعيين كلمة مرور جديدة لـ <strong className="text-on-surface">{user.name}</strong> <span dir="ltr">({user.email})</span>. كلمة المرور القديمة لا يمكن استرجاعها.
        </p>

        {done ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-card border border-secondary/40 bg-secondary/5 px-3 py-2 text-sm text-on-surface">
              <CheckCircle2 className="h-4 w-4 text-secondary" /> تم تعيين كلمة المرور الجديدة.
            </div>
            <div>
              <label className="label">كلمة المرور الجديدة</label>
              <div className="flex items-center gap-2">
                <input dir="ltr" readOnly value={password} className="input font-mono" />
                <button onClick={copy} className="btn-outline gap-1 whitespace-nowrap" title="نسخ">
                  <Copy className="h-4 w-4" /> {copied ? "تم النسخ" : "نسخ"}
                </button>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant">شاركها مع العضو عبر قناة آمنة واطلب منه تغييرها بعد تسجيل الدخول.</p>
            <div className="flex justify-end pt-1">
              <button onClick={onClose} className="btn-primary">تم</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">كلمة المرور الجديدة</label>
              <div className="flex items-center gap-2">
                <input
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input font-mono"
                />
                <button onClick={() => setPassword(generatePassword())} className="btn-outline gap-1 whitespace-nowrap" title="توليد كلمة مرور">
                  <RefreshCw className="h-4 w-4" /> توليد
                </button>
              </div>
            </div>
            {error && <p className="rounded-card bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button disabled={busy || password.trim().length < 8} onClick={submit} className="btn-primary disabled:opacity-50">
                {busy ? "جارٍ الحفظ..." : "تعيين كلمة المرور"}
              </button>
              <button onClick={onClose} className="btn-ghost">إلغاء</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberProfileDialog({
  user,
  teamNames,
  onClose,
}: {
  user: User;
  teamNames: string[];
  onClose: () => void;
}) {
  const profile = user.profile;
  const isLeader = user.leaderOfTeamIds.length > 0;
  const hasProfileDetails = !!(
    profile?.jobTitle || profile?.location || profile?.phone || profile?.bio ||
    (profile?.skills && profile.skills.length) || profile?.cvUrl || profile?.portfolioUrl
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={56} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-on-surface">{user.name}</h3>
                {isLeader && <LeaderBadge />}
              </div>
              {profile?.jobTitle && (
                <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                  <Briefcase className="h-3.5 w-3.5" /> {profile.jobTitle}
                </p>
              )}
              <p className="meta" dir="ltr">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
            <dt className="text-on-surface-variant">الدور</dt>
            <dd className="font-medium text-on-surface">{roleAr[user.role]}</dd>
          </div>
          <div className="flex justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
            <dt className="text-on-surface-variant">الحالة</dt>
            <dd className="font-medium text-on-surface">{accountStatusAr[user.accountStatus]}</dd>
          </div>
          <div className="flex justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 sm:col-span-2">
            <dt className="text-on-surface-variant">الفرق</dt>
            <dd className="font-medium text-on-surface">{teamNames.join("، ") || "-"}</dd>
          </div>
        </dl>

        {(profile?.location || profile?.phone) && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            {profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>}
            {profile?.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3.5 w-3.5" /> {profile.phone}</span>}
          </div>
        )}

        {profile?.bio && (
          <div className="mt-4">
            <h4 className="mb-1 text-sm font-semibold text-on-surface">نبذة</h4>
            <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">{profile.bio}</p>
          </div>
        )}

        {profile?.skills && profile.skills.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-on-surface">المهارات</h4>
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

        {!hasProfileDetails && (
          <p className="mt-4 rounded-card border border-dashed border-outline-variant bg-surface-lowest px-3 py-4 text-center text-sm text-on-surface-variant">
            لم يكمل هذا العضو ملفه الشخصي بعد.
          </p>
        )}
      </div>
    </div>
  );
}

function InviteDialog({
  teams,
  onClose,
  onInvite,
}: {
  teams: { id: string; name: string }[];
  onClose: () => void;
  onInvite: (input: InviteInput) => boolean;
}) {
  const [inviteError, setInviteError] = useState("");
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: "", email: "", role: "member", teamIds: [], asLeader: false },
  });
  const role = watch("role");
  const selectedTeams = watch("teamIds");

  const toggleTeam = (id: string) => {
    setValue("teamIds", selectedTeams.includes(id) ? selectedTeams.filter((teamId) => teamId !== id) : [...selectedTeams, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <Mail className="h-5 w-5 text-secondary" /> دعوة عضو جديد
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit((input) => {
            setInviteError("");
            const sent = onInvite(input);
            if (!sent) setInviteError("هذا البريد موجود بالفعل. لا يمكن إرسال دعوة أخرى لنفس البريد.");
          })}
          className="mt-3 space-y-3"
        >
          <div>
            <label className="label">الاسم</label>
            <input className="input" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input dir="ltr" className="input" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">الدور</label>
            <select className="input" {...register("role")}>
              {(["admin", "team_leader", "member", "viewer"] as UserRole[]).map((item) => (
                <option key={item} value={item}>{roleAr[item]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الفرق</label>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => {
                const selected = selectedTeams.includes(team.id);
                return (
                  <button type="button" key={team.id} onClick={() => toggleTeam(team.id)} className={`badge cursor-pointer ${selected ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                    {team.name}
                  </button>
                );
              })}
            </div>
          </div>
          {role === "team_leader" && (
            <label className="flex items-center gap-2 rounded-lg bg-surface-container-low p-2 text-sm text-on-surface">
              <input type="checkbox" className="h-4 w-4 accent-primary" {...register("asLeader")} />
              <ShieldCheck className="h-4 w-4 text-primary" /> تعيينه قائدا للفرق المحددة
            </label>
          )}
          {inviteError && <p className="rounded-card bg-error/10 px-3 py-2 text-xs text-error">{inviteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="submit" className="btn-primary">إرسال الدعوة</button>
            <button type="button" onClick={onClose} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
