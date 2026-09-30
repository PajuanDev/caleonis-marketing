// Loopback-only UI fixture. It never replaces the application's actual authentication.
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
if(process.env.CALEONIS_STUDIO_FIXTURE!=='isolated' || ['DATABASE_URL','JWT_SECRET','OPENAI_API_KEY','FREEPIK_API_KEY','GEMINI_API_KEY','AI_GATEWAY_API_KEY'].some(key=>process.env[key]))throw new Error('Fixture requires isolation and no production credentials');
const root=path.resolve(process.argv[2]);
const projectId='11111111-1111-4111-8111-111111111111';
let project={id:projectId,kind:'project',title:'Lancement produit — démonstration technique',revision:1,data:{prompt:'',mode:'image',referenceIds:[],campaignId:'',connectionId:'',engine:'native',quality:'medium'}};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4318');
  if(url.pathname.startsWith('/fixture-api/')){
   res.setHeader('Content-Type','application/json');
   const endpoint=url.pathname.slice('/fixture-api'.length);
   if(endpoint===`/workspace/documents/${projectId}`){
    if(req.method==='PUT'){
     let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>60000){res.writeHead(413);res.end('{}');return;}}
     const body=JSON.parse(raw);if(body.revision!==project.revision){res.writeHead(409);res.end('{}');return;}
     project={...project,...body,revision:project.revision+1};
    }
    res.end(JSON.stringify(project));return;
   }
   if(endpoint===`/workspace/projects/${projectId}/runs`){res.end('[]');return;}
   if(endpoint==='/workspace/media'){res.end(JSON.stringify([{id:'22222222-2222-4222-8222-222222222222',name:'Référence produit — donnée de test',path:'/fixture-product.svg',type:'image'}]));return;}
   res.writeHead(404);res.end('{}');return;
  }
  if(url.pathname==='/fixture-product.svg'){
   res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#232520"/><rect x="165" y="60" width="70" height="180" rx="12" fill="#b9cb92"/><text x="200" y="150" text-anchor="middle" font-size="12">TEST</text></svg>');return;
  }
  const filename=url.pathname.startsWith('/caleonis-studio/')?url.pathname.slice('/caleonis-studio/'.length):url.pathname.slice(1);
  if(!['index.html','studio.js','studio.css','build-info.json','UPSTREAM_LICENSE.txt','fixture-host.html','fixture-host.js'].includes(filename)){res.writeHead(404);res.end();return;}
  const mime={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',txt:'text/plain'};
  res.writeHead(200,{'Content-Type':mime[filename.split('.').pop()]||'application/octet-stream'});res.end(await readFile(path.join(root,filename)));
 }catch{res.writeHead(500);res.end('Fixture failed');}
});
server.listen(4318,'127.0.0.1',()=>console.log('Isolated UI fixture ready on loopback; no provider requests'));
process.on('SIGTERM',()=>server.close());process.on('SIGINT',()=>server.close());
