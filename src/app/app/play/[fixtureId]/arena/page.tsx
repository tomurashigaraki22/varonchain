"use client";

import { PredictionGame } from "@/components/app/PredictionGame";
import { CrowdPulseTrader } from "@/components/app/CrowdPulseTrader";
import { usePlayContext } from "@/lib/playContext";

export default function ArenaPage() {
  const { fixtureId } = usePlayContext();

  return (
    <div className="divide-y divide-border">
      <PredictionGame view="arena" />
      <CrowdPulseTrader fixtureId={fixtureId} />
    </div>
  );
}
