"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SatisfactionResultats from "@/components/SatisfactionResultats";

export default function SatisfactionActionDynamiqueResultatsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [origine, setOrigine] = useState("");
  useEffect(() => { setOrigine(window.location.origin); }, []);
  return (
    <SatisfactionResultats
      programmeId={slug}
      basePath={`/mediation/actions-collectives/reponses/${slug}`}
      lienPublic={`${origine}/inscription/${slug}/satisfaction`}
    />
  );
}
