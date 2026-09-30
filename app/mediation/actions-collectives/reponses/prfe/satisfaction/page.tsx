"use client";

import { useEffect, useState } from "react";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionPrfeResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId="prfe"
      basePath="/mediation/actions-collectives/reponses/prfe"
      lienPublic={`${origine}/inscription/prfe/satisfaction`}
    />
  );
}
