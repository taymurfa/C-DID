"use client";

import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk/DeskShell";
import { SignalDataProvider } from "@/lib/signal-data-context";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <SignalDataProvider>
      <DeskShell>{children}</DeskShell>
    </SignalDataProvider>
  );
}
