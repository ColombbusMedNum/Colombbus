import FormulaireActionDynamique from "@/components/actionDynamique/FormulaireActionDynamique";

export default async function InscriptionActionDynamiquePublique({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FormulaireActionDynamique slug={slug} variant="public" />;
}
