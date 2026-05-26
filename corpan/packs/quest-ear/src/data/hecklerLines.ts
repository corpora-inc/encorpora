/**
 * Roving "heckler" cameos that throw projectiles at the giant player.
 * They yell absurd one-liners in their own language (a fixed fr/de gag,
 * independent of the learner's stack) — spoken via host TTS.
 */
export interface Heckler {
  type: "french" | "german"
  lang: string
  hatColor: number
  coatColor: number
  projectiles: string[]
  lines: string[]
}

export const HECKLERS: Heckler[] = [
  {
    type: "french",
    lang: "fr",
    hatColor: 0x1a1a1a,
    coatColor: 0x2244aa,
    projectiles: ["🥖", "🍷"],
    lines: [
      "Tu as écrasé mon croissant, espèce de monstre !",
      "Sacrebleu ! Quelle horreur !",
      "Va-t'en, vilain mastodonte !",
      "Mon béret ! Tu as aplati mon béret !",
      "Tu pues plus que mon vieux fromage !",
      "Non, non, non ! Pas devant mon café !",
      "Espèce de goujat ! Et mes escargots ?!",
      "C'est une catastrophe pour la baguette !",
    ],
  },
  {
    type: "german",
    lang: "de",
    hatColor: 0x115522,
    coatColor: 0x8a6a2a,
    projectiles: ["🍖", "🍺"],
    lines: [
      "Du zertrampelst meine Bratwurst!",
      "Verschwinde, du Riesentrampel!",
      "Hände weg von meinem Bier!",
      "Ordnung muss sein, du Ungeheuer!",
      "Das ist verboten! Ganz und gar verboten!",
      "Mein Schnitzel! Finger weg!",
      "Du bist größer als der Kirchturm, unverschämt!",
      "Ruhe! Ich esse mein Sauerkraut!",
    ],
  },
]
