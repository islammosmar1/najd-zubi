// Never include production probes in the default test command.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')&&!['live-access.test.mjs','wholesale-live.test.mjs'].includes(f)).sort().map(f=>'tests/'+f);
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit',cwd:new URL('../',import.meta.url)});
if(result.error)throw result.error;
process.exitCode=result.status??1;
