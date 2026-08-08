"use client";

import { ChevronDown, Map, Moon, Radio, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignalDesk, SIGNAL_PAGES, type SignalPage } from "@/components/SignalDesk";
import { SignalDataProvider } from "@/lib/signal-data-context";
import "../signal-desk.css";

type View = "map" | "signals";
type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export default function AppPage() {
  const [view, setView] = useState<View>("map");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [signalPage, setSignalPage] = useState<SignalPage>("calendar");
  const [signalMenuOpen, setSignalMenuOpen] = useState(false);
  const signalMenuRef = useRef<HTMLDivElement>(null);
  const mapFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("atlas-theme", theme);
    mapFrameRef.current?.contentWindow?.postMessage({ type: "atlas-theme", theme }, window.location.origin);
  }, [theme]);

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

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
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

      <button
        type="button"
        className="atlas-theme-toggle"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        aria-pressed={theme === "dark"}
        onClick={toggleTheme}
      >
        {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>

      {view === "map" ? (
        <div className="radar-map-layout">
          <iframe
            ref={mapFrameRef}
            className="atlas-frame"
            src={`/ercot-atlas.html?theme=${theme}`}
            title="ERCOT Power Project Atlas"
            onLoad={() => mapFrameRef.current?.contentWindow?.postMessage({ type: "atlas-theme", theme }, window.location.origin)}
          />
        </div>
      ) : (
        <SignalDataProvider>
          <SignalDesk activePage={signalPage} onPageChange={setSignalPage} />
        </SignalDataProvider>
      )}
    </div>
  );
}
