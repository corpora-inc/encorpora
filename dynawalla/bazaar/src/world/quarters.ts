/**
 * The quarters.
 *
 * Streets in the Grand Bazaar are named for the trade sold on them, and so are
 * ours. Each craft is a genuine embodiment of its mathematics, not a label
 * glued onto a topic: a gear ratio *is* a fraction, a rope laid in fathoms *is*
 * division into parts, a balance beam *is* equality.
 *
 * BZ-LAW-8 — identity is a product, not a colour:
 *   ward (5) × finial (5) × fold (5) × stripe (6) = 750 distinct quarters,
 *   of which exactly one axis is colour. BZ-17 asserts every quarter carries a
 *   distinct (ward, finial, fold) triple, and that the lapis and aubergine
 *   wards — 5.9 L* apart and both on the tritan axis — are never adjacent.
 */

import type { Quarter } from "../types.ts";

export const QUARTERS: readonly Quarter[] = [
  {
    id: "weighers",
    ward: "lapis",
    finial: "meridian",
    fold: "girih5",
    stripe: 0,
    craft: "balance",
    name: {
      en: "Weighers’ Row",
      es: "Calle de los Pesadores",
      "pt-BR": "Rua dos Pesadores",
      fr: "Rue des Peseurs",
      de: "Gasse der Wäger",
    },
    specimen: { display: "3 + 4 = 7", spoken: "three plus four equals seven" },
  },
  {
    id: "money-changers",
    ward: "lapis",
    finial: "vane",
    fold: "khatem8",
    stripe: 1,
    craft: "coin",
    name: {
      en: "Money-changers’ Arcade",
      es: "Galería de los Cambistas",
      "pt-BR": "Galeria dos Cambistas",
      fr: "Galerie des Changeurs",
      de: "Arkade der Geldwechsler",
    },
    specimen: { display: "0,25 × 4 = 1", spoken: "nought point two five, four times" },
  },
  {
    id: "tilers",
    ward: "turquoise",
    finial: "signal",
    fold: "hex6",
    stripe: 2,
    craft: "tessera",
    name: {
      en: "Tilers’ Court",
      es: "Patio de los Alicatadores",
      "pt-BR": "Pátio dos Ladrilheiros",
      fr: "Cour des Carreleurs",
      de: "Hof der Fliesenleger",
    },
    specimen: { display: "12 × 8 = 96", spoken: "twelve times eight" },
  },
  {
    id: "rope-walk",
    ward: "turquoise",
    finial: "gear",
    fold: "twelve12",
    stripe: 3,
    craft: "rope",
    name: {
      en: "The Rope-walk",
      es: "La Cordelería",
      "pt-BR": "A Cordoaria",
      fr: "La Corderie",
      de: "Die Seilerbahn",
    },
    specimen: { display: "⅗ of 40 = 24", spoken: "three fifths of forty" },
  },
  {
    id: "astrolabists",
    ward: "aubergine",
    finial: "armillary",
    fold: "lattice",
    stripe: 4,
    craft: "astrolabe",
    name: {
      en: "Astrolabists’ Gallery",
      es: "Galería de los Astrolabistas",
      "pt-BR": "Galeria dos Astrolabistas",
      fr: "Galerie des Astrolabistes",
      de: "Galerie der Astrolabienbauer",
    },
    specimen: { display: "360° ÷ 8 = 45°", spoken: "three hundred and sixty degrees, into eight" },
  },
  {
    id: "waterworks",
    ward: "aubergine",
    finial: "meridian",
    fold: "twelve12",
    stripe: 5,
    craft: "water",
    name: {
      en: "The Waterworks",
      es: "La Casa del Agua",
      "pt-BR": "A Casa das Águas",
      fr: "Les Eaux",
      de: "Das Wasserwerk",
    },
    specimen: { display: "3 : 2 = 9 : 6", spoken: "three to two, as nine to six" },
  },
  {
    id: "dyers",
    ward: "madder",
    finial: "armillary",
    fold: "khatem8",
    stripe: 0,
    craft: "vat",
    name: {
      en: "Dyers’ Lane",
      es: "Callejón de los Tintoreros",
      "pt-BR": "Beco dos Tintureiros",
      fr: "Ruelle des Teinturiers",
      de: "Färbergasse",
    },
    specimen: { display: "⅖ + ⅕ = ⅗", spoken: "two fifths and one fifth" },
  },
  {
    id: "kite-makers",
    ward: "madder",
    finial: "vane",
    fold: "hex6",
    stripe: 1,
    craft: "kite",
    name: {
      en: "Kite-makers’ Yard",
      es: "Corral de los Cometeros",
      "pt-BR": "Pátio dos Pipeiros",
      fr: "Cour des Cerfs-Volants",
      de: "Hof der Drachenbauer",
    },
    specimen: { display: "180° − 55° = 125°", spoken: "a straight angle, less fifty-five degrees" },
  },
  {
    id: "clockmakers",
    ward: "hemp",
    finial: "gear",
    fold: "lattice",
    stripe: 2,
    craft: "gears",
    name: {
      en: "Clockmakers’ Terrace",
      es: "Terraza de los Relojeros",
      "pt-BR": "Terraço dos Relojoeiros",
      fr: "Terrasse des Horlogers",
      de: "Terrasse der Uhrmacher",
    },
    specimen: { display: "24 : 18 = 4 : 3", spoken: "twenty-four to eighteen, as four to three" },
  },
  {
    id: "millers",
    ward: "hemp",
    finial: "signal",
    fold: "girih5",
    stripe: 3,
    craft: "mill",
    name: {
      en: "Millers’ Yard",
      es: "Corral de los Molineros",
      "pt-BR": "Pátio dos Moleiros",
      fr: "Cour des Meuniers",
      de: "Hof der Müller",
    },
    specimen: { display: "47 ÷ 5 = 9 r 2", spoken: "forty-seven into fives, two over" },
  },
];

export const quarterById = (id: string): Quarter | undefined =>
  QUARTERS.find((q) => q.id === id);
