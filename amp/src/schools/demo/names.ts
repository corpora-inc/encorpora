/**
 * Made-up names for demo places and the school fixtures. Every name here is
 * fictional: common given and family names, combined at random, so no line
 * stands for a real person.
 */
export const GIVEN_NAMES =
  "Amara Caleb Diego Elias Eli Felix Hana Imani Isaac Jonah Kai Lena Marcus Mei Nadia Noor Owen Priya Ruth Sam Sofia Theo Tomas Zara Ada Bram Cleo Dara Emre Farah Gus Hugo Ines Jada Kofi Lila Milo Nia Omar Pia Quinn Rafi Sana Tess Uma Vik Wren Xan Yara Zeke Aiko Beni Cyra Dov Esme Femi Gael Hollis Ira Juno Kenji Lior Maren Nico Odile Pax Rosa Saul Tavi Una Vera Wade Yusuf Zoya".split(
    " ",
  );
export const FAMILY_NAMES =
  "Osei Ortiz Salas Frost Novak Grant Sato Clarke Moreno Reyes Nakamura Fischer Bell Tran Petrov Haddad Hartley Raman Adeyemi Whitlock Marin Lindqvist Vega Mensah Abara Beck Cruz Dahl Eze Flores Gupta Holm Ito Jones Kim Lund Mora Ng Obi Park Quist Rossi Silva Tate Ueda Voss Wolfe Xu Yates Zhou Achebe Bose Castro Dorsey Ekwueme Farrow Galli Hayes Iyer Jansen Kaur Lowe Mbeki Navarro Oduya Pryor Rahman Sandoval Toivonen Umeh Varga Wexler Yilmaz Zamora".split(
    " ",
  );
/** Teachers as students call them. */
export const TEACHER_NAMES =
  "Ms. Okafor,Mr. Lindgren,Ms. Tanaka,Mr. Abara,Ms. Rivera,Mr. Dube,Ms. Novak,Mr. Haddad,Ms. Ferreira,Mr. Oyelaran,Ms. Kowalski,Mr. Ito,Ms. Shah,Mr. Moreau,Ms. Bianchi,Mr. Nguyen,Ms. Larsen,Mr. Castillo".split(
    ",",
  );
/** The first `count` of a stream of distinct given and family name pairs,
 * skipping any in `taken`. */
export function namePairs(
  count: number,
  start = 0,
  taken: ReadonlySet<string> = new Set(),
): [string, string][] {
  const pairs: [string, string][] = [];
  for (let index = start; pairs.length < count; index++) {
    const given = GIVEN_NAMES[index % GIVEN_NAMES.length]!;
    const family =
      FAMILY_NAMES[
        (Math.floor(index / GIVEN_NAMES.length) + index * 7) %
          FAMILY_NAMES.length
      ]!;
    if (!taken.has(`${given} ${family}`)) pairs.push([given, family]);
  }
  return pairs;
}
