import { Suspense } from "react";
import { AcceptInviteClient } from "./AcceptInviteClient";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteShell message="جاري تحميل الدعوة..." />}>
      <AcceptInviteClient />
    </Suspense>
  );
}

function AcceptInviteShell({ message }: { message: string }) {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="card w-full max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold text-on-surface">Phoenix Hub</h1>
        <p className="mt-3 text-sm text-on-surface-variant">{message}</p>
      </section>
    </main>
  );
}
