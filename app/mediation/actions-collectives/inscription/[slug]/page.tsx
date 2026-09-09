import FormulaireActionDynamique from "@/components/actionDynamique/FormulaireActionDynamique";

export default async function InscriptionActionDynamiqueInterne({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FormulaireActionDynamique slug={slug} variant="interne" />;
}
