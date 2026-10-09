import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {config,DATA} from './config.mjs';import {makeServer,authenticate} from './protocol.mjs';
const cfg=config();process.env.ARKEMX_PROJECT_ID=cfg.projectId;
const {Store}=await import('./store.mjs');
const store=new Store(path.join(DATA,'live.sqlite'));
const mode=process.argv[2]??'stdio',role=process.argv[3]??'reader';
const make=principal=>makeServer(store,{getConfig:config,principal,evidenceFile:path.join(DATA,'evidence.json')});
if(mode==='stdio'){
 if(!['reader','writer'].includes(role))throw Error('INVALID_ROLE');
 await make(()=>role).connect(new StdioServerTransport());
}else if(mode==='http'){
 if(!Number.isInteger(cfg.port)||cfg.port<1024||cfg.port>65535)throw Error('INVALID_PORT');
 let active=0,count=0,window=Date.now();
 const listener=http.createServer(async(req,res)=>{
  const end=(status,error)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}));};
  let server,wire,acquired=false;
  try{
   if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==`127.0.0.1:${cfg.port}`||req.headers.origin)return end(403,'BOUNDARY_DENIED');
   if(req.url!=='/mcp')return end(404,'NOT_FOUND');
   const principal=c=>{if(req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()==='authorization').length!==1)throw Error('ACCESS_DENIED');return authenticate(req.headers.authorization,c);};
   try{principal(config());}catch{return end(401,'ACCESS_DENIED');}
   if(req.method!=='POST')return end(405,'METHOD_NOT_ALLOWED');
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')||req.headers['content-encoding'])return end(415,'JSON_REQUIRED');
   if(Date.now()-window>60000){window=Date.now();count=0;}if(++count>120||active>=4)return end(429,'LIMIT_EXCEEDED');
   active++;acquired=true;const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>32768)return end(413,'BODY_TOO_LARGE');chunks.push(b);}
   let rpc;try{rpc=JSON.parse(Buffer.concat(chunks));}catch{return end(400,'INVALID_JSON');}
   if(!rpc||Array.isArray(rpc)||rpc.jsonrpc!=='2.0'||!['initialize','notifications/initialized','ping','tools/list','tools/call'].includes(rpc.method))return end(400,'METHOD_NOT_ALLOWED');
   server=make(principal);wire=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
   await server.connect(wire);await wire.handleRequest(req,res,rpc);
  }catch{if(!res.headersSent)end(503,'SERVICE_UNAVAILABLE');else res.destroy();}
  finally{if(server)await server.close().catch(()=>{});if(wire)await wire.close().catch(()=>{});if(acquired)active--;}
 });
 listener.requestTimeout=15000;listener.headersTimeout=10000;
 await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(cfg.port,'127.0.0.1',resolve);});
 console.error('MCP listening on loopback; credential required. No public URL or tunnel created.');
}else throw Error('Usage: node src/server.mjs stdio [reader|writer] OR http');
