"use client";
import { WorkspaceProvider } from "@/lib/workspace-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
