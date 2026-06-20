import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card card-pad max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-card bg-error/10 text-error"><ShieldAlert className="h-7 w-7" /></div>
        <h1 className="mt-4 text-xl font-bold text-on-surface">غير مصرح بالوصول</h1>
        <p className="meta mt-2">لا تملك الصلاحيات اللازمة لعرض هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، تواصل مع مدير المساحة.</p>
        <Link href="/overview" className="btn-primary mx-auto mt-5">العودة للرئيسية</Link>
      </div>
    </main>
  );
}
