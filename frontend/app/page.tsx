"use client";

import { Map, Radio } from "lucide-react";
import { useState } from "react";
import { SignalDesk } from "@/components/SignalDesk";
import "./signal-desk.css";

type View = "map" | "signals";

export default function Home() {
  const [view, setView] = useState<View>("map");

  return (
    <div className="atlas-product-shell">
      <div className="atlas-view-toggle" role="tablist" aria-label="Product view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "map"}
          className={view === "map" ? "atlas-toggle-active" : ""}
          onClick={() => setView("map")}
        >
          <Map size={15} aria-hidden="true" />
          Project Atlas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "signals"}
          className={view === "signals" ? "atlas-toggle-active" : ""}
          onClick={() => setView("signals")}
        >
          <Radio size={15} aria-hidden="true" />
          Speaker Signal
        </button>
      </div>

      {view === "map" ? (
        <iframe
          className="atlas-frame"
          src="/ercot-atlas.html"
          title="ERCOT Power Project Atlas"
        />
      ) : (
        <SignalDesk />
      )}
    </div>
  );
}
