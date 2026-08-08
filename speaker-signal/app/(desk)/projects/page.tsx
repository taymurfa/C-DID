"use client";

import { ProjectRadar } from "@/components/ProjectRadar";
import { useDeskUi } from "@/components/desk/DeskShell";
import { useSignalData } from "@/lib/useSignalData";

export default function ProjectRadarPage() {
  const { openSpeaker, openNavigation } = useDeskUi();
  const { leads } = useSignalData();

  return (
    <ProjectRadar
      onOpenSpeaker={openSpeaker}
      onOpenNavigation={openNavigation}
      speakerCandidates={leads}
    />
  );
}
