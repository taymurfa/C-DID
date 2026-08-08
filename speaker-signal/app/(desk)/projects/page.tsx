"use client";

import { ProjectRadar } from "@/components/ProjectRadar";
import { useDeskUi } from "@/components/desk/DeskShell";

export default function ProjectRadarPage() {
  const { openSpeaker, openNavigation } = useDeskUi();

  return (
    <ProjectRadar
      onOpenSpeaker={openSpeaker}
      onOpenNavigation={openNavigation}
    />
  );
}
