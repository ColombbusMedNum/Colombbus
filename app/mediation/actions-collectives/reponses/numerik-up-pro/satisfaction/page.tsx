"use client";

import { useEffect, useState } from "react";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionNumerikUpProResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId="numerik-up-pro"
      basePath="/mediation/actions-collectives/reponses/numerik-up-pro"
      lienPublic={`${origine}/inscription/numerik-up-pro/satisfaction`}
    />
  );
}
