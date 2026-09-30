"use client";

import { useEffect, useState } from "react";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionNumerikUpResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId="numerik-up"
      basePath="/mediation/actions-collectives/reponses/numerik-up"
      lienPublic={`${origine}/inscription/numerik-up/satisfaction`}
    />
  );
}
