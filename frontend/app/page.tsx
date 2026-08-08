"use client";

import { Map, Radio } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="atlas-product-shell">
      <div className="atlas-view-toggle" role="tablist" aria-label="Product view">
        <button
          type="button"
          role="tab"
          aria-selected={true}
          className="atlas-toggle-active"
        >
          <Map size={15} aria-hidden="true" />
          Project Atlas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={() => router.push("/signal")}
        >
          <Radio size={15} aria-hidden="true" />
          Speaker Signal
        </button>
      </div>

      <iframe
        className="atlas-frame"
        src="/ercot-atlas.html"
        title="ERCOT Power Project Atlas"
      />
    </div>
  );
}
