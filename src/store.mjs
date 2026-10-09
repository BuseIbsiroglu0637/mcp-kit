import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
export const PROJECT=process.env.ARKEMX_PROJECT_ID ?? 'DEMO-PROJECT'; // Configured record context, not engineering approval.
export const STATUSES=['open','in_progress','blocked','done','cancelled'];
export class RecordError extends Error {constructor(code){super(code);this.code=code;}}
const fail=(ok,code)=>{if(!ok)throw new RecordError(code);};
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
export const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function keys(args,allowed,required){fail(args&&typeof args==='object'&&!Array.isArray(args),'INVALID_INPUT');fail(Object.keys(args).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(args,k)),'INVALID_INPUT');}
export function validate(operation,a){
 const base=['projectId','requestId'];
 if(operation==='arkemx_create_decision'){
  keys(a,[...base,'title','rationale','decisionDate'],[...base,'title','rationale','decisionDate']);
  fail(text(a.title,200)&&text(a.rationale,8000)&&validDate(a.decisionDate),'INVALID_INPUT');
 }else if(operation==='arkemx_create_task'){
  keys(a,[...base,'description','status','assignee','dueDate'],[...base,'description','status']);
  fail(text(a.description,8000)&&STATUSES.includes(a.status),'INVALID_INPUT');
 }else if(operation==='arkemx_update_task'){
  keys(a,[...base,'taskId','expectedRevision','description','status','assignee','dueDate'],[...base,'taskId','expectedRevision']);
  fail(uuid(a.taskId)&&Number.isSafeInteger(a.expectedRevision)&&a.expectedRevision>0,'INVALID_INPUT');
  fail(['description','status','assignee','dueDate'].some(k=>Object.hasOwn(a,k)),'INVALID_INPUT');
  if(Object.hasOwn(a,'description'))fail(text(a.description,8000),'INVALID_INPUT');
  if(Object.hasOwn(a,'status'))fail(STATUSES.includes(a.status),'INVALID_INPUT');
 }else throw new RecordError('UNKNOWN_OPERATION');
 fail(a.projectId===PROJECT&&uuid(a.requestId),'INVALID_INPUT');
 if(Object.hasOwn(a,'assignee'))fail(a.assignee===null||text(a.assignee,200),'INVALID_INPUT');
 if(Object.hasOwn(a,'dueDate'))fail(a.dueDate===null||validDate(a.dueDate),'INVALID_INPUT');
}
export function checkedPath(file){
 const resolved=path.resolve(file);let p=resolved;
 while(true){let s;try{s=fs.lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}if(s)fail(!s.isSymbolicLink()&&(!s.isFile()||s.nlink===1),'UNSAFE_STORAGE_PATH');const parent=path.dirname(p);if(parent===p)break;p=parent;}
 fail(fs.realpathSync.native(path.dirname(resolved)).toLowerCase()===path.dirname(resolved).toLowerCase(),'UNSAFE_STORAGE_PATH');
 return resolved;
}
export class Store {
 constructor(file,{clock=()=>new Date().toISOString()}={}){
  this.file=checkedPath(file);this.clock=clock;
  for(const suffix of ['-wal','-shm','-journal'])if(fs.existsSync(this.file+suffix))checkedPath(this.file+suffix);
  this.db=new DatabaseSync(this.file);this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS meta(version INTEGER PRIMARY KEY CHECK(version=1)); INSERT OR IGNORE INTO meta VALUES(1);
   CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('decision','task')),revision INTEGER NOT NULL CHECK(revision>0),body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,actor TEXT NOT NULL,project_id TEXT,operation TEXT NOT NULL,request_hash TEXT,record_id TEXT,result TEXT NOT NULL,revision INTEGER,payload_hash TEXT);
   CREATE TABLE IF NOT EXISTS requests(actor TEXT NOT NULL,request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(actor,request_id));
   CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'append-only audit'); END;
   CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'append-only audit'); END;`);
  fail(this.db.prepare('PRAGMA quick_check').get().quick_check==='ok','DATABASE_INTEGRITY');
 }
 close(){this.db.close();}
 event(actor,project,operation,requestId,id,result,revision,payloadHash){
  this.db.prepare('INSERT INTO events(at,actor,project_id,operation,request_hash,record_id,result,revision,payload_hash) VALUES(?,?,?,?,?,?,?,?,?)').run(this.clock(),actor,project,operation,requestId?digest(requestId):null,id??null,result,revision??null,payloadHash??null);
 }
 deny(actor,operation,code){this.event(actor??'unidentified',null,operation,null,null,code,null,null);}
 mutate(operation,args,actor){
  fail(text(actor,200),'INVALID_ACTOR');validate(operation,args);
  // Normalize omitted nullable fields before hashing so identical retries remain identical.
  const normalized={...args};if(operation==='arkemx_create_task'){normalized.assignee??=null;normalized.dueDate??=null;}
  const payloadHash=digest(canonical({operation,args:normalized}));
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const previous=this.db.prepare('SELECT payload_hash,response FROM requests WHERE actor=? AND request_id=?').get(actor,args.requestId);
   if(previous){fail(previous.payload_hash===payloadHash,'IDEMPOTENCY_CONFLICT');const response=JSON.parse(previous.response);this.event(actor,args.projectId,operation,args.requestId,response.record.id,'replayed',response.record.revision,payloadHash);this.db.exec('COMMIT');return {...response,replayed:true};}
   let record;
   if(operation==='arkemx_update_task'){
    const row=this.db.prepare("SELECT body FROM records WHERE id=? AND project_id=? AND kind='task'").get(args.taskId,args.projectId);
    fail(row,'TASK_NOT_FOUND');record=JSON.parse(row.body);fail(record.revision===args.expectedRevision,'REVISION_CONFLICT');
    for(const k of ['description','status','assignee','dueDate'])if(Object.hasOwn(args,k))record[k]=args[k];
    record.revision++;record.updatedAt=this.clock();record.updatedBy=actor;
    this.db.prepare('UPDATE records SET revision=?,body=? WHERE id=?').run(record.revision,JSON.stringify(record),record.id);
   }else{
    record={id:crypto.randomUUID(),projectId:args.projectId,kind:operation==='arkemx_create_decision'?'decision':'task',revision:1,createdAt:this.clock(),createdBy:actor};
    if(record.kind==='decision')Object.assign(record,{title:args.title,rationale:args.rationale,decisionDate:args.decisionDate});
    else Object.assign(record,{description:args.description,status:args.status,assignee:normalized.assignee,dueDate:normalized.dueDate});
    this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?)').run(record.id,record.projectId,record.kind,record.revision,JSON.stringify(record));
   }
   const response={status:'ok',record,replayed:false};
   this.event(actor,args.projectId,operation,args.requestId,record.id,'committed',record.revision,payloadHash);
   this.db.prepare('INSERT INTO requests VALUES(?,?,?,?)').run(actor,args.requestId,payloadHash,JSON.stringify(response));
   this.db.exec('COMMIT');return response;
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 list(projectId,{after=0,limit=50}={}){
  fail(projectId===PROJECT&&Number.isSafeInteger(after)&&after>=0&&Number.isSafeInteger(limit)&&limit>0&&limit<=100,'INVALID_INPUT');
  const rows=this.db.prepare('SELECT rowid AS cursor,body FROM records WHERE project_id=? AND rowid>? ORDER BY rowid LIMIT ?').all(projectId,after,limit+1);
  const page=rows.slice(0,limit);return {status:'ok',provenance:{kind:'live-user-records',projectId,observedAt:this.clock(),frozenEvidence:false,technicalApproval:false},items:page.map(x=>JSON.parse(x.body)),nextCursor:rows.length>limit?page.at(-1).cursor:null};
 }
}
