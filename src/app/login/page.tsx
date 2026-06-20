"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { useWorkspace } from "@/lib/workspace-context";
import { Eye, EyeOff, Flame, Lock, ShieldCheck } from "lucide-react";

const DEMO = [
  { email: "admin@phoenixhub.org", label: "مدير النظام" },
  { email: "leader@phoenixhub.org", label: "قائد الفريق — فريق الإعلام" },
  { email: "member@phoenixhub.org", label: "عضو الفريق — فريق الإعلام" },
  { email: "owner@phoenixhub.org", label: "مالك المساحة" },
  { email: "viewer@phoenixhub.org", label: "مشاهد / مدقق" },
];

export default function LoginPage() {
  const { login } = useWorkspace();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) setValue("email", email);
  }, [setValue]);

  const onSubmit = async (values: LoginInput) => {
    try {
      const user = await login(values.email, values.password);
      if (user) router.push("/overview");
      else setError("تعذّر تسجيل الدخول. تأكد من البريد الإلكتروني أو أن الحساب غير معلّق.");
    } catch {
      setError("تعذّر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.");
    }
  };

  const quick = async (mail: string) => {
    setValue("email", mail);
    setValue("password", "demo1234");
    try {
      const user = await login(mail, "demo1234");
      if (user) router.push("/overview");
    } catch {
      setError("هذه الحسابات التجريبية متاحة في الوضع التجريبي فقط.");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="phoenix-motif relative hidden flex-col justify-between bg-primary p-12 text-on-primary lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-card bg-white/10"><Flame className="h-6 w-6" /></span>
          <div>
            <p className="text-lg font-semibold">Phoenix Hub</p>
            <p className="font-mono text-xs text-white/60">WORKSPACE</p>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-snug">مساحة العمل الداخلية لإدارة الفرق والمهام</h1>
          <p className="mt-4 text-white/70">منصة آمنة ومنظمة لتنسيق العمل بين فرق Phoenix Hub، وإسناد المهام، ومتابعة الإنجاز.</p>
        </div>
        <p className="flex items-center gap-2 text-sm text-white/60">
          <ShieldCheck className="h-4 w-4" /> وصول مقيّد للأعضاء المصرح لهم فقط
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-card bg-primary text-on-primary"><Flame className="h-5 w-5" /></span>
            <p className="text-lg font-semibold">Phoenix Hub</p>
          </div>

          <h2 className="text-2xl font-bold text-on-surface">تسجيل الدخول</h2>
          <p className="mt-2 rounded-card bg-surface-container px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
            مساحة عمل Phoenix Hub منصة خاصة. يقتصر الوصول عليها على أعضاء Phoenix Hub المصرح لهم.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">البريد الإلكتروني</label>
              <input id="email" type="email" dir="ltr" className="input text-left" placeholder="name@phoenixhub.org" {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="password">كلمة المرور</label>
              <div className="relative">
                <input id="password" type={showPw ? "text" : "password"} className="input pl-10" placeholder="••••••••" {...register("password")} />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant" aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-error">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-on-surface-variant">
                <input type="checkbox" className="h-4 w-4 rounded accent-[var(--primary)]" {...register("remember")} /> تذكرني
              </label>
              <button type="button" className="text-secondary hover:underline">نسيت كلمة المرور؟</button>
            </div>

            {error && <p className="rounded-card bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              <Lock className="h-4 w-4" /> تسجيل الدخول
            </button>
          </form>

          <div className="mt-6">
            <p className="meta mb-2">دخول تجريبي سريع</p>
            <div className="space-y-1.5">
              {DEMO.map((d) => (
                <button key={d.email} onClick={() => quick(d.email)} className="flex w-full items-center justify-between rounded-card border border-outline-variant/60 px-3 py-2 text-right text-sm hover:bg-surface-container">
                  <span className="text-on-surface">{d.label}</span>
                  <span className="font-mono text-[11px] text-on-surface-variant" dir="ltr">{d.email}</span>
                </button>
              ))}
            </div>
            <p className="meta mt-2">الوضع التجريبي: أي كلمة مرور غير فارغة مقبولة.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
