"use client";

import { useParams } from "next/navigation";
import FormulaireSatisfaction from "@/components/FormulaireSatisfaction";

export default function SatisfactionActionDynamiquePage() {
  const { slug } = useParams<{ slug: string }>();
  return <FormulaireSatisfaction programmeId={slug} />;
}
