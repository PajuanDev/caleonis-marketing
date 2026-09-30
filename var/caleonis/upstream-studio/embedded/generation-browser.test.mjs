// Actual upstream UI and host bridge; provider/network and backend are explicitly simulated.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
if(process.env.CALEONIS_STUDIO_FIXTURE!=='isolated')throw new Error('Isolated test only');
const {chromium,expect}=createRequire('/tmp/caleonis-embedded-browser/package.json')('@playwright/test');
const out='/tmp/caleonis-embedded-evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const projectId='11111111-1111-4111-8111-111111111111',runId='33333333-3333-4333-8333-333333333333';
const imageId='v1__ai__text_to_image__flux_2_pro';
let project={id:projectId,kind:'project',title:'Création contrôlée — données simulées',revision:1,data:{mode:'image',prompt:'Photo produit de démonstration.',referenceIds:[],campaignId:'',connectionId:'',engine:'native',quality:'medium',studioSettings:JSON.stringify({schemaVersion:1,imageModelId:imageId,videoModelId:'ltx-2-pro',videoVariantId:'1080p',sizeAspect:'16:9',sizeResolution:'1k',imageFieldValues:{},videoSettings:{duration:'6',fieldValues:{fps:'25',generate_audio:false}}})}};
let runs=[],submits=0,syncs=0,imports=0;const external=[],errors=[],unexpected=[];
page.on('pageerror',err=>errors.push(err.message));page.on('dialog',dialog=>dialog.accept());
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.hostname!=='127.0.0.1'){external.push(url.origin);return route.abort();}
 if(!url.pathname.startsWith('/fixture-api'))return route.continue();
 const endpoint=url.pathname.slice('/fixture-api'.length),method=req.method();
 const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(endpoint===`/workspace/documents/${projectId}`){
  if(method==='PUT'){const body=req.postDataJSON();assert.equal(body.revision,project.revision);project={...project,...body,revision:project.revision+1};}
  return respond(project);
 }
 if(endpoint==='/workspace/studio-capabilities')return respond({upstream:{enabled:true,configured:true,provider:'Magnific',models:[{id:imageId,kind:'image',label:'FLUX 2 Pro',maxReferences:4},{id:'ltx-2-pro',kind:'video',label:'LTX 2.0 Pro',maxReferences:1}]}});
 if(endpoint===`/workspace/projects/${projectId}/runs`){
  if(method==='POST'){
   const body=req.postDataJSON();assert.deepEqual(Object.keys(body).sort(),['clientRequestId','confirmPaidGeneration','revision','source']);assert.equal(body.source,'open-higgsfield-v1');assert.equal(body.confirmPaidGeneration,true);assert.equal(body.revision,project.revision);
   submits++;runs=[{id:runId,status:'queued',projectRevision:project.revision,createdAt:new Date().toISOString(),snapshot:{mode:project.data.mode,prompt:project.data.prompt,modelId:imageId}}];return respond(runs[0]);
  }return respond(runs);
 }
 if(endpoint===`/workspace/projects/${projectId}/runs/${runId}/sync`){assert.equal(method,'POST');syncs++;runs[0]={...runs[0],status:'completed'};return respond(runs[0]);}
 if(endpoint===`/workspace/projects/${projectId}/runs/${runId}/import`){assert.equal(method,'POST');imports++;runs[0]={...runs[0],media:{id:'44444444-4444-4444-8444-444444444444',name:'Résultat simulé',path:'/fixture-product.svg',type:'image'}};return respond(runs[0]);}
 if(endpoint==='/workspace/media')return respond([]);
 unexpected.push(endpoint);return respond({message:'Unexpected endpoint'},404);
});
const frame=page.frameLocator('iframe');
const generate=frame.getByRole('button',{name:/^Générer/});
try{
 await page.goto('http://127.0.0.1:4318/fixture-host.html');
 await expect(frame.locator('textarea')).toBeVisible();await expect(generate).toBeEnabled();
 await generate.click();const confirm=frame.getByRole('button',{name:'Confirmer la génération payante',exact:true});
 await expect(frame.getByRole('heading',{name:'Confirmer cette création'})).toBeVisible();await expect(confirm).toBeDisabled();assert.equal(submits,0);
 await frame.getByRole('button',{name:'Annuler',exact:true}).click();assert.equal(submits,0);
 await frame.locator('textarea').fill('Photo produit corrigée avant approbation.');await expect(generate).toBeDisabled();
 await frame.getByRole('button',{name:'Enregistrer le projet',exact:true}).click();await expect(generate).toBeEnabled();
 await generate.click();await expect(confirm).toBeDisabled();
 await frame.getByRole('checkbox',{name:/J’autorise cet envoi/}).check();await expect(confirm).toBeEnabled();
 await page.screenshot({path:`${out}/generation-confirmation.png`,fullPage:true});
 await confirm.click();await expect(frame.getByRole('heading',{name:'Confirmer cette création'})).not.toBeVisible();
 assert.equal(submits,1);await expect(generate).toBeDisabled();
 await frame.locator('summary').filter({hasText:'Suivi des créations'}).click();
 await expect(frame.getByText(/En file chez le fournisseur/)).toBeVisible();
 await page.reload();await expect(frame.locator('textarea')).toBeVisible();await expect(generate).toBeDisabled();assert.equal(submits,1);
 await frame.locator('summary').filter({hasText:'Suivi des créations'}).click();
 await frame.getByRole('button',{name:'Actualiser',exact:true}).click();
 await expect(frame.getByRole('button',{name:'Importer dans Médias',exact:true})).toBeVisible();assert.equal(syncs,1);assert.equal(submits,1);
 await frame.getByRole('button',{name:'Importer dans Médias',exact:true}).click();await expect(frame.getByText(/Dans la médiathèque/)).toBeVisible();
 assert.equal(imports,1);assert.equal(submits,1);await expect(frame.getByRole('button',{name:'Importer dans Médias',exact:true})).not.toBeVisible();
 await page.screenshot({path:`${out}/generation-imported.png`,fullPage:true});
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await writeFile(`${out}/generation-report.json`,JSON.stringify({actualUpstreamUI:true,actualHostBridge:true,simulatedBackend:true,simulatedProvider:true,confirmationRequired:true,cancelWithoutSubmission:true,unsavedChangesBlock:true,reloadDoesNotResubmit:true,statusAndImport:true,submissions:submits,syncs,imports,externalRequests:external.length,javascriptErrors:errors.length,realGenerations:0,productionModified:false},null,2));
}catch(error){await page.screenshot({path:`${out}/generation-failure.png`,fullPage:true});await writeFile(`${out}/generation-failure.txt`,String(error)+'\n'+await page.locator('body').innerText()+'\n'+await frame.locator('body').innerText());throw error;}
finally{await browser.close();}
