import { Quicksand } from "next/font/google";

// Police unique partagée par toute l'app — avant cette centralisation,
// chaque page redéclarait indépendamment le même appel Quicksand({...}),
// dupliqué à l'identique dans 70+ fichiers.
export const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
