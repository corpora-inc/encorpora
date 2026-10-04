import type { Activity, CanonicalTask, LearnerState } from './types';
import { getSkill } from './curriculum';
import { validateActivity } from './tasks';
import { teachTask } from './teaching';
/** Reproducible varied practice, not a substitute for live AI explanations. */
export function generatePractice(skillId:string,seed:number=Date.now(),mode:Activity['mode']='concept'):Activity {
 const skill=getSkill(skillId); if(!skill||!skill.taskKinds.length) throw new Error(`No verified practice generator for ${skillId}.`);
 if(!Number.isSafeInteger(seed)) throw new Error('Practice seed must be a safe integer.');
 let state=(seed>>>0)||1;
 state=Math.imul(state^(state>>>16),0x45d9f3b);state=Math.imul(state^(state>>>16),0x45d9f3b);state=(state^(state>>>16))>>>0;
 const rand=(min:number,max:number)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return min+Math.floor(state/4294967296*(max-min+1));};
 const pick=<T>(xs:readonly T[])=>xs[rand(0,xs.length-1)];
 const s=String;
 const grade=skill.grade==='K'?0:skill.grade;
 const a=rand(2,9),b=rand(2,9), denominator=pick([3,5,7]);
 let task:CanonicalTask;
 switch(skillId) {
  case 'K.OA.A.5': {const x=rand(0,3),y=rand(0,5-x);task={kind:'arithmetic',operation:'add',left:s(x),right:s(y)};break;}
  case '1.OA.C.6': case '2.OA.B.2': {const op=pick(['add','subtract'] as const);task={kind:'arithmetic',operation:op,left:s(op==='add'?a:a+b),right:s(b)};break;}
  case '1.NBT.C.4': {const x=rand(1,7)*10+a;task={kind:'arithmetic',operation:'add',left:s(x),right:s(b)};break;}
  case '1.NBT.C.5': task={kind:'arithmetic',operation:pick(['add','subtract']),left:s(rand(2,8)*10+a),right:'10'};break;
  case '1.NBT.C.6': task={kind:'arithmetic',operation:'subtract',left:s(Math.max(a,b)*10),right:s(Math.min(a,b)*10)};break;
  case '2.NBT.B.5': {const x=rand(10,60),y=rand(10,39);task={kind:'arithmetic',operation:'add',left:s(x),right:s(y)};break;}
  case '2.NBT.B.7': case '3.NBT.A.2': {const x=rand(100,500),y=rand(100,499);task={kind:'arithmetic',operation:'add',left:s(x),right:s(y)};break;}
  case '2.NBT.B.8': task={kind:'arithmetic',operation:pick(['add','subtract']),left:s(rand(2,8)*100),right:pick(['10','100'])};break;
  case '2.OA.C.4': task={kind:'arithmetic',operation:'multiply',left:s(rand(1,5)),right:s(rand(1,5))};break;
  case '3.OA.A.1': task={kind:'arithmetic',operation:'multiply',left:s(a),right:s(b)};break;
  case '3.OA.A.2': task={kind:'arithmetic',operation:'divide',left:s(a*b),right:s(b)};break;
  case '3.OA.C.7': {const op=pick(['multiply','divide'] as const);task={kind:'arithmetic',operation:op,left:s(op==='multiply'?a:a*b),right:s(b)};break;}
  case '1.OA.B.4': case '1.OA.D.8': task={kind:'missing',operation:'add',left:s(a),result:s(a+b)};break;
  case '3.OA.A.4': case '3.OA.B.6': task={kind:'missing',operation:'multiply',left:s(a),result:s(a*b)};break;
  case '3.NBT.A.3': task={kind:'arithmetic',operation:'multiply',left:s(a),right:s(b*10)};break;
  case '4.NBT.B.4': task={kind:'arithmetic',operation:'add',left:s(rand(1000,40000)),right:s(rand(1000,40000))};break;
  case '4.NBT.B.5': case '5.NBT.B.5': task={kind:'arithmetic',operation:'multiply',left:s(rand(12,99)),right:s(grade===4?b:rand(12,99))};break;
  case '4.NBT.B.6': case '5.NBT.B.6': case '6.NS.B.2': {const divisor=grade===4?b:rand(12,40);task={kind:'arithmetic',operation:'divide',left:s(rand(12,99)*divisor),right:s(divisor)};break;}
  case '4.NF.B.3': {const x=rand(1,denominator-1);task={kind:'arithmetic',operation:'add',left:`${x}/${denominator}`,right:`1/${denominator}`};break;}
  case '4.NF.B.4': task={kind:'arithmetic',operation:'multiply',left:`1/${denominator}`,right:s(b)};break;
  case '4.NF.C.5': task={kind:'arithmetic',operation:'add',left:`${a}/10`,right:`${b}/100`};break;
  case '5.NBT.B.7': case '6.NS.B.3': task={kind:'arithmetic',operation:pick(['add','multiply']),left:`${a}.${rand(1,99).toString().padStart(2,'0')}`,right:`${b}.2`};break;
  case '5.NF.A.1': task={kind:'arithmetic',operation:'add',left:`${rand(1,denominator-1)}/${denominator}`,right:'1/2'};break;
  case '5.NF.B.3': task={kind:'arithmetic',operation:'divide',left:s(a),right:s(b)};break;
  case '5.NF.B.4': task={kind:'arithmetic',operation:'multiply',left:`1/${denominator}`,right:`${a}/2`};break;
  case '5.NF.B.7': task={kind:'arithmetic',operation:'divide',left:`1/${denominator}`,right:s(b)};break;
  case '6.NS.A.1': task={kind:'arithmetic',operation:'divide',left:`1/${denominator}`,right:`${b}/2`};break;
  case '7.NS.A.1': task={kind:'arithmetic',operation:pick(['add','subtract']),left:`-${a}/${denominator}`,right:`${b}/2`};break;
  case '7.NS.A.2': task={kind:'arithmetic',operation:pick(['multiply','divide']),left:`-${a}/${denominator}`,right:`${b}/2`};break;
  default: {
   const kind=pick(skill.taskKinds);
   switch(kind) {
    case 'compare': if(skillId==='4.NF.A.2'){task={kind,left:`1/${pick([3,5,8])}`,right:`${b}/2`};break;} if(skillId==='4.NF.C.7'){task={kind,left:`${a}/10`,right:`${b}/100`};break;} if(skillId==='3.NF.A.3'){task={kind,left:`1/${pick([2,3,4,6,8])}`,right:`1/${pick([2,3,4,6,8])}`};break;} task={kind,left:skill.domain==='NF'?`${a}/${denominator}`:grade>=5?`${rand(-9,9)}.25`:s(rand(0,grade===0?10:grade===1?99:grade===2?999:99999)),right:skill.domain==='NF'?`${b}/2`:grade>=5?`${rand(-9,9)}.5`:s(rand(0,grade===0?10:grade===1?99:grade===2?999:99999))};if(grade===5){task.left=task.left.replace('-','');task.right=task.right.replace('-','');}break;
    case 'fraction': {const d=pick(grade<=1?[2,4]:grade===2?[2,3,4]:[2,3,4,6,8]);task={kind,numerator:rand(1,d-1),denominator:d};break;}
    case 'placeValue': task={kind,value:rand(grade===0?11:grade===1?10:grade===2?100:1000,grade===0?19:grade===1?99:grade===2?999:99999),place:rand(0,grade<=1?1:grade===2?2:4)};break;
    case 'round': task={kind,value:grade>=5?`${rand(1,99)}.${rand(11,99)}`:s(rand(100,999)),place:grade>=5?'1/10':pick(['10','100'])};break;
    case 'sequence': task={kind,start:s(rand(0,20)),step:grade===0?'1':s(pick(skillId==='2.NBT.A.2'?[5,10,100]:[2,5,10])),count:4};break;
    case 'measure': {
     if(grade>=5&&skillId!=='6.G.A.1')task={kind,shape:'cuboid',measure:skillId==='6.G.A.4'?'surfaceArea':'volume',width:s(a),height:s(b),depth:grade===6?'3/2':s(rand(2,6))};
     else if(skillId==='6.G.A.1')task={kind,shape:'triangle',measure:'area',width:s(a),height:s(b)};
     else task={kind,shape:'rectangle',measure:skillId==='3.MD.D.8'?'perimeter':'area',width:s(a),height:s(b)};break;
    }
    case 'power': task={kind,base:grade===5?'10':s(a),exponent:grade===8?pick([-2,-1,2,3]):rand(2,6)};break;
    case 'linear': {const coefficient=grade===6?1:a,offset=b;task={kind,a:s(coefficient),b:s(offset),c:s(coefficient*rand(2,9)+offset)};break;}
    case 'factors': task={kind,operation:pick(['gcd','lcm']),left:a*2,right:b*2};break;
    case 'statistics': task={kind,operation:pick(['mean','median','range']),values:[s(a),s(b),s(rand(1,12)),s(rand(1,12))]};break;
    case 'rate': task={kind,quantity:grade>=7?`${a}/2`:s(a*b),units:grade>=7?'3/4':s(b)};break;
    case 'percent': task={kind,percent:s(pick([10,20,25,50,75])),whole:s(rand(2,20)*4)};break;
    case 'probability': task={kind,favorable:rand(1,5),total:6};break;
    case 'slope': task={kind,x1:'0',y1:s(a),x2:s(b),y2:s(a+b*rand(-3,3))};break;
    case 'pythagorean': {const triple=pick([[3,4],[5,12],[8,15],[7,24]]);task={kind,a:triple[0],b:triple[1]};break;}
    case 'evaluate': task={kind,coefficients:[s(a),s(b)],x:s(rand(2,9))};break;
    default: throw new Error(`Missing generator for ${skillId}.`);
   }
  }
 }
 const checked=validateActivity({version:1,id:`practice-${skillId}-${seed}`,skillId,mode,task});
 if(!checked.ok) throw new Error(`Invalid generated practice ${skillId}: ${checked.errors.join(' ')}`);
 return {...checked.activity,source:'local',...teachTask(checked.activity.task)};
}

