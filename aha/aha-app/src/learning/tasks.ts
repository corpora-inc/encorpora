import type { Activity, CanonicalTask, GradeResult, Skill, ValidationResult, VisualSpec } from './types';
import { getSkill } from './curriculum';
import { add, compare, divide, formatRational as fmt, gcd, multiply, parseRational as p, rational, subtract, toNumber, type Rational } from './rational';
const ops = {add,subtract,multiply,divide};
const symbols = {add:'+',subtract:'−',multiply:'×',divide:'÷'};
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function fields(t: Record<string,unknown>, required:string[]) {
 if (Object.keys(t).some(k=>!['kind',...required].includes(k)) || required.some(k=>!(k in t))) throw new Error('Task has missing or unsupported fields.');
}
function number(x:unknown,min=0,max=1000000):number {
 if (typeof x !== 'number' || !Number.isSafeInteger(x) || x < min || x > max) throw new Error('Task integer is outside its permitted range.'); return x;
}
function value(x:unknown):string {
 if (typeof x !== 'string') throw new Error('Task numbers must be exact strings.');
 const r=p(x); if (r.n < -1000000n*r.d || r.n > 1000000n*r.d || r.d > 1000000n) throw new Error('Task quantity is outside its permitted range.');
 return fmt(r);
}
function oneOf<T extends string>(x:unknown, allowed:readonly T[]): T {
 if (typeof x !== 'string' || !allowed.includes(x as T)) throw new Error('Unsupported task option.'); return x as T;
}
export function validateTask(raw: unknown): CanonicalTask {
 if (!rec(raw)) throw new Error('Task must be an object.');
 const t=raw;
 let task:CanonicalTask;
 switch(t.kind) {
  case 'arithmetic': fields(t,['operation','left','right']); task={kind:t.kind,operation:oneOf(t.operation,['add','subtract','multiply','divide']),left:value(t.left),right:value(t.right)}; break;
  case 'compare': fields(t,['left','right']); task={kind:t.kind,left:value(t.left),right:value(t.right)}; break;
  case 'missing': fields(t,['operation','left','result']); task={kind:t.kind,operation:oneOf(t.operation,['add','subtract','multiply','divide']),left:value(t.left),result:value(t.result)}; break;
  case 'fraction': fields(t,['numerator','denominator']); task={kind:t.kind,numerator:number(t.numerator,0,24),denominator:number(t.denominator,1,24)}; if(task.numerator>task.denominator) throw new Error('Fraction picture represents one whole.'); break;
  case 'placeValue': fields(t,['value','place']); task={kind:t.kind,value:number(t.value),place:number(t.place,0,5)}; break;
  case 'round': fields(t,['value','place']); task={kind:t.kind,value:value(t.value),place:value(t.place)}; if(!['1/1000','1/100','1/10','1','10','100','1000','10000','100000'].includes(task.place)) throw new Error('Choose a decimal rounding place.'); break;
  case 'sequence': fields(t,['start','step','count']); task={kind:t.kind,start:value(t.start),step:value(t.step),count:number(t.count,2,8)}; break;
  case 'measure': {
   const shape=oneOf(t.shape,['rectangle','triangle','cuboid']); fields(t,shape==='cuboid'?['shape','measure','width','height','depth']:['shape','measure','width','height']);
   const width=value(t.width),height=value(t.height);
   if(p(width).n<=0n||p(height).n<=0n) throw new Error('Lengths must be positive.');
   if(shape==='cuboid') { const depth=value(t.depth); if(p(depth).n<=0n) throw new Error('Lengths must be positive.'); task={kind:'measure',shape,measure:oneOf(t.measure,['volume','surfaceArea']),width,height,depth}; }
   else if(shape==='triangle') task={kind:'measure',shape,measure:oneOf(t.measure,['area']),width,height};
   else task={kind:'measure',shape,measure:oneOf(t.measure,['area','perimeter']),width,height}; break;
  }
  case 'linear': fields(t,['a','b','c']); task={kind:t.kind,a:value(t.a),b:value(t.b),c:value(t.c)}; break;
  case 'power': fields(t,['base','exponent']); task={kind:t.kind,base:value(t.base),exponent:number(t.exponent,-6,6)}; if(Math.abs(toNumber(p(task.base)))>100) throw new Error('Power base is too large.'); break;
  case 'factors': fields(t,['operation','left','right']); task={kind:t.kind,operation:oneOf(t.operation,['gcd','lcm']),left:number(t.left,1,100),right:number(t.right,1,100)}; break;
  case 'statistics': fields(t,['operation','values']); if(!Array.isArray(t.values)||t.values.length<2||t.values.length>20) throw new Error('Use 2–20 data values.'); task={kind:t.kind,operation:oneOf(t.operation,['mean','median','range']),values:t.values.map(value)}; break;
  case 'probability': fields(t,['favorable','total']); task={kind:t.kind,favorable:number(t.favorable),total:number(t.total,1)}; if(task.favorable>task.total) throw new Error('Favorable outcomes exceed total outcomes.'); break;
  case 'percent': fields(t,['percent','whole']); task={kind:t.kind,percent:value(t.percent),whole:value(t.whole)}; break;
  case 'rate': fields(t,['quantity','units']); task={kind:t.kind,quantity:value(t.quantity),units:value(t.units)}; if(p(task.units).n<=0n||p(task.quantity).n<0n) throw new Error('Rate quantities must be nonnegative with positive units.'); break;
  case 'slope': fields(t,['x1','y1','x2','y2']); task={kind:t.kind,x1:value(t.x1),y1:value(t.y1),x2:value(t.x2),y2:value(t.y2)}; break;
  case 'pythagorean': fields(t,['a','b']); task={kind:t.kind,a:number(t.a,1,1000),b:number(t.b,1,1000)}; if(!Number.isInteger(Math.sqrt(task.a**2+task.b**2))) throw new Error('This task requires an exact whole-number hypotenuse.'); break;
  case 'evaluate': fields(t,['coefficients','x']); if(!Array.isArray(t.coefficients)||!t.coefficients.length||t.coefficients.length>4) throw new Error('Use a polynomial of degree at most three.'); task={kind:t.kind,coefficients:t.coefficients.map(value),x:value(t.x)}; break;
  default: throw new Error('Unsupported task kind.');
 }
 const answer=expectedAnswer(task); // Reject zero division and non-unique equations before rendering.
 if(task.kind!=='compare')p(answer); // Every accepted task must have an answer the input grammar can represent.
 return task;
}
export function expectedAnswer(t:CanonicalTask):string {
 let result:Rational;
 switch(t.kind) {
  case 'arithmetic': result=ops[t.operation](p(t.left),p(t.right)); break;
  case 'compare': return ['<','=','>'][compare(p(t.left),p(t.right))+1];
  case 'missing': {
   const left=p(t.left), total=p(t.result);
   if((t.operation==='multiply'||t.operation==='divide') && left.n===0n) throw new Error('Missing value must have exactly one solution.');
   result=t.operation==='add'?subtract(total,left):t.operation==='subtract'?subtract(left,total):t.operation==='multiply'?divide(total,left):divide(left,total); break;
  }
  case 'fraction': result=rational(BigInt(t.numerator),BigInt(t.denominator)); break;
  case 'placeValue': result=rational(BigInt(Math.floor(t.value/10**t.place)%10)*10n**BigInt(t.place)); break;
  case 'round': { const q=divide(p(t.value),p(t.place)); const sign=q.n<0n?-1n:1n; const abs=q.n*sign; const rounded=abs/q.d+((abs%q.d)*2n>=q.d?1n:0n); result=multiply(rational(sign*rounded),p(t.place)); break; }
  case 'sequence': result=add(p(t.start),multiply(p(t.step),rational(BigInt(t.count)))); break;
  case 'measure': { const w=p(t.width),h=p(t.height); result=t.shape==='triangle'?divide(multiply(w,h),rational(2n)):t.shape==='rectangle'?(t.measure==='area'?multiply(w,h):multiply(add(w,h),rational(2n))):t.measure==='volume'?multiply(multiply(w,h),p(t.depth)):multiply(add(add(multiply(w,h),multiply(w,p(t.depth))),multiply(h,p(t.depth))),rational(2n)); break; }
  case 'linear': result=divide(subtract(p(t.c),p(t.b)),p(t.a)); break;
  case 'power': { const base=p(t.base),exponent=BigInt(Math.abs(t.exponent)); if(base.n===0n && t.exponent<=0) throw new Error('Zero power is undefined for this exponent.'); result=t.exponent<0?rational(base.d**exponent,base.n**exponent):rational(base.n**exponent,base.d**exponent); break; }
  case 'factors': { const g=gcd(BigInt(t.left),BigInt(t.right)); result=rational(t.operation==='gcd'?g:BigInt(t.left)*BigInt(t.right)/g); break; }
  case 'statistics': { const v=t.values.map(p).sort(compare); const middle=Math.floor(v.length/2); result=t.operation==='mean'?divide(v.reduce(add,rational(0n)),rational(BigInt(v.length))):t.operation==='range'?subtract(v[v.length-1],v[0]):v.length%2?v[middle]:divide(add(v[middle-1],v[middle]),rational(2n)); break; }
  case 'probability': result=rational(BigInt(t.favorable),BigInt(t.total)); break;
  case 'percent': result=divide(multiply(p(t.percent),p(t.whole)),rational(100n)); break;
  case 'rate': result=divide(p(t.quantity),p(t.units)); break;
  case 'slope': result=divide(subtract(p(t.y2),p(t.y1)),subtract(p(t.x2),p(t.x1))); break;
  case 'pythagorean': result=rational(BigInt(Math.sqrt(t.a**2+t.b**2))); break;
  case 'evaluate': result=t.coefficients.slice().reverse().reduce((acc,c)=>add(multiply(acc,p(t.x)),p(c)),rational(0n)); break;
 }
 return fmt(result);
}
export function renderTask(t:CanonicalTask):string {
 switch(t.kind) {
  case 'arithmetic': return `${t.left} ${symbols[t.operation]} ${t.right} = ?`;
  case 'compare': return `Compare ${t.left} and ${t.right}. Choose <, =, or >.`;
  case 'missing': return `${t.left} ${symbols[t.operation]} □ = ${t.result}. What belongs in the box?`;
  case 'fraction': return `A whole is split into ${t.denominator} equal parts. ${t.numerator} are shaded. What fraction is shaded?`;
  case 'placeValue': return `In ${t.value}, what is the value of the digit in the ${['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands'][t.place]} place?`;
  case 'round': return `Round ${t.value} to the nearest ${t.place}. If exactly halfway, round away from zero.`;
  case 'sequence': return `Start at ${t.start} and add ${t.step} each time: ${Array.from({length:t.count},(_,i)=>fmt(add(p(t.start),multiply(p(t.step),rational(BigInt(i)))))).join(', ')}, … What comes next?`;
  case 'measure': return t.shape==='cuboid'?`A rectangular prism has edges ${t.width}, ${t.height}, and ${t.depth} units. What is its ${t.measure==='volume'?'volume in cubic units':'surface area in square units'}?`:t.shape==='triangle'?`A triangle has base ${t.width} units and perpendicular height ${t.height} units. What is its area in square units?`:`A rectangle is ${t.width} units wide and ${t.height} units long. What is its ${t.measure==='area'?'area in square units':'perimeter in units'}?`;
  case 'linear': return `Solve for x: (${t.a}) × x + (${t.b}) = ${t.c}.`;
  case 'power': return `What is (${t.base}) raised to the power ${t.exponent}?`;
  case 'factors': return `What is the ${t.operation==='gcd'?'greatest common factor':'least common multiple'} of ${t.left} and ${t.right}?`;
  case 'statistics': return `Find the ${t.operation} of these values: ${t.values.join(', ')}.`;
  case 'probability': return `There are ${t.total} equally likely outcomes; ${t.favorable} are favorable. What is the probability of a favorable outcome?`;
  case 'percent': return `What is ${t.percent}% of ${t.whole}?`;
  case 'rate': return `${t.quantity} items are shared equally across ${t.units} units. How many items per unit?`;
  case 'slope': return `Find the slope of the line through (${t.x1}, ${t.y1}) and (${t.x2}, ${t.y2}).`;
  case 'pythagorean': return `A right triangle has legs ${t.a} and ${t.b} units. What is the hypotenuse length in units?`;
  case 'evaluate': return `When x = ${t.x}, what is ${t.coefficients.map((c,i)=>`(${c})${i===0?'':i===1?' × x':` × x^${i}`}`).join(' + ')}?`;
 }
}
export function taskVisual(t:CanonicalTask):VisualSpec|undefined {
 const n=(v:string)=>toNumber(p(v));
 if(t.kind==='fraction') return {kind:'fraction',numerator:t.numerator,denominator:t.denominator};
 if(t.kind==='placeValue') return {kind:'placeValue',value:t.value};
 if(t.kind==='arithmetic'&&t.operation==='multiply'&&p(t.left).d===1n&&p(t.right).d===1n&&n(t.left)>0&&n(t.right)>0&&n(t.left)<=12&&n(t.right)<=12) return {kind:'array',rows:n(t.left),columns:n(t.right)};
 if(t.kind==='compare'&&Math.max(Math.abs(n(t.left)),Math.abs(n(t.right)))<=20) return {kind:'numberLine',min:Math.min(0,Math.floor(n(t.left)),Math.floor(n(t.right))),max:Math.max(1,Math.ceil(n(t.left)),Math.ceil(n(t.right))),step:1,marks:[n(t.left),n(t.right)]};
 if(t.kind==='slope'&&[t.x1,t.y1,t.x2,t.y2].every(v=>Math.abs(n(v))<=20)) return {kind:'coordinate',points:[{x:n(t.x1),y:n(t.y1),label:'A'},{x:n(t.x2),y:n(t.y2),label:'B'}]};
 if(t.kind==='measure'&&t.shape==='rectangle') return {kind:'rectangle',width:n(t.width),height:n(t.height)};
 if(t.kind==='measure'&&t.shape==='cuboid') return {kind:'cuboid',width:n(t.width),height:n(t.height),depth:n(t.depth)};
 return undefined;
}
/** Kinds whose canonical answer can be negative once negative inputs are allowed. The rest are
 * nonnegative by construction (counts, lengths, probabilities, digits) or are graded as symbols. */
