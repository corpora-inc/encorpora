import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import {
  satCompletionTemplates,
  generateSatCompletionProblem,
} from "../math/sat-completion-practice";

type Instruction = ProblemMethod & {
  intuition: string;
  principle: string;
  /** Rewritten reference lessons carry their own plain opening, objectives,
   * intuition section and parent note; the others are built from the method. */
  summary?: string;
  objectives?: [string, string];
  explain?: { title: string; paragraphs: string[] };
  parentGuide?: string;
};
const instruction: Record<string, Instruction> = {
  "sample-mean-estimate": {
    goal: "Use a random sample average to estimate a population average or total.",
    intuition:
      "A population is the whole group of interest; a sample is the smaller group observed. A simple random sample gives every group of the chosen size an equal chance of selection. Its average can estimate the population average, with uncertainty because another sample can give a different result.",
    terms: [
      [
        "mean-average",
        "Here, the mean of the values observed in a sample, used to estimate the population mean.",
      ],
    ],
    method: [
      "Identify the sampled population and the sample mean, including its units.",
      "Use that mean to estimate the population mean. For an estimated total, multiply the average by the population size, not the sample size.",
    ],
    watch:
      "An estimate is not an exact population value. A sample total and a population total refer to different groups.",
    principle:
      "For a simple random sample from a population of size $N$, the sample mean estimates the population mean, and $N$ times the sample mean estimates its total.",
  },
  "probability-missing-count": {
    goal: "Find an unknown count of objects from the probability of picking one kind.",
    summary:
      "Probability means chance. Picture a bag that holds only red and blue counters, small round tokens. Equally likely means each counter has the same chance of being picked. Then the probability of red is the red count divided by the total count. Sometimes you know the probability but not the red count. Call the unknown red count $x$. With 6 blue counters, the total is $x + 6$. Solving means finding the number that $x$ stands for.",
    objectives: [
      "Write the total count with the unknown in it.",
      "Set favorable ÷ total equal to the given probability, and solve for the unknown count.",
    ],
    intuition:
      "Probability means chance: how likely something is. Each possible pick is called an outcome. Equally likely means every outcome has the same chance. Picking uniformly at random means the same thing: every object has the same chance of being picked. A counter is a small round token. An event is a result we are looking for, such as picking a red counter. The favorable count is how many objects give the event, such as the red counters. The probability of the event is the favorable count divided by the total count. The complement of an event is every outcome where it does not happen, such as picking a blue counter from a bag of only red and blue counters. If the favorable count is unknown, call it $x$. Then the total is $x$ plus the other count.",
    explain: {
      title: "Write the total with the unknown",
      paragraphs: [
        "A bag has 6 blue counters and some red ones. The chance of red is $\\frac{5}{11}$. Call the number of red counters $x$. The total number of counters is $x + 6$, so the chance of red is $\\frac{x}{x + 6}$.",
        "Set the two equal: $\\frac{x}{x + 6} = \\frac{5}{11}$. Multiplying both sides by the same number keeps them equal. Multiply both sides by 11 and by $x + 6$, the two denominators (bottom numbers). Each denominator divides out, so no fractions are left: $11x = 5(x + 6)$. Here $5(x + 6)$ means 5 times the whole sum, so 5 multiplies both parts: $5x + 30$. Subtract $5x$ from both sides, since $11x - 5x = 6x$: $6x = 30$. Divide both sides by 6 to get $x$ alone: $x = 5$.",
        "Check: 5 red and 6 blue make 11 counters, and 5 of the 11 are red. That matches $\\frac{5}{11}$.",
      ],
    },
    senses: {
      complement: "complement-probability",
      event: "event",
      side: "side-of-equation",
    },
    terms: ["complement-probability"],
    method: [
      "Call the unknown count $x$. Write the total as $x$ plus the known other count.",
      "Set favorable ÷ total equal to the given probability. With 6 blue counters and probability $\\frac{5}{11}$, that is $\\frac{x}{x + 6} = \\frac{5}{11}$.",
      "Multiply both sides by both denominators (bottom numbers). Each one divides out, so the fractions disappear, and both sides stay equal. Then solve. Here $11x = 5(x + 6)$, so $6x = 30$ and $x = 5$.",
      "Check that the count is a whole number (0, 1, 2 and so on) and that it gives back the probability. Here $\\frac{5}{5 + 6} = \\frac{5}{11}$.",
    ],
    watch:
      "Divide by the total, the favorable count and the other count together, not by the other count alone.",
    principle:
      "With $r$ favorable objects and $b$ other objects, all equally likely, the probability is $P = \\frac{r}{r + b}$. Multiply both sides by $r + b$: $P(r + b) = r$, so $P \\times b = r - P \\times r = r(1 - P)$. If $P$ is greater than 0 and less than 1, dividing by $1 - P$ gives $r = \\frac{P \\times b}{1 - P}$. For $P = \\frac{5}{11}$ and $b = 6$: $r = \\frac{(5/11) \\times 6}{6/11} = 5$.",
    parentGuide:
      "Put 6 blue counters and some red ones in a cup. Ask how many red ones would make the chance of red exactly 5 out of 11.",
  },
  "standard-deviation-compare": {
    goal: "Compare how spread out two data sets are, using distances from each set's own mean.",
    summary:
      "A data set is a list of values. Its mean, or average, is the total of the values divided by how many there are. Standard deviation measures spread: how far the values typically sit from their mean. Values bunched close together have a small standard deviation. Values spread far apart have a large one. Adding the same number to every value moves the data but keeps the spacing, so the standard deviation stays the same.",
    objectives: [
      "Say how adding to or multiplying every value changes the standard deviation.",
      "Compare two data sets by the distances of their values from their own means.",
    ],
    intuition:
      "A data set is a list of values. The mean, or average, is the total of the values divided by how many there are. A value's deviation is the value minus the mean. It is negative for a value below the mean, and its size is the value's distance from the mean. Standard deviation is a typical size of those distances, so it measures spread: how far apart the values are. A square root is the number, 0 or more, that multiplied by itself gives back the original: the square root of 9 is 3. To find the standard deviation, square each deviation, which means multiplying it by itself, so no result is negative. Add the squares, divide by the count, and take the square root. Many calculators also offer a version that divides by one less than the count, used for a sample from a larger group. That version needs at least two values. Compare two sets with the same version. Big values do not mean big spread. Adding the same number to every value keeps the gaps the same. Multiplying every value by 2 doubles every gap, so it doubles the standard deviation too.",
    explain: {
      title: "Spread is about gaps, not size",
      paragraphs: [
        "Data set A is 17, 21, 25, 29, 33. Its mean is $125 \\div 5 = 25$, and the values sit 8, 4, 0, 4 and 8 away from it.",
        "Add 100 to every value: 117, 121, 125, 129, 133. The mean becomes 125, and the distances are still 8, 4, 0, 4 and 8. The spread did not change.",
        "Multiply every value of A by 2: 34, 42, 50, 58, 66. The mean doubles to 50, and every distance doubles: 16, 8, 0, 8, 16. So the standard deviation doubles too.",
        "When neither shortcut applies, compute each standard deviation. Square each distance from the set's own mean, add the squares, divide by the count, and take the square root. Then compare the two results.",
      ],
    },
    senses: {
      mean: "mean-average",
      square: "square-number",
      range: "range-statistics",
    },
    noLink: ["change", "changes"],
    terms: [
      [
        "standard-deviation",
        "Here $n$ is the number of values. Use the same version for both data sets: dividing by $n$ or by $n - 1$.",
      ],
    ],
    method: [
      "Find how the values changed from one set to the other, if they did. Look at distances from each set's own mean.",
      "If every value moved by the same amount, the spread is unchanged. If every value was multiplied by a number, the spread is multiplied by that number's size, ignoring any minus sign.",
      "Otherwise, compute each set's standard deviation from the distances to its own mean. The larger result means more spread.",
    ],
    watch:
      "Compare distances from the mean, not the size of the mean, and not the range (largest value minus smallest) alone.",
    principle:
      "Suppose every value $x$ is multiplied by a number $a$ and then increased by a number $b$, giving $ax + b$. Here $ax$ means $a$ times $x$. Then the standard deviation is multiplied by $|a|$, read “the absolute value of $a$”: $a$ without its minus sign. Adding $b$ to every value moves the mean by $b$ too, so no distance from the mean changes. This holds for either version of the standard deviation, dividing by the count or by one less, as long as both sets use the same one.",
    parentGuide:
      "Write five numbers, then add 10 to each. Ask whether the numbers became more spread out or just moved.",
  },
  "sample-size-margin": {
    goal: "Explain how a larger comparable random sample affects margin of error.",
    intuition:
      "A sample is the part of a population that we observe. Different random samples give different estimates. A margin of error describes sampling uncertainty around an estimate; information from more people generally reduces that uncertainty.",
    terms: ["confidence-level"],
    method: [
      "Check that the population, random sampling method, confidence level, and quantity estimated are comparable.",
      "Under comparable conditions, choose the larger sample for a generally smaller margin of error. Keep bias separate from random sampling uncertainty.",
    ],
    watch:
      "A larger sample does not guarantee an exact answer and does not repair a biased sampling method.",
    principle:
      "For comparable simple random samples at fixed confidence level, sampling uncertainty generally decreases as sample size increases. For proportions, comparison also assumes comparable proportions and sampling fractions.",
  },
  "compound-unit-conversion": {
    goal: "Convert every unit inside a measurement, such as an area, a volume or a rate, so the amount stays the same.",
    summary:
      "A unit is the size you count in, such as a meter or an hour. Changing units does not change the amount, only how you count it. A kilometer is a length of 1000 meters, so 3 kilometers is 3000 meters. Some units are built from other units, such as square meters for area, or kilometers per hour, where per means “for each”. For these, convert each unit inside that is not already the one you want.",
    objectives: [
      "Convert area and volume units by using a length conversion two or three times.",
      "Convert both units of a rate, and multiply power by time to get energy.",
    ],
    intuition:
      "A unit is the size you count in, such as a meter or an hour. A unit conversion changes the unit but keeps the amount the same. A kilometer is a length of 1000 meters. A ratio compares two amounts by dividing one by the other. A conversion factor is a ratio that equals 1, such as 1000 meters over 1 kilometer. It equals 1 because its top and bottom are the same length. Multiplying by it changes only the unit. A unit cancels when the same unit is on the top and the bottom: the two divide to 1, just as $\\frac{3}{3} = 1$. A compound unit is built from two or more units, such as square meters or kilometers per hour. Area is the space a flat shape covers. A square meter is the area of a square 1 meter long on each side, so area units hold two lengths. A solid is a shape that takes up space, like a box. Volume is the space inside a solid, and its units, such as cubic meters, hold three lengths. A rate compares two amounts with different units by division, such as kilometers per hour: kilometers for each hour. Speed is a rate: distance per unit of time. In a rate written as a fraction, the top amount is the numerator and the bottom amount is the denominator. Squared means multiplied by itself. Acceleration along a straight path is how fast speed changes. Its unit, such as kilometers per hour squared, means kilometers per hour gained each hour, so the hour is on the bottom twice. Energy is what makes things move, heat up or light up. Power is how fast energy is used, and it is measured in watts. A watt-hour is the energy used at 1 watt for 1 hour.",
    explain: {
      title: "Convert every unit inside",
      paragraphs: [
        "1 meter is 100 centimeters. A square 1 meter on each side is 100 centimeters by 100 centimeters. So 1 square meter is $100 \\times 100 = 10000$ square centimeters. The length conversion is used twice, once for each length.",
        "For a rate, convert each unit that differs from the one you want, on the top and on the bottom. 72 kilometers per hour is $72 \\times 1000 = 72000$ meters per 3600 seconds. That is $72000 \\div 3600 = 20$ meters per second.",
        "Hours squared means hours times hours: the hour unit used twice in a multiplication. One hour squared is $3600 \\times 3600 = 12960000$ seconds squared.",
        "Power is how fast energy is used, measured in watts. Power times time gives energy: a 60-watt bulb on for 2 hours uses $60 \\times 2 = 120$ watt-hours.",
      ],
    },
    senses: {
      unit: "unit",
      square: "square-shape",
      squared: "square-number",
      solid: "solid-shape",
      side: "side",
    },
    noLink: ["change", "changes", "more than"],
    terms: ["derived-unit"],
    method: [
      "Write the units you want. Multiply by conversion factors that equal 1, arranged so the old units cancel: each old unit appears once on top and once on the bottom.",
      "For area, use a length conversion twice; for volume, three times. A unit squared inside a rate, such as hours squared, is converted twice as well.",
      "For a rate, convert both the top unit and the bottom unit. To get energy from power, multiply power by time: 60 watts for 2 hours is $60 \\times 2 = 120$ watt-hours.",
    ],
    watch:
      "Use a length conversion twice for area and three times for volume, not once. A unit on the bottom of a rate works the other way: more seconds on the bottom makes the number smaller.",
    principle:
      "Here $k^2$ means $k \\times k$, and $k^3$ means $k \\times k \\times k$. If 1 old length unit equals $k$ new length units, then 1 old area unit equals $k^2$ new area units. Likewise, 1 old volume unit equals $k^3$ new volume units. For example, 1 meter is 100 centimeters, so 1 square meter is $100^2 = 10000$ square centimeters. Multiplying by a conversion factor equal to 1 never changes the measured amount.",
    parentGuide:
      "Use a ruler marked in centimeters. Ask how many 1-centimeter squares fill a square 10 centimeters on each side, and why the answer uses 10 twice.",
  },
  "degree-radian-conversion": {
    goal: "Express the same angle in degrees or radians.",
    intuition:
      "An angle measures a turn. A full turn is 360 degrees. A radian is the turn sweeping an arc as long as the radius, so a full turn is $2\\pi$ radians. Both units describe the same turn.",
    terms: ["radian"],
    method: [
      "Use the equivalence of 180 degrees and $\\pi$ radians.",
      "For degrees to radians, multiply by $\\pi/180$. For radians to degrees, multiply by $180/\\pi$. Keep exact fractions.",
    ],
    watch:
      "Change the unit without changing the fraction of a full turn; do not invert the conversion factor.",
    principle:
      "For the same angle, $\\theta_{\\rm rad}=\\theta_{\\rm deg}\\pi/180$ and $\\theta_{\\rm deg}=180\\theta_{\\rm rad}/\\pi$.",
  },
  "unit-circle-coordinate": {
    goal: "Find an endpoint coordinate on a unit circle using a reference triangle and a quadrant.",
    intuition:
      "The unit circle is centered at the origin and has radius one. Measure an angle counterclockwise from the positive horizontal axis. Its endpoint's horizontal coordinate is cosine and its vertical coordinate is sine. A reference angle is the acute angle between the radius and the horizontal axis.",
    terms: ["quadrant"],
    method: [
      "Find the acute reference angle. A 30–60–90 triangle has side ratio $1:\\sqrt{3}:2$; a 45–45–90 triangle has ratio $1:1:\\sqrt{2}$.",
      "Divide the relevant leg by the hypotenuse to get the magnitude. Give the horizontal or vertical coordinate its quadrant sign.",
    ],
    watch:
      "Cosine is horizontal and sine is vertical. Determine the sign from the endpoint's location.",
    principle:
      "The unit-circle point at angle $\\theta$ is $(\\cos\\theta,\\sin\\theta)$. In quadrants I through IV the coordinate signs are $(+,+)$, $(-,+)$, $(-,-)$, and $(+,-)$, respectively.",
  },
  "similar-solid-volume": {
    goal: "Use the scale factor of similar solids to connect matching lengths and volumes.",
    summary:
      "A solid is a shape that takes up space, with length, width and height, like a box. Similar solids have the same shape: one is a larger, smaller or same-size copy of the other. Every length is multiplied by the same number, called the scale factor. Volume is the space inside a solid. If every length doubles, the volume is multiplied by $2 \\times 2 \\times 2 = 8$, because volume grows in all three directions: across, deep and tall. A ratio is one number divided by another. So the volume ratio is the scale factor cubed: three copies of it multiplied together.",
    objectives: [
      "Find the volume ratio of similar solids from their scale factor.",
      "Find a missing length from the volumes of similar solids.",
    ],
    intuition:
      "A solid is a shape that takes up space, with length, width and height, such as a box or a can. An edge is a line where two surfaces of a solid meet. Examples are the straight edge of a box and the round rim of a can. Similar solids are solids with the same shape, where every length of one is the same number times the matching length of the other. That number is called the scale factor. Corresponding means in matching places, so corresponding edges match each other. A ratio is one number divided by another. Area is the space a flat surface covers. Volume is the space inside a solid. For a box, it is length times width times height. When every length of any solid is multiplied by the scale factor, its volume is multiplied by the scale factor three times, once for each direction. A centimeter (cm) is a small unit of length, about the width of a fingernail. A cubic centimeter is the space inside a cube, a box with all edges equal, 1 cm long on each edge. So the scale factor is cubed for volume: three copies of it are multiplied together. We write $5^3$ for 5 cubed, $5 \\times 5 \\times 5 = 125$, and $k^2$ for $k$ squared, $k \\times k$. A cube root is the number whose three copies multiply to a given number: the cube root of 125 is 5.",
    explain: {
      title: "Length once, area twice, volume three times",
      paragraphs: [
        "Take a cube with edge 1 cm and a cube with edge 2 cm. The scale factor is 2. The big cube's volume is $2 \\times 2 \\times 2 = 8$ cubic centimeters, and the small one's is 1. So the volume ratio is $2^3 = 8$.",
        "Area uses two lengths, so areas scale by the factor squared, which means multiplied by itself: $2^2 = 4$.",
        "To go backward, from volumes to lengths, use the cube root of the volume ratio. If the volume ratio is 125, the length ratio is 5, because $5 \\times 5 \\times 5 = 125$.",
      ],
    },
    senses: {
      similar: "similar-figures",
      edge: "edge",
      solid: "solid-shape",
      cube: "cube",
      root: "root-radical",
      square: "square-number",
      factor: "scale-factor",
    },
    noLink: ["scale"],
    terms: ["scale-factor"],
    method: [
      "From lengths: divide matching lengths to get the scale factor, then cube it to get the volume ratio. For example, edges of 2 cm and 6 cm give $6 \\div 2 = 3$, and $3^3 = 27$.",
      "From volumes: divide the volumes, then take the cube root to get the scale factor. For example, $9250 \\div 74 = 125$, and the cube root of 125 is 5, because $5 \\times 5 \\times 5 = 125$.",
      "Use the factor that matches what is asked. Multiply a known length by the scale factor, as in $3 \\times 5 = 15$ cm. Multiply a known volume by the volume ratio.",
    ],
    watch:
      "Divide in the same order for both ratios, large over small or small over large. A volume ratio is the length ratio cubed, not the length ratio itself.",
    principle:
      "For similar solids with a length scale factor $k$ greater than 0, areas scale by $k^2$ and volumes by $k^3$. Here $k^2$ is $k \\times k$ and $k^3$ is $k \\times k \\times k$. Going back, the length scale factor is the cube root of the volume ratio.",
    parentGuide:
      "Build a 2 by 2 by 2 cube from small cubes. Count that it takes 8, even though each edge only doubled.",
  },
  "nonlinear-formula-isolate": {
    goal: "Get a positive quantity that appears squared in a formula alone on one side.",
    summary:
      "A formula is an equation that links quantities. Squared means multiplied by itself: $v^2$ is $v$ times $v$. Letters written next to each other are multiplied, so $mv^2$ is $m$ times $v^2$. In $E = \\frac{mv^2}{2}$, $E$ is energy, $m$ is mass (how much matter an object has), and $v$ is speed (how fast it moves). To find one quantity, undo the steps around it, doing the same thing to the left and right of the equal sign. To undo squaring, use a square root: a number that, multiplied by itself, gives back the original. A number greater than 0 has two square roots, such as 5 and $-5$ for 25. A speed or a length cannot be negative (less than 0). So take the square root that is 0 or more.",
    objectives: [
      "Undo the steps around a squared quantity in a formula, in reverse order.",
      "Take the square root that is 0 or more when the quantity cannot be negative.",
    ],
    intuition:
      "Mass is how much matter an object has, and speed is how fast it moves. A formula is an equation linking quantities, such as $E = \\frac{mv^2}{2}$ for energy $E$, mass $m$ and speed $v$. Squared means multiplied by itself: $v^2$ is $v$ times $v$, and $mv^2$ is $m$ times $v^2$. An equation has two sides: the parts left and right of the equal sign. Isolate means get one quantity by itself, apart from everything else in the equation. A square root is a number that, multiplied by itself, gives a given number. Every number greater than 0 has two square roots: 25 has 5 and $-5$. The root sign picks the one greater than 0, so $\\sqrt{25} = 5$. An expression is a number, a letter, or numbers and letters joined by operations such as adding, multiplying and dividing. One example is $\\frac{2E}{m}$. A slash also means divide: $2E/m$ is $2E$ divided by $m$. Kinetic energy is the energy an object has because it moves. The sign $>$ means “is greater than”, so $m > 0$ says $m$ is positive.",
    explain: {
      title: "Undo the steps in reverse",
      paragraphs: [
        "In $E = \\frac{mv^2}{2}$, the speed $v$ is squared, then multiplied by $m$, then divided by 2. Undo these in reverse order.",
        "Multiply both sides by 2 to undo the division by 2: $2E = mv^2$. Divide both sides by $m$, which is not 0, to undo the multiplication by $m$: $\\frac{2E}{m} = v^2$.",
        "Now take the square root of both sides. Speed cannot be negative, so take the square root that is 0 or more: $v = \\sqrt{\\frac{2E}{m}}$. Check with numbers: if $m = 2$ and $v = 3$, then $v^2 = 3 \\times 3 = 9$ and $E = \\frac{2 \\times 9}{2} = 9$. And $\\sqrt{\\frac{2 \\times 9}{2}} = \\sqrt{9} = 3$, the speed we started with.",
      ],
    },
    senses: {
      square: "square-number",
      root: "root-radical",
      side: "side-of-equation",
    },
    noLink: ["parts", "rule", "whole"],
    terms: ["principal-square-root"],
    method: [
      "Multiply or divide both sides by the other numbers and letters until the squared quantity is alone. Divide only by quantities that are not 0.",
      "Take the square root that is 0 or more when the quantity cannot be negative, such as a speed or a length.",
      "Check by putting the result back into the original formula.",
    ],
    watch:
      "Get $v^2$ alone first, then take the square root. The root covers the whole fraction: $\\sqrt{\\frac{2E}{m}}$ is not $\\frac{\\sqrt{2E}}{m}$.",
    principle:
      "If $z > 0$ and $z^2 = q$ with $q > 0$, then $z = \\sqrt{q}$. Here $z > 0$ means $z$ is positive. Without the condition $z > 0$, both $\\sqrt{q}$ and $-\\sqrt{q}$ make $z^2 = q$ true. We write this as $z = \\pm\\sqrt{q}$, where $\\pm$ means plus or minus.",
    parentGuide:
      "Pick numbers for mass and speed, find the energy, then use the rearranged formula to get the speed back.",
  },
  "quadratic-context-model": {
    goal: "Build a quadratic and interpret its physically meaningful solution or maximum.",
    intuition:
      "A quadratic contains the square of an unknown. It can arise when two changing lengths are multiplied, or when a height rises and then falls. Define the unknown with units before writing the equation.",
    terms: ["vertex-parabola"],
    method: [
      "Express each quantity in terms of the unknown and translate the relationship, such as area equals length times width.",
      "Solve or find the vertex as requested. Substitute to obtain the requested quantity and reject values outside the context's domain.",
    ],
    watch:
      "A time, height, and length are different answers. Reject negative lengths and distinguish a vertex's input from its output.",
    principle:
      "For $f(x)=ax^2+bx+c$ with $a\\ne0$, the vertex input is $-b/(2a)$. If $a<0$, the maximum occurs there. With two zeros the axis of symmetry lies midway between them.",
  },
  "exponential-time-scale": {
    goal: "Read a growth or decay factor over its stated stretch of time, and rewrite it as a factor per single time unit.",
    summary:
      "Exponential change multiplies by the same number over each equal stretch of time. That number is called the factor. A population that halves every 4.5 years has the factor $\\frac{1}{2}$ every 4.5 years. To get a factor for each single year, find the number that, multiplied in once a year, gives the same halving over 4.5 years. The starting amount stays the same.",
    objectives: [
      "Find the starting amount and the stretch of time that one factor covers.",
      "Rewrite the model with one factor per single time unit.",
    ],
    intuition:
      "A formula is an equation that links quantities. A model is a formula that describes a real situation. Exponential change multiplies an amount by the same number, greater than 0, over each equal stretch of time. That number is called the factor. Growth means the amount gets bigger, with a factor more than 1. Decay means it gets smaller, with a factor between 0 and 1. A power such as $2^3$ means 3 copies of 2 multiplied together: $2 \\times 2 \\times 2 = 8$. The 2 is the base, the number being multiplied, and the small raised 3 is the exponent. An exponent of 0 gives 1, because no copies of the factor have been multiplied in yet. A square root is a number that, multiplied by itself, gives a given number. An exponent of $\\frac{1}{2}$ means the square root greater than 0: $4^{1/2} = 2$, because $2 \\times 2 = 4$. In $P(t) = 80\\left(\\frac{1}{2}\\right)^{t/4.5}$, read “$P$ of $t$”, the input is the time $t$ in years. The output $P(t)$ is the amount. The exponent $t/4.5$ means $t$ divided by 4.5. It counts how many 4.5-year stretches have passed. At $t = 0$ the exponent is 0, so the amount is 80. This is the initial value, the amount at time 0. The factor $\\frac{1}{2}$ applies once every 4.5 years. Two models are equivalent when they give the same output for every input. A model with a rounded factor is only approximately equivalent. Its outputs stay close over short times, but the gap can grow over long times. When a question says its choices are rounded, pick the choice that matches after rounding. A raised dot means times: $200 \\cdot 2$ is 200 times 2.",
    explain: {
      title: "One factor per stretch of time",
      paragraphs: [
        "At $t = 0$, the exponent is 0 and $\\left(\\frac{1}{2}\\right)^0 = 1$, so $P(0) = 80$. At $t = 4.5$, the exponent is 1, so $P = 80 \\times \\frac{1}{2} = 40$. At $t = 9$, the exponent is 2, so $P = 80 \\times \\frac{1}{4} = 20$.",
        "For a factor per year, rewrite the exponent: $\\left(\\frac{1}{2}\\right)^{t/4.5} = \\left(\\left(\\frac{1}{2}\\right)^{1/4.5}\\right)^t$. To four decimal places, meaning four digits after the decimal point, the yearly factor is $\\left(\\frac{1}{2}\\right)^{1/4.5} \\approx 0.8572$, where $\\approx$ means “is about equal to”. Why that number? Over 9 years, two 4.5-year stretches, the amount is multiplied by $\\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$. A yearly factor is used once each year, so 9 copies of it must multiply to $\\frac{1}{4}$. The number $\\left(\\frac{1}{2}\\right)^{1/4.5}$ does this, just as $4^{1/2}$ is the number whose 2 copies multiply to 4. Multiplying by 0.8572 once a year gives about half after 4.5 years.",
        "This uses the rule that a power of a power multiplies the exponents. For example, $\\left(2^3\\right)^2 = 8^2 = 64 = 2^6$, and $3 \\times 2 = 6$. The base, the number being raised, must be positive: $\\left(b^{1/4.5}\\right)^t = b^{t/4.5}$.",
      ],
    },
    senses: {
      base: "base-exponent",
      root: "root-radical",
      model: "model",
      unit: "unit",
    },
    // A growth or decay factor, not a factor that divides a number.
    noLink: ["change", "more than", "population", "rule", "factor", "factors"],
    terms: ["initial-value"],
    method: [
      "Find the initial value, the amount at time 0, and how much time makes the exponent go up by 1.",
      "Compare two times one such stretch apart: the later amount is the earlier amount times the factor.",
      "For a factor per single time unit, raise the factor to the power 1 over the stretch: a factor $b$ every $d$ units is $b^{1/d}$ per unit. Over $d$ units of time it gives back $b$, because $\\left(b^{1/d}\\right)^d = b^{d/d} = b$. The initial value does not change.",
    ],
    watch:
      "A factor for several years is not the factor for each year. Multiplying by the same number is different from adding the same amount.",
    principle:
      "Let $A$ be the initial value, $b$ the factor and $d$ the stretch of time it covers. Each is greater than 0, written $A > 0$, $b > 0$ and $d > 0$. Then $P(t) = A \\times b^{t/d} = A \\times \\left(b^{1/d}\\right)^t$, and $P(t + d) = b \\times P(t)$. Here $b^{1/d}$ is the factor per unit of time. Growth, getting bigger, has $b > 1$. Decay, getting smaller, has $b$ between 0 and 1.",
    parentGuide:
      "Start with 80 and halve it every 4.5 years along a timeline. Ask what single number you would multiply by each year to get the same halving.",
  },
  "symbolic-rational-exponent": {
    goal: "Write roots as powers with fractional exponents on a positive domain.",
    intuition:
      "An exponent records repeated multiplication; a root reverses a power. A fractional exponent combines these operations. A positive base avoids sign and domain complications of roots of negative numbers.",
    terms: ["nth-root"],
    method: [
      "Write an nth root as a power with exponent $1/n$, then multiply by any exponent already on the base.",
      "A reciprocal negates the exponent. Keep the base's domain and reduce the exponent fraction.",
    ],
    watch:
      "The root index divides the power; it does not multiply it. A negative exponent means reciprocal, not a negative value.",
    principle:
      "For $x>0$ and positive integer $n$, $\\sqrt[n]{x^m}=x^{m/n}$ and $1/\\sqrt[n]{x^m}=x^{-m/n}$.",
  },
  "rational-expression-operation": {
    goal: "Combine fractions containing a variable without changing their allowed inputs.",
    intuition:
      "A rational expression is a quotient of polynomials. Like numerical fractions, these need a common denominator before addition or subtraction. A denominator cannot be zero, even if simplification cancels its factor.",
    terms: ["excluded-value"],
    method: [
      "Record excluded inputs. For addition or subtraction, rewrite both fractions over a common denominator, then combine numerators.",
      "For multiplication, multiply numerators and denominators and cancel common nonzero factors. Retain the original exclusions.",
    ],
    watch:
      "Cancel factors of a product, never terms in a sum; distribute subtraction to the entire numerator.",
    principle:
      "For nonzero $B,D$, $A/B+C/D=(AD+BC)/(BD)$, $A/B-C/D=(AD-BC)/(BD)$, and $(A/B)(C/D)=AC/(BD)$. Simplification preserves equality on the original domain.",
  },
  "nonlinear-data-model": {
    goal: "Choose the model whose predictions miss the data by the smallest total of squared residuals.",
    summary:
      "The input is the number you start with, such as a day. A model is a rule that predicts a number from the input, called the output. Data are numbers collected by watching or measuring, such as an amount counted each day. Real data rarely match a model exactly. A residual is the observed value minus the predicted value. Squared means multiplied by itself. To pick the model that fits best, square each residual, add them up, and choose the model with the smallest total.",
    objectives: [
      "Find each model's residuals at the data points.",
      "Choose the model with the smallest sum of squared residuals.",
    ],
    intuition:
      "A model is a rule that predicts one number from another. The input is the number you start with, such as a day. The output is the number the model predicts, such as an amount. A residual is the observed output minus the predicted output. A positive residual means the model predicted too low. Each observed (input, output) pair is a data point. Squaring each residual, which means multiplying it by itself, makes every one 0 or positive. So misses above and below cannot cancel. Squaring also makes big misses count much more. The sum of squared residuals is the total of those squares: a smaller total means a closer fit. In the models below, $x$ is the input and $y$ is the predicted output. A linear model adds the same amount each time the input goes up by 1: $y = 10x + 5$ predicts 5, 15, 25 and 35 for $x = 0, 1, 2, 3$. An exponential model multiplies by the same number each time the input goes up by 1. In $y = 5(2)^x$, the 5 multiplies $(2)^x$. For a whole number $x$, $(2)^x$ means $x$ twos multiplied together, and $(2)^0 = 1$. So $y = 5(2)^x$ predicts 5, 10, 20 and 40 for $x = 0, 1, 2, 3$. A quadratic model has an $x^2$ part ($x$ times $x$) and no higher power, such as $y = 5x^2 + 2$. A close fit does not prove that the input causes the output.",
    explain: {
      title: "Score each model by its misses",
      paragraphs: [
        "The data are $(0, 6)$, $(1, 9)$, $(2, 21)$ and $(3, 39)$: on day 0 the amount is 6, on day 1 it is 9, and so on. Try the model $y = 5(2)^x$. It predicts 5, 10, 20 and 40.",
        "The residuals are $6 - 5 = 1$, $9 - 10 = -1$, $21 - 20 = 1$ and $39 - 40 = -1$. Their squares are 1, 1, 1 and 1, so the sum of squared residuals is 4.",
        "Try $y = 10x + 5$. It predicts 5, 15, 25 and 35. The residuals are 1, $-6$, $-4$ and 4, with squares 1, 36, 16 and 16. The total is 69, much bigger than 4. So $y = 5(2)^x$ fits these data better. A proof is an argument that shows something must be true. A close fit is not a proof that one thing causes another.",
      ],
    },
    senses: { model: "model", square: "square-number", rule: "rule" },
    noLink: ["argument", "change"],
    terms: ["sum-of-squared-residuals"],
    method: [
      "For each model, find the predicted output at every observed input.",
      "Find each residual, observed minus predicted, and square it.",
      "Add the squares for each model. Choose the model with the smallest total, after checking that every data point was used.",
    ],
    watch:
      "Use every data point for every model. A close fit does not show that one thing causes the other, and it does not promise good predictions far from the data.",
    principle:
      "Number the data points and write them $(x_1, y_1), (x_2, y_2)$, and so on: the small numbers count the points. Write $f(x_1)$, read “$f$ of $x_1$”, for the model's predicted output at $x_1$. Then the sum of squared residuals for a model $f$ is $(y_1 - f(x_1))^2 + (y_2 - f(x_2))^2 + \\cdots$, where the dots mean the pattern continues for every point. Of the choices offered, the model with the smallest sum is the least-squares choice.",
    parentGuide:
      "Plot a few points and sketch two possible curves. Ask which curve passes closer to the points, then check by measuring the misses.",
  },
  "quadratic-parameter-root": {
    goal: "Find the coefficient that gives a quadratic equation exactly one real solution.",
    summary:
      "In $3x^2 - 18x + 27 = 0$, $x^2$ ($x$ squared) means $x$ times $x$. An equation with an $x^2$ part and nothing like $x^3$ is called a quadratic equation. A solution is a value of $x$ that makes the equation true. A quadratic equation can have two real solutions (numbers on the number line), one, or none. Its graph crosses the $x$-axis, the horizontal number line, twice, touches it once, or misses it. One number decides which. For $ax^2 + bx + c = 0$ it is $b^2 - 4ac$, called the discriminant, where $4ac$ means 4 times $a$ times $c$. Exactly one solution happens when it is 0.",
    objectives: [
      "Write the discriminant of a quadratic equation and set it equal to 0.",
      "Solve for an unknown coefficient and check that the equation has one repeated solution.",
    ],
    intuition:
      "Squared means multiplied by itself: $x^2$ is $x$ times $x$. A power is several copies of a number multiplied together, so $x^3$, $x$ times $x$ times $x$, is a higher power. Quadratic means having an $x^2$ part and no higher power. A quadratic equation has the form $ax^2 + bx + c = 0$, where $ax^2$ means $a$ times $x^2$, and $a$ is not 0. The numbers $a$, $b$ and $c$ are its coefficients, taken with their signs: $a$ multiplies $x^2$, $b$ multiplies $x$, and $c$ stands alone. In $3x^2 - 18x + 27 = 0$, $a = 3$, $b = -18$ and $c = 27$. A solution, also called a root, is a value of $x$ that makes the equation true. Distinct means different, so a repeated solution counts once. A raised dot means times: $4 \\cdot 3$ is 4 times 3. A number line is a line with the numbers marked in order, and a real number is any number on it. A square root of a number is a number that, multiplied by itself, gives it: 3 and $-3$ are both square roots of 9. The root sign means the one that is 0 or more. The quadratic formula gives the solutions. It is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, where the sign $\\pm$ means one answer adds and the other subtracts. The discriminant is the number $b^2 - 4ac$, the part under its root sign. If the discriminant is positive, there are two real solutions. If it is 0, there is exactly one. If it is negative, there are none, because no real number times itself is negative.",
    explain: {
      title: "When two solutions become one",
      paragraphs: [
        "In $3x^2 - 18x + c = 0$, $a = 3$, $b = -18$, and $c$ is unknown. The discriminant is $(-18)^2 - 4 \\times 3 \\times c = 324 - 12c$.",
        "For exactly one solution, set it to 0: $324 - 12c = 0$. Add $12c$ to both sides: $12c = 324$. Divide both sides by 12: $c = 27$.",
        "Check: take out the common factor 3, and notice that $x^2 - 6x + 9 = (x - 3)(x - 3)$. So $3x^2 - 18x + 27 = 3(x - 3)^2$. A square is 0 only when the number being squared is 0. So $x - 3 = 0$, and $x = 3$ is the only solution. The quadratic formula, $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, gives two answers, one with + and one with −. They become the same number when $b^2 - 4ac$ is 0.",
      ],
    },
    senses: {
      root: "root-equation",
      square: "square-number",
      term: "term-expression",
      factor: "factor-number",
    },
    noLink: ["part", "whole"],
    terms: ["discriminant"],
    method: [
      "Read $a$, $b$ and $c$ with their signs, and check that $a$ is not 0.",
      "Write the discriminant $b^2 - 4ac$ and set it equal to 0.",
      "Solve for the unknown coefficient. Put that value back into the equation and check that it has one repeated solution. For example, $3x^2 - 18x + 27 = 3(x - 3)^2 = 0$ gives only $x = 3$.",
    ],
    watch:
      "Square the whole signed middle coefficient: $(-18)^2 = 324$, not $-324$. Keep the $4a$ that multiplies $c$ when you solve for $c$.",
    principle:
      "For real coefficients with $a$ not 0, $ax^2 + bx + c = 0$ has exactly one real solution exactly when $b^2 - 4ac = 0$. That solution is $x = \\frac{-b}{2a}$. There are two real solutions when $b^2 - 4ac > 0$, and none when $b^2 - 4ac < 0$.",
    parentGuide:
      "Graph $y = 3x^2 - 18x + c$ for a few values of $c$. Watch the curve go from crossing the $x$-axis twice to just touching it at $c = 27$.",
  },
  "rational-function-representation": {
    goal: "Connect a fractional rule with input-output pairs while respecting its excluded input.",
    intuition:
      "A function assigns an output to each allowed input. A variable denominator can exclude an input where the denominator is zero. A table gives sample pairs, which can be checked by substitution.",
    terms: ["domain"],
    method: [
      "Exclude any input making a zero denominator. Substitute a table input into each proposed rule and compare outputs.",
      "To recover an input, undo the outside addition before solving the fraction equation. Check in the original rule.",
    ],
    watch:
      "Apply the denominator shift before dividing and the outside shift afterward. A table need not list the excluded input for the restriction to apply.",
    principle:
      "For $a\\ne0$, $f(x)=a/(x-h)+k$ has domain $x\\ne h$. For output $y\\ne k$, its input is $x=h+a/(y-k)$; output $k$ is impossible.",
  },
};
const furtherPitfalls: Record<string, string> = {
  "standard-deviation-compare":
    "A larger range, the largest value minus the smallest, does not always mean a larger standard deviation. The other values and their distances matter too.",
  "sample-size-margin":
    "Changing the confidence level, sampling method, or population can invalidate a comparison based only on sample size.",
  "compound-unit-conversion":
    "Watts measure power, how fast energy is used. A watt-hour is the energy used at 1 watt for 1 hour. Multiply power by time to get energy, and do not divide.",
  "degree-radian-conversion":
    "Keep the exact multiple of $\\pi$ unless a decimal approximation is requested.",
  "unit-circle-coordinate":
    "Use the acute reference angle for a special triangle, then return to the original angle's quadrant.",
  "similar-solid-volume":
    "The solids must be similar. For two different shapes, a volume ratio alone does not give an edge ratio.",
  "nonlinear-formula-isolate":
    "Here the situation picks the positive square root. A letter with no such limit could also take the negative square root.",
  "quadratic-context-model":
    "Check the result in the original area or height relationship and use the units of the quantity requested.",
  "exponential-time-scale":
    "The initial value is the amount at time 0. It stays the same when the stretch of time is rewritten.",
  "symbolic-rational-exponent":
    "The positive-base assumption matters. Even roots of negative real numbers are outside the real domain.",
  "rational-expression-operation":
    "A factor cancelled during simplification still excludes its original zero from the domain.",
  "nonlinear-data-model":
    "Reversing a residual's sign, from plus to minus or back, does not change its square. The sign still tells you whether the model predicted too high or too low.",
  "quadratic-parameter-root":
    "If $a$ were 0, the equation would not be quadratic, and the discriminant test would not apply.",
  "rational-function-representation":
    "In the denominator $x-h$, a positive $h$ moves the vertical gap to the right, not left.",
  "sample-mean-estimate":
    "Use population size for a population total. Sample size gives only an estimated total for the sampled group.",
  "probability-missing-count":
    "Check that the count you find is a whole number: 0, 1, 2 and so on. Then check that it gives back the stated probability.",
};
export const satCompletionMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    Object.entries(instruction).map(
      ([
        id,
        {
          principle: _principle,
          summary: _summary,
          objectives: _objectives,
          explain: _explain,
          parentGuide: _parentGuide,
          ...method
        },
      ]) => [id, method],
    ),
  );