/** Prefer a new representation of the skill, with bounded work even for tiny fact sets. */
export function generateFreshPractice(skillId:string,learner:LearnerState,seed:number=Date.now(),mode:Activity['mode']='concept'):Activity {
 const recent=learner.attempts.filter(a=>a.skillId===skillId).slice(-12).map(a=>a.variant);
 let fallback=generatePractice(skillId,seed,mode);
 let oldest=recent.lastIndexOf(fallback.variant);
 if(oldest<0)return fallback;
 for(let i=1;i<=48;i++) {
  const candidate=generatePractice(skillId,((seed>>>0)+i)>>>0,mode);
  const index=recent.lastIndexOf(candidate.variant);
  if(index<0)return candidate;
  if(index<oldest){fallback=candidate;oldest=index;}
 }
 // Some valid skills have fewer than twelve distinct tasks. Revisit the least recent one.
 return fallback;
}

/**
 * A solved example of the same skill on a different task, shown before the learner tries again
 * after repeated misses. It never solves the displayed task. Showing it is assistance: the caller
 * records the attempt as hinted, so independent evidence keeps its meaning.
 */
export function workedExampleHint(skillId:string,learner:LearnerState,seed:number,avoidVariant:string):string {
 let example=generateFreshPractice(skillId,learner,((seed>>>0)+7919)>>>0);
 for(let i=1;i<=24&&example.variant===avoidVariant;i++)example=generatePractice(skillId,((seed>>>0)+7919+i)>>>0);
 if(example.variant===avoidVariant)return example.hint??'Break the problem into smaller steps.';
 return `Here’s one worked out first: ${example.prompt}\n\n${example.explanation}\n\nNow try yours the same way.`.slice(0,1200);
}
