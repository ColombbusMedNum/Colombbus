"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PositionnementResultats from "@/components/PositionnementResultats";

export default function PositionnementActionDynamiqueResultatsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <PositionnementResultats
      programmeId={slug}
      basePath={`/mediation/actions-collectives/reponses/${slug}`}
      lienPublic={`${origine}/inscription/${slug}/positionnement`}
    />
  );
}
