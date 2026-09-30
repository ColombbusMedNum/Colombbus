"use client";

import { useEffect, useState } from "react";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionDigitalUpResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId="digital-up"
      basePath="/mediation/actions-collectives/reponses/digital-up"
      lienPublic={`${origine}/inscription/digital-up/satisfaction`}
    />
  );
}
