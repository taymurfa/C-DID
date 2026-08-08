"use client";

import { ChevronDown, Map, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignalDesk, SIGNAL_PAGES, type SignalPage } from "@/components/SignalDesk";
import { SignalDataProvider } from "@/lib/signal-data-context";
import "../signal-desk.css";

type View = "map" | "signals";

export default function AppPage() {
  const [view, setView] = useState<View>("map");
  const [signalPage, setSignalPage] = useState<SignalPage>("calendar");
  const [signalMenuOpen, setSignalMenuOpen] = useState(false);
  const signalMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!signalMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!signalMenuRef.current?.contains(event.target as Node)) setSignalMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSignalMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [signalMenuOpen]);

  function selectSignalPage(page: SignalPage) {
    setSignalPage(page);
    setView("signals");
    setSignalMenuOpen(false);
  }

  return (
    <div className="atlas-product-shell">
      <div className="atlas-view-toggle" role="tablist" aria-label="Product view">
        <div className="atlas-signal-control" ref={signalMenuRef}>
          <button
            type="button"
            role="tab"
            aria-selected={view === "signals"}
            aria-haspopup="menu"
            aria-expanded={signalMenuOpen}
            aria-controls="signal-page-menu"
            className={view === "signals" ? "atlas-toggle-active" : ""}
            onClick={() => {
              setView("signals");
              setSignalMenuOpen((open) => !open);
            }}
          >
            <Radio size={15} aria-hidden="true" />
            Signal
            <ChevronDown className={signalMenuOpen ? "atlas-chevron-open" : ""} size={14} aria-hidden="true" />
          </button>
          {signalMenuOpen ? (
            <div className="atlas-signal-menu" id="signal-page-menu" role="menu" aria-label="Signal pages">
              {SIGNAL_PAGES.map(({ page, label }) => (
                <button
                  key={page}
                  type="button"
                  role="menuitem"
                  className={signalPage === page ? "atlas-menu-active" : ""}
                  onClick={() => selectSignalPage(page)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={view === "map"}
          className={view === "map" ? "atlas-toggle-active" : ""}
          onClick={() => {
            setView("map");
            setSignalMenuOpen(false);
          }}
        >
          <Map size={15} aria-hidden="true" />
          Map
        </button>
      </div>

      {view === "map" ? (
        <iframe className="atlas-frame" src="/ercot-atlas.html" title="ERCOT Power Project Atlas" />
      ) : (
        <SignalDataProvider>
          <SignalDesk activePage={signalPage} onPageChange={setSignalPage} />
        </SignalDataProvider>
      )}
    </div>
  );
}