const signedKinds:ReadonlySet<CanonicalTask['kind']>=new Set(['arithmetic','round','sequence','linear','power','statistics','percent','slope','evaluate']);
/** Whether a task's answer DOMAIN admits negatives, so the UI offers a sign key. It depends on the kind
 * and skill only, never on this task's answer, so the key never hints at the answer's sign.
 * taskFitsSkill keeps K–5 values and answers nonnegative; linear/slope/evaluate start at grade 6+.
 * K–5 skills use no array-valued kinds (statistics/evaluate), whose entries that check does not inspect. */
export function answerCanBeNegative(t:CanonicalTask,s?:Skill):boolean {
 if(!signedKinds.has(t.kind)) return false;
 if(s?.grade===6&&s.domain==='NS'&&t.kind==='arithmetic') return false; // taskFitsSkill keeps 6.NS operands nonnegative
 return !s||s.grade!=='K'&&s.grade>=6;
}
/** Topic constraints stop a model laundering an unrelated easy task into advanced evidence. */
export function taskFitsSkill(t:CanonicalTask,s:Skill):boolean {
 if(!s.taskKinds.includes(t.kind)) return false;
 const grade=s.grade==='K'?0:s.grade;
 const values=Object.values(t).filter((v):v is string=>typeof v==='string'&&/^-?\d/.test(v)).map(v=>p(v));
 const nonnegative=values.every(v=>v.n>=0n), integers=values.every(v=>v.d===1n);
 if(grade<=5&&!nonnegative) return false;
 if(t.kind==='arithmetic') {
  const a=p(t.left),b=p(t.right),answer=p(expectedAnswer(t)); const max=(bound:number)=>[a,b,answer].every(v=>Math.abs(toNumber(v))<=bound); const op=t.operation;
  if(grade<=5&&answer.n<0n) return false;
  if(s.domain==='OA'||s.domain==='NBT'&&grade<=4) {
   if(!integers||answer.d!==1n) return false;
  }
  if(['K.OA.A.5','1.OA.C.6','2.OA.B.2','1.NBT.C.4','1.NBT.C.5','1.NBT.C.6','2.NBT.B.5','2.NBT.B.7','2.NBT.B.8','3.NBT.A.2','4.NBT.B.4'].includes(s.id)) {
   if(!['add','subtract'].includes(op)) return false;
   const cap=s.id==='K.OA.A.5'?5:['1.OA.C.6','2.OA.B.2'].includes(s.id)?20:grade===1||s.id==='2.NBT.B.5'?100:grade<=3?1000:1000000;
   if(!max(cap)) return false;
   if(s.id==='1.NBT.C.5'&&b.n!==10n) return false;
   if(s.id==='1.NBT.C.6'&&(a.n%10n!==0n||b.n%10n!==0n||op!=='subtract')) return false;
   if(s.id==='2.NBT.B.8'&&b.n!==10n&&b.n!==100n) return false;
  }
  if(['2.OA.C.4','3.OA.A.1'].includes(s.id)&&(op!=='multiply'||!max(100)||toNumber(a)>(grade===2?5:10)||toNumber(b)>(grade===2?5:10))) return false;
  if(s.id==='3.OA.A.2'&&(op!=='divide'||!max(100)||toNumber(b)>10)) return false;
  if(s.id==='3.OA.C.7'&&(!['multiply','divide'].includes(op)||!max(100)||(op==='multiply'&&(toNumber(a)>9||toNumber(b)>9))||(op==='divide'&&(toNumber(b)>9||toNumber(answer)>9)))) return false;
  if(s.id==='3.NBT.A.3'&&(op!=='multiply'||a.n>9n||b.n%10n!==0n||b.n>90n)) return false;
  if(['4.NBT.B.5','5.NBT.B.5'].includes(s.id)&&op!=='multiply') return false;
  if(['4.NBT.B.6','5.NBT.B.6','6.NS.B.2'].includes(s.id)&&(op!=='divide'||!integers||answer.d!==1n)) return false;
  if(s.id==='4.NF.B.3'&&(!['add','subtract'].includes(op)||a.d!==b.d||a.d===1n)) return false;
  if(s.id==='4.NF.B.4'&&(op!=='multiply'||a.d===1n||b.d!==1n)) return false;
  if(s.id==='4.NF.C.5'&&(op!=='add'||a.d===1n&&b.d===1n||![1n,2n,4n,5n,10n,20n,25n,50n,100n].includes(a.d)||![1n,2n,4n,5n,10n,20n,25n,50n,100n].includes(b.d))) return false;
  if(s.id==='5.NF.A.1'&&(!['add','subtract'].includes(op)||a.d===b.d)) return false;
  if(s.id==='5.NF.B.3'&&(op!=='divide'||!integers)) return false;
  if(s.id==='5.NF.B.4'&&(op!=='multiply'||a.d===1n&&b.d===1n)) return false;
  if(s.id==='5.NF.B.7'&&(op!=='divide'||!(a.n===1n&&a.d>1n&&b.d===1n||b.n===1n&&b.d>1n&&a.d===1n))) return false;
  if(s.id==='6.NS.A.1'&&(op!=='divide'||a.d===1n&&b.d===1n)) return false;
  if(grade===6&&s.domain==='NS'&&!nonnegative)return false;
  if(s.id==='4.NBT.B.5'&&!(a.n<=9999n&&b.n<=9n||a.n<=99n&&b.n<=99n))return false;
  if(s.id==='5.NBT.B.5'&&!integers)return false;
  if(s.id==='4.NBT.B.6'&&(a.n>9999n||b.n>9n))return false;
  if(s.id==='5.NBT.B.6'&&(a.n>9999n||b.n>99n))return false;
  if(['5.NBT.B.7','6.NS.B.3'].includes(s.id)&&(![a,b].every(v=>100n%v.d===0n)))return false;
  if(s.id==='7.NS.A.1'&&!['add','subtract'].includes(op)) return false;
  if(s.id==='7.NS.A.2'&&!['multiply','divide'].includes(op)) return false;
 }
 if(t.kind==='missing') {
  if(!integers||p(expectedAnswer(t)).d!==1n||p(expectedAnswer(t)).n<0n) return false;
  if(grade<=1&&(!['add','subtract'].includes(t.operation)||values.some(v=>v.n>20n))) return false;
  if(grade===3&&(!['multiply','divide'].includes(t.operation)||values.some(v=>v.n>100n))) return false;
 }
 if(t.kind==='fraction') {
  const den=grade<=1?[2,4]:grade===2?[2,3,4]:[2,3,4,6,8]; if(!den.includes(t.denominator)) return false;
 }
 if(t.kind==='compare') {
  if(grade<=2&&(!integers||values.some(v=>v.n>BigInt(grade===0?10:grade===1?99:999)))) return false;
  if(s.domain==='NBT'&&grade===4&&!integers) return false;
  if(s.domain==='NF') {
   const a=p(t.left),b=p(t.right);
   if(a.d===1n&&b.d===1n)return false;
   if(grade===3&&(a.n!==b.n&&a.d!==b.d))return false;
   if(s.id==='4.NF.C.7'&&(![a,b].every(v=>100n%v.d===0n)))return false;
  }
  if(s.id==='5.NBT.A.3'&&!values.every(v=>1000n%v.d===0n))return false;
 }
 if(t.kind==='placeValue'&&(t.value>(grade===0?19:grade===1?99:grade===2?999:999999)||t.place>(grade<=1?1:grade===2?2:5))) return false;
 if(t.kind==='round'&&grade<=4&&(!integers||p(t.place).n<10n)) return false;
 if(t.kind==='power'&&(grade<8&&t.exponent<0||grade===5&&t.base!=='10')) return false;
 if(t.kind==='sequence'&&(grade<=4&&!integers||grade===0&&(t.step!=='1'||toNumber(p(t.start))+t.count>100))) return false;
 if(t.kind==='sequence'&&s.id==='2.NBT.A.2'&&(!['5','10','100'].includes(t.step)||toNumber(p(t.start))+toNumber(p(t.step))*t.count>1000))return false;
 if(t.kind==='measure') {
  if(grade<=4&&(t.shape!=='rectangle'||!integers)) return false;
  if(['2.G.A.2','3.MD.C.6','3.MD.C.7'].includes(s.id)&&t.measure!=='area') return false;
  if(s.id==='3.MD.D.8'&&t.measure!=='perimeter') return false;
  if(grade===5&&(t.shape!=='cuboid'||t.measure!=='volume'||!integers)) return false;
  if(s.id==='6.G.A.1'&&t.shape==='cuboid') return false;
  if(s.id==='6.G.A.2'&&(t.shape!=='cuboid'||t.measure!=='volume')) return false;
  if(s.id==='6.G.A.4'&&(t.shape!=='cuboid'||t.measure!=='surfaceArea')) return false;
 }
 if(t.kind==='linear'&&grade===6&&(p(t.a).n<=0n||p(t.b).n<0n||p(t.c).n<0n||t.a!=='1'&&t.b!=='0')) return false;
 return true;
}
export function validateActivity(input:unknown,allowedSkillIds?:readonly string[]):ValidationResult {
 try {
  if(typeof input==='string') {if(input.length>32000) throw new Error('Activity is too large.'); input=JSON.parse(input);}
  if(!rec(input)) throw new Error('Activity must be an object.');
  const s=typeof input.skillId==='string'?getSkill(input.skillId):undefined;
  if(!s||s.coverage!=='verified-practice'||allowedSkillIds&&!allowedSkillIds.includes(s.id)) throw new Error('Choose an eligible, assessable skill.');
  if(input.version!==1) throw new Error('Unsupported activity version.');
  const id=typeof input.id==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(input.id)?input.id:undefined;
  if(!id) throw new Error('Activity needs a bounded stable identifier.');
  const mode=oneOf(input.mode,['concept','fluency','review']);
  if(mode==='fluency'&&!s.fluencyTargetMs) throw new Error('This skill has no timed fluency assessment.');
  const task=validateTask(input.task); if(!taskFitsSkill(task,s)) throw new Error('Task is outside the selected skill assessment.');
  const activity:Activity={version:1,id,skillId:s.id,source:'ai',mode,task,prompt:renderTask(task),variant:JSON.stringify(task)};
  for(const key of ['hint','explanation'] as const) if(input[key]!==undefined) {
   if(typeof input[key]!=='string'||input[key].length>1200) throw new Error('Teaching text is too long.'); activity[key]=input[key];
  }
  const visual=taskVisual(task); if(visual) activity.visual=visual;
  if(input.choices!==undefined) {
   if(mode==='fluency')throw new Error('Fluency requires recall, not answer choices.');
   if(!Array.isArray(input.choices)||input.choices.length<2||input.choices.length>5||input.choices.some(x=>typeof x!=='string'||x.length>80)) throw new Error('Choose 2–5 short numeric options.');
   const choices=input.choices.map((x:string)=>task.kind==='compare'?oneOf(x,['<','=','>']):fmt(p(x)));
   if(new Set(choices).size!==choices.length||choices.filter(x=>x===expectedAnswer(task)).length!==1) throw new Error('Choices need distinct values and exactly one correct answer.');
   activity.choices=choices;
  }
  return {ok:true,activity};
 } catch(e) {return {ok:false,errors:[e instanceof Error?e.message:'Invalid activity.']};}
}
export function gradeAnswer(activity:Activity,answer:string):GradeResult {
 const checked=validateActivity(activity);
 if(!checked.ok) return {correct:false,expected:'',error:checked.errors.join(' ')};
 const expected=expectedAnswer(checked.activity.task);
 try { const normalizedAnswer=checked.activity.task.kind==='compare'?oneOf(answer.trim(),['<','=','>']):fmt(p(answer)); return {correct:expected===normalizedAnswer,expected,normalizedAnswer}; }
 catch(e) {return {correct:false,expected,error:e instanceof Error?e.message:'Invalid answer.'};}
}
