import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import net from 'node:net';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import http from 'node:http';import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const projectId='DEMO-PROJECT';
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arkemx-kit-test-'));const cfg={projectId,actor:'test-owner',writesEnabled:false,port:43200,grants:['reader','writer'].map(role=>({role,enabled:true,expiresAt:new Date(Date.now()+86400000).toISOString(),token:crypto.randomBytes(32).toString('base64url')}))};const save=()=>fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify(cfg));save();fs.copyFileSync(path.join(root,'examples/evidence.json'),path.join(dir,'evidence.json'));return {dir,cfg,save};}
const makeClient=()=>new Client({name:'kit-test',version:'1.0.0'},{capabilities:{}});
const env=dir=>({...process.env,ARKEMX_DATA_DIR:dir});
test('Real STDIO: reader discovery, example evidence, project isolation and write denial',async()=>{
 const f=fixture(),client=makeClient();
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs'),'stdio','reader'],env:env(f.dir),stderr:'pipe'}));
  assert.equal((await client.listTools()).tools.length,4);
  const status=await client.callTool({name:'arkemx_read_project_status',arguments:{projectId}});assert.equal(status.structuredContent.provenance.kind,'example-only');assert.equal(status.structuredContent.data.status,'not_verified');
  const list=await client.callTool({name:'arkemx_list_evidence',arguments:{projectId}});assert.equal(list.structuredContent.data.length,1);
  const evidence=await client.callTool({name:'arkemx_read_test_evidence',arguments:{projectId,evidenceId:'EXAMPLE-01'}});assert.equal(evidence.structuredContent.data.result,'not_run');
  const denied=await client.callTool({name:'arkemx_create_task',arguments:{projectId,requestId:crypto.randomUUID(),description:'test',status:'open'}});assert.equal(denied.structuredContent.error.code,'WRITE_DENIED');
  const other=await client.callTool({name:'arkemx_read_project_status',arguments:{projectId:'OTHER'}});assert.equal(other.structuredContent.error.code,'INVALID_INPUT');
 }finally{await client.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('Real STDIO: writer policy, create, retry, revision conflict and live listing',async()=>{
 const f=fixture(),client=makeClient();
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs'),'stdio','writer'],env:env(f.dir),stderr:'pipe'}));
  assert.equal((await client.listTools()).tools.length,4);f.cfg.writesEnabled=true;f.save();assert.equal((await client.listTools()).tools.length,7);
  const args={projectId,requestId:crypto.randomUUID(),description:'Test task',status:'open'};
  const first=(await client.callTool({name:'arkemx_create_task',arguments:args})).structuredContent;
  const second=(await client.callTool({name:'arkemx_create_task',arguments:args})).structuredContent;
  assert.equal(first.status,'ok');assert.equal(first.record.assignee,null);assert.equal(second.replayed,true);assert.equal(second.record.id,first.record.id);
  const update={projectId,requestId:crypto.randomUUID(),taskId:first.record.id,expectedRevision:1,status:'done'};
  assert.equal((await client.callTool({name:'arkemx_update_task',arguments:update})).structuredContent.record.revision,2);
  assert.equal((await client.callTool({name:'arkemx_update_task',arguments:{...update,requestId:crypto.randomUUID()}})).structuredContent.error.code,'REVISION_CONFLICT');
  const list=(await client.callTool({name:'arkemx_list_live_records',arguments:{projectId}})).structuredContent;assert.equal(list.items.length,1);assert.equal(list.provenance.technicalApproval,false);
  f.cfg.writesEnabled=false;f.save();assert.equal((await client.callTool({name:'arkemx_create_task',arguments:args})).structuredContent.error.code,'WRITE_DENIED');
 }finally{await client.close();fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('Real HTTP: authentication, host/origin boundaries, reader and writer separation, revocation',async()=>{
 const f=fixture();const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));f.cfg.port=reserve.address().port;await new Promise(r=>reserve.close(r));f.cfg.writesEnabled=true;f.save();
 const child=spawn(process.execPath,[path.join(root,'src/server.mjs'),'http'],{env:env(f.dir),stdio:['ignore','ignore','pipe']});
 const url=new URL(`http://127.0.0.1:${f.cfg.port}/mcp`);const clients=[];
 try{
  let ready=false;const until=Date.now()+10000;while(Date.now()<until){try{if((await fetch(url,{method:'POST'})).status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,'HTTP service startup');
  const token=role=>'Bearer '+f.cfg.grants.find(g=>g.role===role).token;
  const rpc={jsonrpc:'2.0',id:1,method:'tools/list'};
  const post=(headers,body=rpc)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body:JSON.stringify(body)});
  assert.equal((await post({Authorization:'Bearer wrong'})).status,401);
  assert.equal((await post({Authorization:token('writer'),Origin:'https://untrusted.example'})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{const req=http.request(url,{method:'POST',headers:{Host:'evil.example',Authorization:token('writer'),'Content-Type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end(JSON.stringify(rpc));});assert.equal(wrongHost,403);
  const reader=makeClient();clients.push(reader);await reader.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:token('reader')}}}));assert.equal((await reader.listTools()).tools.length,4);
  const args={projectId,requestId:crypto.randomUUID(),description:'HTTP test',status:'open'};assert.equal((await reader.callTool({name:'arkemx_create_task',arguments:args})).structuredContent.error.code,'WRITE_DENIED');
  const writer=makeClient();clients.push(writer);await writer.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:token('writer')}}}));assert.equal((await writer.listTools()).tools.length,7);
  assert.equal((await writer.callTool({name:'arkemx_create_task',arguments:args})).structuredContent.status,'ok');assert.equal((await writer.callTool({name:'arkemx_create_task',arguments:args})).structuredContent.replayed,true);
  assert.equal((await writer.callTool({name:'arkemx_list_live_records',arguments:{projectId}})).structuredContent.items.length,1);
  f.cfg.grants.find(g=>g.role==='writer').enabled=false;f.save();assert.equal((await post({Authorization:token('writer')})).status,401);
  f.cfg.grants.find(g=>g.role==='reader').expiresAt='2000-01-01T00:00:00Z';f.save();assert.equal((await post({Authorization:token('reader')})).status,401);
 }finally{for(const c of clients)await c.close().catch(()=>{});child.kill();await new Promise(r=>child.once('exit',r));fs.rmSync(f.dir,{recursive:true,force:true});}
});
