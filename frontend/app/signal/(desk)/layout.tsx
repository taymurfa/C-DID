"use client";

import Link from "next/link";
import { Map, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk/DeskShell";
import { SignalDataProvider } from "@/lib/signal-data-context";
import "../../signal-desk.css";

export default function SignalDeskLayout({ children }: { children: ReactNode }) {
  return (
    <SignalDataProvider>
      <DeskShell basePath="/signal">{children}</DeskShell>
      <div className="atlas-view-toggle" role="tablist" aria-label="Product view">
        <Link href="/app" role="tab" aria-selected={false}>
          <Map size={15} aria-hidden="true" />
          Map
        </Link>
        <Link
          href="/signal"
          role="tab"
          aria-selected={true}
          className="atlas-toggle-active"
        >
          <Radio size={15} aria-hidden="true" />
          Signal
        </Link>
      </div>
    </SignalDataProvider>
  );
}
