"use client";

import { useEffect, useState } from "react";
import PositionnementResultats from "@/components/PositionnementResultats";

export default function PositionnementPrfeResultatsPage() {
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <PositionnementResultats
      programmeId="prfe"
      basePath="/mediation/actions-collectives/reponses/prfe"
      lienPublic={`${origine}/inscription/prfe-positionnement`}
    />
  );
}
