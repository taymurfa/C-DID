"use client";

import Link from "next/link";
import { ArrowRight, Menu, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NetworkGraph, NetworkGraphMobile } from "./NetworkGraph";

const NAV = [
  { href: "#network", label: "Network" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#signals", label: "Signals" },
  { href: "#about", label: "About" },
];

const STEPS = [
  {
    title: "SOURCE",
    body: "Public filings, notices, permits, market data, and more.",
  },
  {
    title: "PROJECT",
    body: "The project takes shape with location, scope, and timeline.",
  },
  {
    title: "COMPANY",
    body: "Organizations align with roles, ownership, and relationships.",
  },
  {
    title: "PERSON",
    body: "Decision-makers identified with contact context.",
  },
  {
    title: "MOMENT",
    body: "The right outreach moment based on live signals.",
    highlight: true,
  },
];

const ACTIVITY = [
  {
    title: "PUCT docket received new filing",
    project: "Lone Star Data Center",
  },
  {
    title: "TCEQ air permit application submitted",
    project: "Lone Star Data Center",
  },
  {
    title: "Maya Chen added to HelioCare Energy",
    project: "People · Company update",
  },
  {
    title: "GridForward Summit agenda published",
    project: "Moment · Dallas, TX",
  },
];

const SIGNALS = [
  {
    id: "01",
    title: "PUCT Docket Update",
    tag: "Regulatory",
    detail: null,
  },
  {
    id: "02",
    title: "TCEQ Air Permit Application",
    tag: "Permitting",
    detail: null,
  },
  {
    id: "03",
    title: "Executive Added to Company",
    tag: "People",
    detail: {
      signal: "New executive listed on company leadership page",
      company: "HelioCare Energy",
      person: "Maya Chen",
      source: "Company Website",
      detected: "May 10, 2023",
      relevance: "High",
      why: "A newly visible development lead often precedes vendor outreach and land / interconnection work. Catching this early surfaces the right person before the project is crowded.",
    },
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSignal, setOpenSignal] = useState("03");
  const [openMobile, setOpenMobile] = useState<string | null>("messy");

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function toggleMobile(id: string) {
    setOpenMobile((prev) => (prev === id ? null : id));
  }

  return (
    <div className="gc-page">
      <header className="gc-header">
        <Link href="/" className="gc-logo" aria-label="GridConnects home">
          GridConnects
        </Link>

        <nav className="gc-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <Link href="/app" className="gc-btn gc-btn--header">
          Explore the network
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        <button
          type="button"
          className="gc-menu-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {menuOpen ? (
        <div className="gc-mobile-nav" role="dialog" aria-label="Navigation">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <Link href="/app" className="gc-btn" onClick={() => setMenuOpen(false)}>
            Explore the network
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <main>
        <section className="gc-hero" id="network">
          <div className="gc-hero-copy">
            <h1>
              Connect the project.
              <br />
              Find the person.
              <br />
              Move first.
            </h1>
            <p>
              GridConnects turns fragmented public signals into one live view of the projects taking
              shape, the people driving them, and the moment to reach out.
            </p>
            <div className="gc-hero-actions">
              <Link href="/app" className="gc-btn">
                Explore the network
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="gc-text-link">
                See how signals connect
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="gc-hero-visual">
            <div className="gc-hero-visual-desktop">
              <NetworkGraph />
            </div>
            <div className="gc-hero-visual-mobile">
              <NetworkGraphMobile />
            </div>
          </div>
        </section>

        <section className="gc-section gc-process" id="how-it-works">
          <h2>One signal becomes a connected story</h2>
          <ol className="gc-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className={step.highlight ? "gc-step gc-step--hot" : "gc-step"}>
                <div className="gc-step-icon" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="gc-section gc-messy" id="about">
          <div className="gc-messy-head">
            <h2>Built for the messy middle</h2>
            <p>
              Between a public notice and a finished project sits a tangle of filings, owners, and
              people. GridConnects resolves that tangle into a network you can act on.
            </p>
          </div>

          <button
            type="button"
            className="gc-accordion-trigger gc-only-mobile"
            aria-expanded={openMobile === "messy"}
            onClick={() => toggleMobile("messy")}
          >
            Capability metrics
            <Plus size={18} className={openMobile === "messy" ? "gc-plus-open" : ""} />
          </button>

          <div className={`gc-metrics ${openMobile === "messy" ? "is-open" : ""}`}>
            <article className="gc-metric">
              <h3>Source coverage</h3>
              <p className="gc-metric-stat">
                25,000+ <span>Sources monitored</span>
              </p>
              <div className="gc-metric-viz gc-metric-viz--dots" aria-hidden="true" />
            </article>
            <article className="gc-metric">
              <h3>Entity resolution</h3>
              <p className="gc-metric-stat">
                89% <span>Resolution confidence</span>
              </p>
              <div className="gc-metric-viz gc-metric-viz--wave" aria-hidden="true" />
            </article>
            <article className="gc-metric">
              <h3>Stage inference</h3>
              <p className="gc-metric-stat">
                72% <span>Stage accuracy</span>
              </p>
              <div className="gc-metric-viz gc-metric-viz--steps" aria-hidden="true" />
            </article>
          </div>
        </section>

        <section className="gc-section gc-activity">
          <div className="gc-activity-head">
            <h2>Live network activity</h2>
            <a href="#signals" className="gc-text-link">
              View all activity
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>

          <button
            type="button"
            className="gc-accordion-trigger gc-only-mobile"
            aria-expanded={openMobile === "activity"}
            onClick={() => toggleMobile("activity")}
          >
            Recent updates
            <Plus size={18} className={openMobile === "activity" ? "gc-plus-open" : ""} />
          </button>

          <div className={`gc-activity-row ${openMobile === "activity" ? "is-open" : ""}`}>
            {ACTIVITY.map((item) => (
              <article key={item.title} className="gc-activity-card">
                <span className="gc-pulse" aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.project}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="gc-section gc-signals" id="signals">
          <h2>See what moves first</h2>

          <button
            type="button"
            className="gc-accordion-trigger gc-only-mobile"
            aria-expanded={openMobile === "signals"}
            onClick={() => toggleMobile("signals")}
          >
            Signal feed
            <Plus size={18} className={openMobile === "signals" ? "gc-plus-open" : ""} />
          </button>

          <div className={`gc-signal-list ${openMobile === "signals" ? "is-open" : ""}`}>
            {SIGNALS.map((signal) => {
              const open = openSignal === signal.id;
              return (
                <article key={signal.id} className={open ? "gc-signal is-open" : "gc-signal"}>
                  <button
                    type="button"
                    className="gc-signal-head"
                    aria-expanded={open}
                    onClick={() => setOpenSignal(open ? "" : signal.id)}
                  >
                    <span className="gc-signal-index">{signal.id}</span>
                    <span className="gc-signal-title">{signal.title}</span>
                    <span className="gc-signal-tag">{signal.tag}</span>
                  </button>

                  {open && signal.detail ? (
                    <div className="gc-signal-body">
                      <dl className="gc-signal-meta">
                        <div>
                          <dt>Signal</dt>
                          <dd>{signal.detail.signal}</dd>
                        </div>
                        <div>
                          <dt>Company</dt>
                          <dd>{signal.detail.company}</dd>
                        </div>
                        <div>
                          <dt>Person</dt>
                          <dd>{signal.detail.person}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{signal.detail.source}</dd>
                        </div>
                        <div>
                          <dt>Detected</dt>
                          <dd>{signal.detail.detected}</dd>
                        </div>
                        <div>
                          <dt>Relevance</dt>
                          <dd>
                            <span className="gc-badge">{signal.detail.relevance}</span>
                          </dd>
                        </div>
                      </dl>
                      <div className="gc-why">
                        <h4>Why it matters</h4>
                        <p>{signal.detail.why}</p>
                        <Link href="/app" className="gc-btn gc-btn--small">
                          View in network
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="gc-cta">
          <h2>The right project is already leaving clues.</h2>
          <p>GridConnects helps you see the full picture, so you can move first.</p>
          <Link href="/app" className="gc-btn gc-btn--large">
            Open GridConnects
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="gc-footer">
        <span>© {new Date().getFullYear()} GridConnects</span>
        <span>Public signals · Connected projects · Earlier outreach</span>
      </footer>
    </div>
  );
}
