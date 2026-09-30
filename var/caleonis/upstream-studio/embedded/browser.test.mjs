// Real compiled Open-Higgsfield UI + real Caléonis host, fixture backend only.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
if (process.env.CALEONIS_STUDIO_FIXTURE !== 'isolated') throw new Error('Isolated browser tests only');
const {chromium, expect}=createRequire('/tmp/caleonis-embedded-browser/package.json')('@playwright/test');
const output='/tmp/caleonis-embedded-evidence';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const failures=[],external=[],purchases=[],writes=[];
page.on('pageerror',err=>failures.push(err.message));
page.on('dialog',dialog=>dialog.accept());
page.on('request',request=>{if(request.method()==='PUT')writes.push(request.postDataJSON());if(/\/api\/generate|\/runs$/.test(new URL(request.url()).pathname)&&request.method()==='POST')purchases.push(request.url());});
await page.route('**/*',route=>{
 const url=new URL(route.request().url());
 if (!['http:','https:'].includes(url.protocol) || url.hostname==='127.0.0.1')return route.continue();
 external.push(url.origin);return route.abort();
});
const host='http://127.0.0.1:4318/fixture-host.html';
const frame=page.frameLocator('iframe[title="Studio créatif — Caléonis Marketing"]');
const text=frame.locator('textarea');
const save=frame.getByRole('button',{name:'Enregistrer le projet',exact:true});
try {
 await page.goto(host);await expect(text).toBeVisible();
 await expect(text).toHaveAttribute('placeholder',/image/);
 await expect(frame.getByRole('button',{name:/Générer/})).toBeDisabled();
 await text.fill('Campagne test : préserver le produit et son identité.');
 await frame.getByRole('button',{name:'1k',exact:true}).click();
 await frame.getByRole('button',{name:'2k',exact:true}).click();
 await frame.getByRole('button',{name:'Médiathèque',exact:true}).click();
 const reference=frame.getByRole('checkbox',{name:'Référence produit — donnée de test',exact:true});
 await reference.check();await expect(reference).toBeChecked();
 await page.screenshot({path:`${output}/shared-media.png`,fullPage:true});
 await frame.getByRole('button',{name:'Terminer',exact:true}).click();
 await expect(save).toBeEnabled();await save.click();
 await expect(frame.getByRole('status')).toContainText('Version 2 enregistrée');
 assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].data.studioSettings).sizeResolution,'2k');
 assert.deepEqual(writes[0].data.referenceIds,['22222222-2222-4222-8222-222222222222']);
 await page.screenshot({path:`${output}/image-studio.png`,fullPage:true});
 await page.reload();await expect(text).toHaveValue('Campagne test : préserver le produit et son identité.');
 await expect(frame.getByRole('button',{name:'2k',exact:true})).toBeVisible();
 await frame.getByRole('button',{name:'Médiathèque',exact:true}).click();await expect(reference).toBeChecked();
 await frame.getByRole('button',{name:'Terminer',exact:true}).click();await expect(save).toBeDisabled();
 await frame.getByRole('button',{name:'Vidéo',exact:true}).click();await expect(text).toHaveAttribute('placeholder',/vidéo/);
 await save.click();await expect(frame.getByRole('status')).toContainText('Version 3 enregistrée');
 await page.reload();await expect(text).toHaveAttribute('placeholder',/vidéo/);await expect(save).toBeDisabled();
 await expect(frame.getByRole('button',{name:/Générer/})).toBeDisabled();
 await page.screenshot({path:`${output}/video-studio.png`,fullPage:true});
 // Fail closed when the parent host's normal API request loses its session.
 await page.route('**/fixture-api/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{}'}));
 await page.reload();await expect(frame.getByRole('alert')).toContainText('Accès refusé');
 await expect(text).toHaveCount(0);await page.screenshot({path:`${output}/denied-session.png`,fullPage:true});
 await page.unroute('**/fixture-api/**');
 // Direct static document has no data authority and cannot initialize a project.
 await page.goto('http://127.0.0.1:4318/caleonis-studio/index.html');
 await expect(page.getByRole('alert')).toContainText('Ouvrez le studio depuis Médias');
 assert.equal(purchases.length,0);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
 const report={originalInterface:true,realHostComponent:true,fixtureBackend:true,imageAndVideoModes:true,briefRestored:true,resolutionRestored:true,referenceIdsRestored:true,modeRestored:true,deniedSessionClosed:true,directDocumentClosed:true,generationRequests:0,externalRequests:0,javascriptErrors:0,writeRequests:writes.length,productionModified:false,realProviderTest:false,userAcceptanceTest:false};
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} catch(error) {
 await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});
 await writeFile(`${output}/failure.json`,JSON.stringify({error:String(error),failures,external,purchases,writes},null,2));throw error;
} finally {await browser.close();}
