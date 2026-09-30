"use client";

import { useEffect, useState } from "react";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionDigitalUpProResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId="digital-up-pro"
      basePath="/mediation/actions-collectives/reponses/digital-up-pro"
      lienPublic={`${origine}/inscription/digital-up-pro/satisfaction`}
    />
  );
}
