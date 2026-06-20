import Link from "next/link";
import { Clock } from "lucide-react";

export default function SessionExpiredPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card card-pad max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-card bg-amber/10 text-amber"><Clock className="h-7 w-7" /></div>
        <h1 className="mt-4 text-xl font-bold text-on-surface">انتهت الجلسة</h1>
        <p className="meta mt-2">انتهت صلاحية جلستك لأسباب أمنية. يُرجى تسجيل الدخول مرة أخرى للمتابعة.</p>
        <Link href="/login" className="btn-primary mx-auto mt-5">تسجيل الدخول</Link>
      </div>
    </main>
  );
}