export const satCompletionPrinciples = Object.fromEntries(
  Object.entries(instruction).map(([id, value]) => [id, value.principle]),
);
export const satCompletionLessons: Lesson[] = satCompletionTemplates.map(
  (meta) => {
    const text = instruction[meta.id]!;
    const example = generateSatCompletionProblem(meta.id, "sat-reference");
    const response = example.public.response;
    const answer =
      response.kind === "choice"
        ? response.options.find((o) => o.id === example.answer)!.label
        : example.answer;
    return {
      id: meta.id,
      title: meta.title,
      summary: text.summary ?? text.intuition,
      templateIds: [meta.id],
      ...(text.explain
        ? {
            // The worked example is generated: read its words as the method does.
            senses: text.senses,
            noLink: text.noLink,
          }
        : {}),
      includeGeneratedRepresentation: false,
      objectives: text.objectives ?? [text.goal, text.method[0]!],
      sections: text.explain
        ? [
            {
              stage: "intuition",
              title: "What the words mean",
              paragraphs: [text.intuition],
            },
            {
              stage: "intuition",
              title: text.explain.title,
              paragraphs: text.explain.paragraphs,
            },
          ]
        : [],
      closingSections: [
        {
          stage: "method",
          title: text.explain ? "Steps" : meta.title,
          paragraphs: text.method,
        },
        {
          stage: "formal",
          title: "Rule and conditions",
          paragraphs: [text.principle],
        },
      ],
      workedExample: {
        prompt: example.public.prompt,
        steps: example.explanation,
        answer,
        ...(response.kind === "choice"
          ? { choices: response.options.map((o) => o.label) }
          : {}),
        ...(example.public.figure ? { figure: example.public.figure } : {}),
      },
      pitfalls: [text.watch!, furtherPitfalls[meta.id]!],
      parentGuide:
        text.parentGuide ??
        "Ask the learner to identify the givens, the requested quantity, and the reason each step preserves the relationship.",
    };
  },
);
