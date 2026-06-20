"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Flame, Lock, Mail, XCircle } from "lucide-react";

interface InvitePreview {
  email: string;
  name: string;
  role: string;
  expiresAt: string;
}

const roleLabels: Record<string, string> = {
  owner: "مالك المساحة",
  admin: "مدير النظام",
  team_leader: "قائد الفريق",
  member: "عضو الفريق",
  viewer: "مشاهد",
};

export function AcceptInviteClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [invitation, setInvitation] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [acceptedEmail, setAcceptedEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadInvitation() {
      if (!token) {
        setError("رابط الدعوة غير صالح.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok || !body.ok) {
          const status = body.status === "expired" ? "انتهت صلاحية الدعوة." : "تعذر العثور على دعوة صالحة.";
          throw new Error(status);
        }
        if (!cancelled) setInvitation(body.invitation);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل الدعوة.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "تعذر قبول الدعوة.");

      setAcceptedEmail(body.user.email);
      window.setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(body.user.email)}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر قبول الدعوة.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="card w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-card bg-primary text-on-primary">
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-on-surface">قبول دعوة Phoenix Hub</h1>
            <p className="text-xs text-on-surface-variant">أنشئ كلمة المرور الخاصة بك للمتابعة.</p>
          </div>
        </div>

        {loading && <p className="rounded-card bg-surface-container px-3 py-2 text-sm text-on-surface-variant">جاري تحميل الدعوة...</p>}

        {!loading && error && !invitation && (
          <div className="rounded-card bg-error/10 p-4 text-sm text-error">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" />
              الدعوة غير متاحة
            </div>
            <p>{error}</p>
            <Link href="/login" className="btn-outline mt-4 w-full">العودة لتسجيل الدخول</Link>
          </div>
        )}

        {acceptedEmail && (
          <div className="rounded-card bg-secondary/10 p-4 text-sm text-secondary">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              تم قبول الدعوة
            </div>
            <p>يمكنك الآن تسجيل الدخول باستخدام {acceptedEmail}.</p>
          </div>
        )}

        {invitation && !acceptedEmail && (
          <form onSubmit={acceptInvite} className="space-y-4">
            <div className="rounded-card bg-surface-container px-3 py-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-on-surface">
                <Mail className="h-4 w-4" />
                {invitation.name}
              </p>
              <p className="mt-1 font-mono text-xs text-on-surface-variant" dir="ltr">{invitation.email}</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                الدور: {roleLabels[invitation.role] ?? invitation.role}
              </p>
            </div>

            <div>
              <label className="label" htmlFor="password">كلمة المرور</label>
              <input
                id="password"
                type="password"
                className="input"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label" htmlFor="confirmPassword">تأكيد كلمة المرور</label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="rounded-card bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Lock className="h-4 w-4" />
              {submitting ? "جاري التفعيل..." : "قبول الدعوة وتفعيل الحساب"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
