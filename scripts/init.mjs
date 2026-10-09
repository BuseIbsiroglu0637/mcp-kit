import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {ROOT,DATA} from '../src/config.mjs';
const projectId=process.argv[2];
if(!/^[A-Za-z0-9_-]{1,100}$/.test(projectId??'')) throw Error('Usage: npm run init -- YOUR-PROJECT-ID (letters, digits, underscore or hyphen)');
fs.mkdirSync(DATA,{recursive:true,mode:0o700});
if(fs.lstatSync(DATA).isSymbolicLink()) throw Error('UNSAFE_DATA_DIRECTORY');
if(fs.existsSync(path.join(DATA,'config.json'))) throw Error('Already initialized; refusing to overwrite existing settings or data.');
if(process.platform==='win32'){
 const sid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-[\d-]+/)?.[0];
 if(!sid) throw Error('Owner SID unavailable');
 execFileSync('icacls',[DATA,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F'],{stdio:'pipe'});
}
const expiresAt=new Date(Date.now()+6*86400000).toISOString();
const grants=['reader','writer'].map(role=>({role,enabled:true,expiresAt,token:crypto.randomBytes(32).toString('base64url')}));
fs.writeFileSync(path.join(DATA,'evidence.json'),fs.readFileSync(path.join(ROOT,'examples/evidence.json')),{flag:'wx',mode:0o600});
fs.writeFileSync(path.join(DATA,'config.json'),JSON.stringify({projectId,actor:os.userInfo().username,writesEnabled:false,port:43200,grants},null,2)+'\n',{flag:'wx',mode:0o600});
console.log('Initialized your own project. Example evidence only. Writes disabled. Credentials are in private .local/config.json; never upload it.');
