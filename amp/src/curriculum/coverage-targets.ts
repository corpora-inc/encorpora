/** Target membership is not evidence that its sources have been inventoried. */
export interface CoverageTarget {
  id: string;
  name: string;
  kind: "state" | "assessment";
  sourceInventory: "pending";
}
const states = `AL|Alabama
AK|Alaska
AZ|Arizona
AR|Arkansas
CA|California
CO|Colorado
CT|Connecticut
DE|Delaware
DC|District of Columbia
FL|Florida
GA|Georgia
HI|Hawaii
ID|Idaho
IL|Illinois
IN|Indiana
IA|Iowa
KS|Kansas
KY|Kentucky
LA|Louisiana
ME|Maine
MD|Maryland
MA|Massachusetts
MI|Michigan
MN|Minnesota
MS|Mississippi
MO|Missouri
MT|Montana
NE|Nebraska
NV|Nevada
NH|New Hampshire
NJ|New Jersey
NM|New Mexico
NY|New York
NC|North Carolina
ND|North Dakota
OH|Ohio
OK|Oklahoma
OR|Oregon
PA|Pennsylvania
RI|Rhode Island
SC|South Carolina
SD|South Dakota
TN|Tennessee
TX|Texas
UT|Utah
VT|Vermont
VA|Virginia
WA|Washington
WV|West Virginia
WI|Wisconsin
WY|Wyoming`;
export const coverageTargets: readonly CoverageTarget[] = [
  ...states.split("\n").map((row): CoverageTarget => {
    const [code, name] = row.split("|");
    return {
      id: `US.${code}`,
      name: name!,
      kind: "state",
      sourceInventory: "pending",
    };
  }),
  ...["SAT", "PSAT/NMSQT", "PSAT 10", "PSAT 8/9"].map(
    (name): CoverageTarget => ({
      id: name.replaceAll(" ", "-"),
      name,
      kind: "assessment",
      sourceInventory: "pending",
    }),
  ),
];
