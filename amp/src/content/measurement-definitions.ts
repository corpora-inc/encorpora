/** Selected measurement decisions, with exact domains and teaching destinations. */
const rows = `
shifted-ruler-length|Measure from a shifted start|ruler-measurement|start-away-from-zero|numeric|K–2|Read a whole-unit interval from a nonzero ruler position.|Start 1…6 cm, end greater by 1…6 cm on a 0…12 cm scale.
fractional-ruler-length|Read the spaces between marks|ruler-measurement|fractional-lengths|numeric|3–5|Read an exact half- or quarter-unit distance.|Nonzero half/quarter tick positions on 0…3 cm; distance may be integral or fractional.
rectangle-border-length|Follow the whole border|perimeter|opposite-sides|numeric|3–5|Find the complete perimeter of a rectangle.|Positive integer width and height 2…12 cm, including squares.
rectangle-missing-border-side|Find a missing side from the border|perimeter|missing-side|numeric|3–5|Recover a rectangle side from perimeter and one perpendicular side.|Known and unknown sides 2…12 cm; only known side and perimeter are public givens.
rectangle-missing-area-side|Find the missing factor|area-perimeter-models|find-the-width|numeric|3–5|Recover a rectangle side from area and one perpendicular side.|Positive integer side lengths 2…12 cm; area 4…144 square cm.
border-or-cover-unit|Choose the right kind of unit|area-perimeter-models|entry-check|choice|3–5|Distinguish boundary length from surface coverage.|One explicit ribbon-border or paper-covering context; cm, square cm and cubic cm options.
same-area-border-choice|Same area, different border|area-perimeter-models|same-area-new-border|choice|3–5|Compare perimeters of two rectangles with equal area.|Two distinct unordered factor pairs of area 12, 18 or 24; sides 1…12 cm.
same-border-area-choice|Same border, different area|area-perimeter-models|same-border-new-area|choice|3–5|Compare areas of two rectangles with equal perimeter.|Half-perimeter 5…13 cm; distinct unordered integer side pairs 1…12 cm.
metric-length-rename|Rename with smaller units|unit-conversion|unit-relationships|numeric|3–5|Convert a whole count of a larger metric length unit to a smaller unit.|1…12 meters to centimeters or kilometers to meters; one relationship per instance.
metric-length-reverse|Rename with larger units|measurement-conversions|conversion-table|numeric|3–5|Convert a whole count of smaller metric units to an exact larger-unit value.|1…900 cm to meters or 25…3000 m to kilometers; exact rational result.
mixed-length-total|Bring lengths to one unit|measurement-conversions|one-unit-before-calculating|numeric|3–5|Add lengths expressed in meters and centimeters.|1…8 m plus 1…99 cm, result requested in centimeters.
mixed-unit-border|One unit around the border|measurement-conversions|one-unit-before-calculating|numeric|3–5|Convert perpendicular rectangle sides to one unit before finding perimeter.|One side 1…4 m and another 20…300 cm; full perimeter in centimeters.
rectangle-two-constraints-choice|Meet both design conditions|area-perimeter-models|all-rectangle-options|choice|3–5|Choose a positive whole-number rectangle meeting area and perimeter constraints.|Area 12, 16, 18, 20, 24, 30 or 36; perimeter ceiling makes only its most compact unordered factor pair eligible.
rectangle-existence-choice|Can the design exist?|area-perimeter-models|studio-impossible|choice|3–5|Decide whether given area and perimeter allow positive whole-number sides.|Area 12, 16, 18, 20, 24, 30 or 36; target is an offered factor-pair perimeter or two below the global minimum.
whole-pack-ribbon-choice|Compare what you must buy|multistep-whole-stories|compare-the-plans|choice|3–5|Compare total costs under whole-pack and divisible-length purchase rules.|Need 3…25 m; packs 2…6 m at 2…9 dollars; divisible ribbon 1…4 dollars per meter; no other charges.
`;
export const measurementDefinitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, pageId, mode, gradeBand, description, domain] =
      row.split("|") as [
        string,
        string,
        string,
        string,
        "numeric" | "choice",
        "K–2" | "3–5",
        string,
        string,
      ];
    return { id, title, skillId, pageId, mode, gradeBand, description, domain };
  });
