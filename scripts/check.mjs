import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
for(const dir of ['public','services','netlify/functions']){
  for(const file of fs.readdirSync(new URL(dir+'/',root))){
    if(!/\.(m?js)$/.test(file))continue;
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(dir+'/'+file,root))],{encoding:'utf8'});
    if(result.status!==0){console.error(result.stderr);process.exit(1);}
  }
}
console.log('JavaScript syntax OK');
