import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function tests(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?tests(join(dir,e.name)):/\.test\.tsx?$/.test(e.name)?[join(dir,e.name)]:[]); }
const files=tests('src');
if(!files.length){console.log('Foundation contains no testable domain behavior yet.');process.exit(0);}
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit'});
process.exit(result.status??1);

