import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const DATA=process.env.ARKEMX_DATA_DIR ? path.resolve(process.env.ARKEMX_DATA_DIR) : path.join(ROOT,'.local');
export function config(){
 let value;
 try {value=JSON.parse(fs.readFileSync(path.join(DATA,'config.json'),'utf8'));} catch {throw Error('INVALID_CONFIG');}
 if (!/^[A-Za-z0-9_-]{1,100}$/.test(value.projectId)||typeof value.actor!=='string'||!value.actor||!Array.isArray(value.grants)) throw Error('INVALID_CONFIG');
 return value;
}
