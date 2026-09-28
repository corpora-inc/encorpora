import type { CanonicalTask } from './types';
import { expectedAnswer } from './tasks';
import { add, compare, divide, formatRational as fmt, multiply, parseRational as p, rational, subtract } from './rational';

/** Local explanations are derived from the same exact quantities as the checked task. */
export function teachTask(t:CanonicalTask):{hint:string;explanation:string} {
 const answer=expectedAnswer(t);
 let hint:string, steps:string;
 switch(t.kind) {
  case 'arithmetic': {
   const left=p(t.left),right=p(t.right);
   if(t.operation==='add'||t.operation==='subtract') {
    const symbol=t.operation==='add'?'+':'−';
    if(left.d!==1n||right.d!==1n) {
     hint='Use equal-sized parts: give both fractions the same denominator, then combine the numerators.';
     const denominator=left.d*right.d;
     steps=`${left.n*right.d}/${denominator} ${symbol} ${right.n*left.d}/${denominator} = ${answer}. Simplify the fraction if you can.`;
    } else {
     hint=left.n<0n||right.n<0n?'Use a number line: adding a positive number moves right; subtracting it moves left. Reverse direction for a negative number.':t.operation==='add'?'Add the ones, then the tens and larger places; regroup when a place reaches ten.':'Subtract one place at a time, starting with the ones; regroup a ten if needed.';
     steps=`${t.left} ${symbol} ${t.right} = ${answer}. Check by ${t.operation==='add'?`subtracting ${t.right} from ${answer}`:`adding ${t.right} to ${answer}`}: you get ${t.left}.`;
     if(left.n>=0n&&right.n>=10n&&right.n%10n!==0n) {
      const tens=right.n/10n*10n,ones=right.n%10n;
      const partial=t.operation==='add'?left.n+tens:left.n-tens;
      steps=`First ${t.left} ${symbol} ${tens} = ${partial}. Then ${partial} ${symbol} ${ones} = ${answer}.`;
     }
    }
   } else if(t.operation==='multiply') {
    hint=left.d!==1n||right.d!==1n?'Multiply the numerators and multiply the denominators, then simplify.':'Split one factor into easier parts, multiply each part, then add the products.';
    if(left.d!==1n||right.d!==1n)steps=`(${left.n} × ${right.n}) / (${left.d} × ${right.d}) = ${answer}.`;
    else {
     const tens=right.n/10n*10n,rest=right.n-tens;
     if(left.n<0n||right.n<0n)hint='Multiply the magnitudes first; equal signs give a positive product and different signs give a negative product.';
     steps=tens!==0n&&rest!==0n?`${t.left} × (${tens} + ${rest}) = ${left.n*tens} + ${left.n*rest} = ${answer}.`:`${t.left} × ${t.right} = ${answer}. Check: ${answer} ÷ ${t.right} = ${t.left}.`;
     if(right.n>=3n&&right.n<=9n&&left.n>=0n) {
      const easy=right.n>5n?5n:right.n-1n,remaining=right.n-easy;
      steps=`${t.left} × ${t.right} = (${t.left} × ${easy}) + (${t.left} × ${remaining}) = ${left.n*easy} + ${left.n*remaining} = ${answer}.`;
     }
     if(right.n===0n)steps=`Multiplying ${t.left} by zero gives 0: there are no groups to count.`;
    }
   } else {
    hint=right.d!==1n?'Dividing by a fraction means multiplying by its reciprocal: flip the divisor, not the first number.':'Think of the related multiplication: what times the divisor gives the first number?';
    steps=right.d!==1n?`${t.left} × ${fmt(rational(right.d,right.n))} = ${answer}.`:`${t.left} ÷ ${t.right} = ${answer}. Check: ${answer} × ${t.right} = ${t.left}.`;
   }
   break;
  }
  case 'compare': hint='Use a number line: the number farther right is greater. For fractions, compare equal-sized parts.'; steps=`${t.left} ${answer} ${t.right}. ${answer==='='?'They name the same amount.':`${answer==='>'?t.left:t.right} is farther right on the number line.`}`; break;
  case 'missing': hint='Use the inverse operation to undo the operation beside the box.'; steps=`The box is ${answer}. Check by putting ${answer} back into the original equation.`; break;
  case 'fraction': hint='The denominator counts all equal parts; the numerator counts only shaded parts.'; steps=`${t.numerator} shaded parts out of ${t.denominator} equal parts give ${t.numerator}/${t.denominator} = ${answer}.`; break;
  case 'placeValue': hint='Count places from the right: ones, tens, hundreds, thousands. Multiply the digit by its place value.'; steps=`The digit is ${Math.floor(t.value/10**t.place)%10}; each is worth ${10**t.place}, so its value is ${answer}.`; break;
  case 'round': hint='Find the two neighboring multiples of the rounding place, then choose the closer one.'; steps=`${t.value} rounds to ${answer} at a step size of ${t.place}. At an exact halfway point, choose the value farther from zero.`; break;
  case 'sequence': hint=`The jump stays ${t.step}; add that jump to the last number shown.`; steps=`The last shown value is ${fmt(add(p(t.start),multiply(p(t.step),rational(BigInt(t.count-1)))))}. Add ${t.step} once more to get ${answer}.`; break;
  case 'measure':
   if(t.shape==='cuboid') {hint=t.measure==='volume'?'Count one layer (width × height), then multiply by the number of layers.':'A box has three pairs of equal faces; add their areas and double the sum.'; steps=t.measure==='volume'?`${t.width} × ${t.height} × ${t.depth} = ${answer} cubic units.`:`2 × ((${t.width} × ${t.height}) + (${t.width} × ${t.depth}) + (${t.height} × ${t.depth})) = ${answer} square units.`;}
   else if(t.shape==='triangle'){hint='A triangle takes half the area of a rectangle with the same base and perpendicular height.';steps=`(${t.width} × ${t.height}) ÷ 2 = ${answer} square units.`;}
   else {hint=t.measure==='area'?'Area counts unit squares inside: multiply the two side lengths.':'Perimeter measures the outside edge: add all four side lengths.';steps=t.measure==='area'?`${t.width} × ${t.height} = ${answer} square units.`:`2 × (${t.width} + ${t.height}) = ${answer} units.`;}
   break;
  case 'linear': hint='Keep both sides equal: undo the added number, then divide by the coefficient of x.'; steps=`Subtract ${t.b} from both sides: ${t.a} × x = ${fmt(subtract(p(t.c),p(t.b)))}. Divide by ${t.a}: x = ${answer}.`; break;
  case 'power': hint=t.exponent<0?'A negative exponent means the reciprocal of the corresponding positive power.':t.exponent===0?'Every nonzero number raised to the power zero equals one.':'The exponent counts copies of the base multiplied together; it does not multiply the base.'; steps=`(${t.base})^${t.exponent} = ${answer}.`; break;
  case 'factors': hint=t.operation==='gcd'?'List the factors of both numbers and choose the largest factor shared by both.':'List multiples of both numbers until you find the first positive one they share.';steps=t.operation==='gcd'?`${answer} is the largest whole number dividing both ${t.left} and ${t.right} evenly.`:`${answer} is the smallest positive multiple shared by ${t.left} and ${t.right}.`;break;
  case 'statistics': {
   hint=t.operation==='mean'?'Add all the values, then divide by how many values there are.':t.operation==='median'?'Sort the values first; take the middle value, or average the middle pair.':'Subtract the smallest value from the largest.';
   const ordered=t.values.map(p).sort(compare),middle=Math.floor(ordered.length/2);
   steps=t.operation==='mean'?`The sum is ${fmt(t.values.map(p).reduce(add,rational(0n)))}. Divide by ${t.values.length} to get ${answer}.`:t.operation==='range'?`${fmt(ordered.at(-1)!)} − ${fmt(ordered[0])} = ${answer}.`:`In order: ${ordered.map(fmt).join(', ')}. ${ordered.length%2?`The middle value is ${answer}.`:`Average the middle pair: (${fmt(ordered[middle-1])} + ${fmt(ordered[middle])}) ÷ 2 = ${answer}.`}`;
   break;
  }
  case 'probability': hint='Write favorable outcomes over all equally likely outcomes, then simplify.';steps=`${t.favorable}/${t.total} = ${answer}.`;break;
  case 'percent': hint='Percent means per hundred: divide the percent by 100, then multiply by the whole.';steps=`${fmt(divide(p(t.percent),rational(100n)))} × ${t.whole} = ${answer}.`;break;
  case 'rate': hint='To find the amount for one unit, divide the total quantity by the number of units.';steps=`${t.quantity} ÷ ${t.units} = ${answer} per unit.`;break;
  case 'slope': hint='Slope is change in y divided by change in x; subtract the coordinates in the same order.';steps=`(${t.y2} − ${t.y1}) ÷ (${t.x2} − ${t.x1}) = ${answer}.`;break;
  case 'pythagorean': hint='Square both legs and add their squares; the hypotenuse is the positive square root of that sum.';steps=`${t.a}² + ${t.b}² = ${t.a*t.a+t.b*t.b}. Its positive square root is ${answer} units.`;break;
  case 'evaluate': hint='Replace each x with the given value; do powers first, then multiplication, then addition.';steps=`Substituting ${t.x} for x gives ${answer}.`;break;
 }
 return {hint,explanation:steps};
}
