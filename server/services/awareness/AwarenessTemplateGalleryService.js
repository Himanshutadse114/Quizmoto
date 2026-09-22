'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path'),JSZip=require('jszip'),sharp=require('sharp');
const logger=require('../../utils/logger');
const Central=require('../../models/scorm/ScormAwarenessLibraryTemplate');
const UserTemplate=require('../../models/scorm/ScormAwarenessUserTemplate');
const {Op}=require('sequelize');
const {getObjectStorage}=require('../../storage/ObjectStorage');
const MailService=require('../mail/MailService');
const Delivery=require('./AwarenessMailDeliveryService');

const MAX_ZIP_BYTES=35*1024*1024,MAX_HTML_BYTES=750*1024,MAX_IMAGE_BYTES=8*1024*1024,MAX_RECIPIENTS_PER_SEND=50;
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,ASSET_ID_RE=/^[a-z0-9-]{8,80}$/i,FORMATS=new Set(['jpeg','jpg','png','webp','gif']);
let schemaPromise=null,seedPromise=null;
const REF={
'educational-email-templete/data privacy/data-privacy-newsletter.html':['reference:data-privacy','Data Privacy Newsletter','Data Privacy','Warm editorial privacy newsletter with practical workplace behaviours.'],
'educational-email-templete/mobile app threat/mobile-app-threats.html':['reference:mobile-app-threats','Mobile App Threats','Mobile Security','High-attention mobile security briefing covering risky apps and mobile attacks.'],
'educational-email-templete/internet security/internet-security-best-practices.html':['reference:internet-security','Internet Security Best Practices','Internet Security','Everyday internet security habits in a practical illustrated guide.'],
'educational-email-templete/social media/social-media-threats.html':['reference:social-media','Social Media Threats','Social Media','Field briefing on social media exposure, impersonation and safer sharing.'],
'educational-email-templete/ransomware/ransomware.html':['reference:ransomware','Ransomware: Don’t Hand Over the Keys','Ransomware','Visual attack story showing how ransomware starts, spreads and should be reported.'],
'educational-email-templete/social engineering/social-engineering.html':['reference:social-engineering','Social Engineering: Trust Is the Target','Social Engineering','Human-risk playbook covering social engineering tactics and verification habits.'],
'educational-email-templete/mordern threats/email.html':['reference:modern-threats','Modern Threats','Phishing','Modern phishing dossier covering QR, meeting and verification lures.'],
'educational-email-templete/ai-scams-deepfakes/ai-scams-deepfakes.html':['reference:ai-scams-deepfakes','AI Scams & Deepfakes','AI Security','Campaign briefing on cloned voices, deepfakes and independent verification.']
};

function clean(v,n=1000){return String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}
function json(v,f){if(!v)return f;if(typeof v==='object')return v;try{return JSON.parse(v)}catch(_){return f}}
function token(){return crypto.randomBytes(32).toString('hex')}
function base(){return String(process.env.AWARENESS_ASSET_BASE_URL||process.env.PUBLIC_API_URL||process.env.RENDER_EXTERNAL_URL||MailService.appBaseUrl()).trim().replace(/\/$/,'')}
function assetUrl(scope,t,id){return base()+'/api/scorm/awareness-template-assets/'+encodeURIComponent(scope)+'/'+encodeURIComponent(t)+'/'+encodeURIComponent(id)}
function safePath(v){v=String(v||'').replace(/\\/g,'/').replace(/^\.\//,'');if(!v||v.includes('\0')||v.startsWith('/')||/^[a-z]:\//i.test(v))return'';v=path.posix.normalize(v);return(!v||v==='.'||v.startsWith('../')||v.includes('/../'))?'':v}
function pathKey(v){return safePath(v).toLowerCase()}
function external(src){return/^(?:https?:|cid:|data:)/i.test(String(src||'').trim())}
function resolveAsset(htmlPath,src){let v=String(src||'').split('#')[0].split('?')[0].replace(/^\.\//,'');if(!v||external(v))return'';try{v=decodeURIComponent(v)}catch(_){}return safePath(path.posix.join(path.posix.dirname(htmlPath),v))}
function decode(v){return String(v||'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–').replace(/&rsquo;/gi,'’').replace(/&ldquo;/gi,'“').replace(/&rdquo;/gi,'”').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))}
function htmlText(v){return clean(decode(String(v||'').replace(/<[^>]+>/g,' ')),300)}
function titleOf(html,p){const t=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html),h=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);return htmlText((t&&t[1])||(h&&h[1]))||clean(path.posix.basename(path.posix.dirname(p))||path.posix.basename(p,'.html'),180)}
function sanitize(h){h=String(h||'').trim();if(!h||Buffer.byteLength(h)>900*1024)throw Object.assign(new Error('Email HTML is empty or too large.'),{status:400});h=h.replace(/<script\b[\s\S]*?<\/script\s*>/gi,'').replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi,'').replace(/<object\b[\s\S]*?<\/object\s*>/gi,'').replace(/<embed\b[^>]*>/gi,'').replace(/<form\b[\s\S]*?<\/form\s*>/gi,'').replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\scontenteditable\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\sdata-awareness-selected\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/javascript\s*:/gi,'');return h}
function images(h){const out=[],re=/<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi;let m;while((m=re.exec(String(h||''))))if(m[2]&&!out.includes(m[2]))out.push(m[2]);return out}
function assetRefs(h){
 const out=[],add=v=>{v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)},src=String(h||'');let m;
 const img=/<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi;while((m=img.exec(src)))add(m[2]);
 const bg=/\bbackground\s*=\s*(["'])([^"']+)\1/gi;while((m=bg.exec(src)))add(m[2]);
 const css=/url\(\s*(["']?)([^"'\)]+)\1\s*\)/gi;while((m=css.exec(src)))add(m[2]);
 return out;
}
function firstImage(h){return images(h)[0]||''}
function rewrite(h,map){
 let out=String(h||'');
 out=out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi,(all,p,q,s)=>map.has(s)?p+q+map.get(s)+q:all);
 out=out.replace(/(\bbackground\s*=\s*)(["'])([^"']+)(\2)/gi,(all,p,q,s)=>map.has(s)?p+q+map.get(s)+q:all);
 out=out.replace(/url\(\s*(["']?)([^"'\)]+)\1\s*\)/gi,(all,q,s)=>map.has(s)?'url("'+map.get(s)+'")':all);
 return out;
}
function mime(fmt){return fmt==='png'?'image/png':fmt==='webp'?'image/webp':fmt==='gif'?'image/gif':'image/jpeg'}
function ext(type){return type==='image/png'?'png':type==='image/webp'?'webp':type==='image/gif'?'gif':'jpg'}
async function checkImage(body){if(!Buffer.isBuffer(body)||!body.length||body.length>MAX_IMAGE_BYTES)throw Object.assign(new Error('Template images must be 8 MB or smaller.'),{status:413});let m;try{m=await sharp(body,{animated:true}).metadata()}catch(_){throw Object.assign(new Error('Invalid template image.'),{status:400})}const f=String(m.format||'').toLowerCase();if(!FORMATS.has(f))throw Object.assign(new Error('Only JPEG, PNG, WebP and GIF images are supported.'),{status:415});return{contentType:mime(f),width:m.width||null,height:m.height||null}}
async function ensureSchema(){if(!schemaPromise)schemaPromise=Promise.all([Central.sync(),UserTemplate.sync()]).catch(e=>{schemaPromise=null;throw e});return schemaPromise}
function cManifest(r){const x=json(r&&r.assetManifestJson,[]);return(Array.isArray(x)?x:[]).filter(a=>a&&ASSET_ID_RE.test(String(a.id||''))&&a.storageKey)}
function uManifest(r){const x=json(r&&r.userAssetManifestJson,[]);return(Array.isArray(x)?x:[]).filter(a=>a&&ASSET_ID_RE.test(String(a.id||''))&&a.storageKey)}
function central(r,withHtml=false){
 const man=cManifest(r),cover=r.coverAssetId?assetUrl('central',r.publicAssetToken,r.coverAssetId):firstImage(r.htmlTemplate);
 return{id:r.id,title:r.title,description:r.description||'',category:r.category||'Awareness',subject:r.subject,coverUrl:cover,thumbnailUrl:cover,assetCount:man.filter(a=>a.role!=='thumbnail').length,isActive:!!r.isActive,sourceFileName:r.sourceFileName||'',createdAt:r.createdAt,updatedAt:r.updatedAt,...(withHtml?{html:r.htmlTemplate}:{})};
}
function mine(r,withHtml=false,source=null){
 const cover=source?.coverAssetId?assetUrl('central',source.publicAssetToken,source.coverAssetId):firstImage(r.htmlContent);
 return{id:r.id,centralTemplateId:r.centralTemplateId||null,title:r.title,subject:r.subject,description:source?.description||'',category:source?.category||'Awareness',coverUrl:cover,thumbnailUrl:cover,userAssetCount:uManifest(r).length,status:r.status||'ready',lastSentAt:r.lastSentAt||null,createdAt:r.createdAt,updatedAt:r.updatedAt,...(withHtml?{html:r.htmlContent}:{})};
}
function zipBuf(v){v=String(v||'').trim();if(v.includes(','))v=v.slice(v.indexOf(',')+1);const b=Buffer.from(v,'base64');if(!b.length)throw Object.assign(new Error('Choose a valid ZIP file.'),{status:400});if(b.length>MAX_ZIP_BYTES)throw Object.assign(new Error('ZIP files must be 35 MB or smaller.'),{status:413});return b}
async function loadZip(b){try{return await JSZip.loadAsync(b,{checkCRC32:true})}catch(_){throw Object.assign(new Error('The uploaded file is not a valid ZIP archive.'),{status:400})}}
function discoverZipTemplateEntries(z){const a=Object.keys((z&&z.files)||{}).map(safePath).filter(n=>n&&/\.html?$/i.test(n)&&!z.files[n].dir);if(!a.length)throw Object.assign(new Error('No HTML email template was found in this ZIP.'),{status:400});if(a.length>50)throw Object.assign(new Error('A ZIP can contain up to 50 templates.'),{status:413});return a}
async function zipEntry(z,w){const k=Object.keys(z.files||{}).find(n=>pathKey(n)===pathKey(w));return k?z.files[k]:null}

const THUMBNAIL_NAMES=['thumbnail.jpg','thumbnail.jpeg','thumbnail.png','thumbnail.webp','cover.jpg','cover.jpeg','cover.png','cover.webp','preview.jpg','preview.jpeg','preview.png','preview.webp','images/thumbnail.jpg','images/thumbnail.jpeg','images/thumbnail.png','images/thumbnail.webp'];
async function thumbnailEntry(z,htmlPath){
 const dir=path.posix.dirname(htmlPath);
 for(const name of THUMBNAIL_NAMES){
  const candidate=safePath(path.posix.join(dir,name));
  const entry=candidate&&await zipEntry(z,candidate);
  if(entry&&!entry.dir)return{entry,path:candidate};
 }
 return null;
}
async function makeThumbnail(body){
 return sharp(body).rotate().resize(1200,675,{fit:'cover',position:'attention'}).jpeg({quality:84,chromaSubsampling:'4:4:4'}).toBuffer();
}
async function fallbackThumbnail(){
 return sharp({create:{width:1200,height:675,channels:4,background:{r:12,g:22,b:28,alpha:1}}}).jpeg({quality:82}).toBuffer();
}
async function putCentralAsset({storage,templateId,body,contentType,originalPath,role='content',index=0}){
 const aid='asset-'+String(index+1).padStart(3,'0')+'-'+crypto.randomBytes(4).toString('hex');
 const key='awareness/library/'+templateId+'/'+aid+'.'+ext(contentType);
 await storage.putObject({key,body,contentType});
 const meta=await checkImage(body);
 return{id:aid,originalPath:originalPath||'',storageKey:key,contentType,byteSize:body.length,width:meta.width,height:meta.height,role};
}

async function importOne(z,htmlPath,userId,fileName,meta){
 const he=await zipEntry(z,htmlPath);
 if(!he||he.dir)throw Object.assign(new Error('Template HTML not found.'),{status:400});
 const raw=await he.async('string');
 if(!raw||Buffer.byteLength(raw)>MAX_HTML_BYTES)throw Object.assign(new Error('Template HTML must be 750 KB or smaller.'),{status:413});

 const id=crypto.randomUUID(),t=token(),storage=getObjectStorage(),map=new Map(),manifest=[],warnings=[];
 let cover=null,firstVisualBody=null;

 for(const src of assetRefs(raw)){
  if(external(src))continue;
  const rp=resolveAsset(htmlPath,src),entry=rp&&await zipEntry(z,rp);
  if(!entry||entry.dir){warnings.push('Image not found: '+src);continue}
  try{
   const body=await entry.async('nodebuffer'),im=await checkImage(body);
   const asset=await putCentralAsset({storage,templateId:id,body,contentType:im.contentType,originalPath:rp,index:manifest.length});
   manifest.push(asset);
   if(!firstVisualBody)firstVisualBody=body;
   map.set(src,assetUrl('central',t,asset.id));
  }catch(error){warnings.push('Skipped '+src+': '+error.message)}
 }

 try{
  const thumb=await thumbnailEntry(z,htmlPath);
  if(thumb){
   const existing=manifest.find(a=>pathKey(a.originalPath)===pathKey(thumb.path));
   if(existing){
    cover=existing.id;
   }else{
    const rawThumb=await thumb.entry.async('nodebuffer');
    await checkImage(rawThumb);
    const body=await makeThumbnail(rawThumb);
    const asset=await putCentralAsset({storage,templateId:id,body,contentType:'image/jpeg',originalPath:thumb.path,role:'thumbnail',index:manifest.length});
    manifest.push(asset);cover=asset.id;
   }
  }
  if(!cover){
   const body=firstVisualBody?await makeThumbnail(firstVisualBody):await fallbackThumbnail();
   const asset=await putCentralAsset({storage,templateId:id,body,contentType:'image/jpeg',originalPath:'__generated-thumbnail__',role:'thumbnail',index:manifest.length});
   manifest.push(asset);cover=asset.id;
  }
 }catch(error){
  warnings.push('Thumbnail: '+error.message);
 }

 const html=sanitize(rewrite(raw,map)),derived=titleOf(raw,htmlPath),title=clean(meta&&meta.title||derived,180)||'Awareness Template',category=clean(meta&&meta.category||path.posix.basename(path.posix.dirname(htmlPath))||'Awareness',120);
 let row;
 try{
  row=await Central.create({id,seedKey:meta&&meta.seedKey||null,title,description:clean(meta&&meta.description||title+' awareness email template.',1500),category,subject:clean(meta&&meta.subject||title,240)||title,htmlTemplate:html,assetManifestJson:JSON.stringify(manifest),publicAssetToken:t,coverAssetId:cover,sourceFileName:clean(fileName,255)||null,sourceEntryPath:clean(htmlPath,520)||null,createdByUserId:userId,isActive:true});
 }catch(error){
  await Promise.all(manifest.map(a=>storage.deleteObject(a.storageKey).catch(()=>{})));
  throw error;
 }
 return{template:central(row),warnings};
}

async function importCentralZip({zipBase64,fileName='awareness-templates.zip',createdByUserId=null}){await ensureSchema();const z=await loadZip(zipBuf(zipBase64)),entries=discoverZipTemplateEntries(z),imported=[],warnings=[];for(const p of entries){try{const r=await importOne(z,p,createdByUserId,fileName,null);imported.push(r.template);warnings.push(...r.warnings.map(w=>p+': '+w))}catch(e){warnings.push(p+': '+e.message)}}if(!imported.length)throw Object.assign(new Error(warnings[0]||'No template could be imported.'),{status:400});return{imported,warnings}}
function referenceZipPath(){
 const configured=clean(process.env.AWARENESS_REFERENCE_ZIP_PATH,1000);
 const candidates=[
  configured,
  path.resolve(__dirname,'../../seed-assets/Educational-email-Templete.zip'),
  path.resolve(__dirname,'../../../Educational-email-Templete.zip')
 ].filter(Boolean);
 return candidates.find(fp=>fs.existsSync(fp))||'';
}
async function ensureCentralThumbnail(r){
 if(!r)return false;
 const man=cManifest(r),current=man.find(a=>a.id===r.coverAssetId);
 if(current?.role==='thumbnail')return false;
 const storage=getObjectStorage();
 let body;
 try{
  const source=current||man.find(a=>a.role!=='thumbnail');
  body=source?await makeThumbnail(await storage.getObjectBuffer(source.storageKey)):await fallbackThumbnail();
 }catch(_){body=await fallbackThumbnail()}
 const asset=await putCentralAsset({storage,templateId:r.id,body,contentType:'image/jpeg',originalPath:'__generated-thumbnail__',role:'thumbnail',index:man.length});
 r.coverAssetId=asset.id;r.assetManifestJson=JSON.stringify([...man,asset]);
 try{await r.save()}catch(error){await storage.deleteObject(asset.storageKey).catch(()=>{});throw error}
 return true;
}
async function ensureCentralThumbnails(rows){
 let updated=0;
 for(const row of rows||[])if(await ensureCentralThumbnail(row))updated++;
 return updated;
}
async function seedReferenceTemplates(){await ensureSchema();if(String(process.env.AWARENESS_SEED_REFERENCE_TEMPLATES||'true').toLowerCase()==='false')return{seeded:0};const fp=referenceZipPath();if(!fp){logger.warn('awareness_reference_zip_missing',{module:'awareness-gallery'});return{seeded:0,missing:true}}const z=await loadZip(fs.readFileSync(fp));let seeded=0;const warnings=[];for(const[k,v]of Object.entries(REF)){if(await Central.findOne({where:{seedKey:v[0]}}))continue;const actual=Object.keys(z.files||{}).find(n=>pathKey(n)===k);if(!actual){warnings.push('Missing '+k);continue}try{await importOne(z,actual,null,'Educational-email-Templete.zip',{seedKey:v[0],title:v[1],category:v[2],description:v[3]});seeded++}catch(e){warnings.push(v[1]+': '+e.message)}}if(warnings.length)logger.warn('awareness_reference_seed_warnings',{module:'awareness-gallery',warnings});return{seeded,warnings}}
async function ensureReady(){await ensureSchema();if(!seedPromise)seedPromise=seedReferenceTemplates().catch(e=>{seedPromise=null;throw e});return seedPromise}
async function listCentral(includeInactive=false){await ensureReady();const rows=await Central.findAll({where:includeInactive?{}:{isActive:true},order:[['category','ASC'],['title','ASC']]});await ensureCentralThumbnails(rows);return rows.map(r=>central(r))}
async function getCentral(id,includeInactive=false){await ensureReady();const where={id};if(!includeInactive)where.isActive=true;const r=await Central.findOne({where});if(!r)throw Object.assign(new Error('Central template not found.'),{status:404});return central(r,true)}
async function updateCentral(id,p={}){await ensureReady();const r=await Central.findByPk(id);if(!r)throw Object.assign(new Error('Central template not found.'),{status:404});for(const[k,n]of[['title',180],['description',1500],['category',120],['subject',240]])if(Object.prototype.hasOwnProperty.call(p,k))r[k]=clean(p[k],n)||r[k];if(Object.prototype.hasOwnProperty.call(p,'isActive'))r.isActive=!!p.isActive;await r.save();return central(r)}
async function importMine({centralTemplateId,hostId,createdByUserId=null}){await ensureReady();const source=await Central.findOne({where:{id:centralTemplateId,isActive:true}});if(!source)throw Object.assign(new Error('Central template not found.'),{status:404});const r=await UserTemplate.create({id:crypto.randomUUID(),hostId,createdByUserId,centralTemplateId:source.id,title:source.title,subject:source.subject,htmlContent:source.htmlTemplate,userAssetManifestJson:'[]',publicAssetToken:token(),status:'ready'});return mine(r,true,source)}
async function sourceFor(r){return r?.centralTemplateId?Central.findByPk(r.centralTemplateId):null}
async function listMine(hostId){await ensureReady();const rows=await UserTemplate.findAll({where:{hostId},order:[['updatedAt','DESC']]});const ids=[...new Set(rows.map(r=>r.centralTemplateId).filter(Boolean))],sources=ids.length?await Central.findAll({where:{id:{[Op.in]:ids}}}):[],map=new Map(sources.map(s=>[s.id,s]));return rows.map(r=>mine(r,false,map.get(r.centralTemplateId)||null))}
async function owned(id,hostId){await ensureReady();const r=await UserTemplate.findOne({where:{id,hostId}});if(!r)throw Object.assign(new Error('Template is not in My Library.'),{status:404});return r}
async function getMine(id,hostId){const r=await owned(id,hostId);return mine(r,true,await sourceFor(r))}
async function pruneUserAssets(r){
 const storage=getObjectStorage(),man=uManifest(r),referenced=new Set(assetRefs(r.htmlContent).map(parseAssetUrl).filter(x=>x&&x.scope==='user').map(x=>x.id)),keep=[],remove=[];
 for(const a of man)(referenced.has(a.id)?keep:remove).push(a);
 if(remove.length){r.userAssetManifestJson=JSON.stringify(keep);await Promise.all(remove.map(a=>storage.deleteObject(a.storageKey).catch(()=>{})))}
}
async function updateMine(id,hostId,p={}){const r=await owned(id,hostId);if(Object.prototype.hasOwnProperty.call(p,'title'))r.title=clean(p.title,180)||r.title;if(Object.prototype.hasOwnProperty.call(p,'subject'))r.subject=clean(p.subject,240)||r.subject;if(Object.prototype.hasOwnProperty.call(p,'html'))r.htmlContent=sanitize(p.html);await r.save();if(Object.prototype.hasOwnProperty.call(p,'html')){await pruneUserAssets(r);if(r.changed('userAssetManifestJson'))await r.save()}return mine(r,true,await sourceFor(r))}
function dataImage(v){const m=/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\r\n]+)$/i.exec(String(v||''));if(!m)throw Object.assign(new Error('Choose a JPEG, PNG, WebP or GIF image.'),{status:400});return Buffer.from(m[2],'base64')}
async function replaceMineImage({id,hostId,oldSrc,dataUrl}){const r=await owned(id,hostId),src=String(oldSrc||'').trim();if(!src||!r.htmlContent.includes(src))throw Object.assign(new Error('Select an image from the template first.'),{status:400});const body=dataImage(dataUrl),im=await checkImage(body),aid='asset-'+crypto.randomBytes(10).toString('hex'),key='awareness/user/'+hostId+'/'+r.id+'/'+aid+'.'+ext(im.contentType),storage=getObjectStorage();await storage.putObject({key,body,contentType:im.contentType});const u=assetUrl('user',r.publicAssetToken,aid),man=uManifest(r),previous=parseAssetUrl(src),oldOwned=previous&&previous.scope==='user'?man.find(a=>a.id===previous.id):null,nextMan=oldOwned?man.filter(a=>a.id!==oldOwned.id):man.slice();nextMan.push({id:aid,storageKey:key,contentType:im.contentType,byteSize:body.length,width:im.width,height:im.height});r.htmlContent=sanitize(r.htmlContent.split(src).join(u));r.userAssetManifestJson=JSON.stringify(nextMan);try{await r.save()}catch(e){await storage.deleteObject(key).catch(()=>{});throw e}if(oldOwned)await storage.deleteObject(oldOwned.storageKey).catch(()=>{});return{template:mine(r,true,await sourceFor(r)),url:u}}
async function replaceCentralThumbnail({id,dataUrl}){
 await ensureReady();
 const r=await Central.findByPk(id);
 if(!r)throw Object.assign(new Error('Central template not found.'),{status:404});
 const source=dataImage(dataUrl);
 await checkImage(source);
 const body=await makeThumbnail(source),storage=getObjectStorage(),man=cManifest(r);
 const old=man.find(a=>a.id===r.coverAssetId&&a.role==='thumbnail');
 const asset=await putCentralAsset({storage,templateId:r.id,body,contentType:'image/jpeg',originalPath:'__uploaded-thumbnail__',role:'thumbnail',index:man.length});
 const next=old?man.filter(a=>a.id!==old.id):man.slice();
 next.push(asset);
 r.coverAssetId=asset.id;
 r.assetManifestJson=JSON.stringify(next);
 try{await r.save()}catch(error){await storage.deleteObject(asset.storageKey).catch(()=>{});throw error}
 if(old)await storage.deleteObject(old.storageKey).catch(()=>{});
 return central(r);
}
async function deleteMine(id,hostId){const r=await owned(id,hostId),storage=getObjectStorage();for(const a of uManifest(r))await storage.deleteObject(a.storageKey).catch(()=>{});await r.destroy();return true}
async function getAsset(scope,t,id){await ensureReady();if(!/^[a-f0-9]{64}$/i.test(String(t||''))||!ASSET_ID_RE.test(String(id||'')))throw Object.assign(new Error('Image not found.'),{status:404});let r,man;if(scope==='central'){r=await Central.findOne({where:{publicAssetToken:t}});man=cManifest(r)}else if(scope==='user'){r=await UserTemplate.findOne({where:{publicAssetToken:t}});man=uManifest(r)}else throw Object.assign(new Error('Image not found.'),{status:404});const a=man.find(x=>x.id===id);if(!r||!a)throw Object.assign(new Error('Image not found.'),{status:404});return{body:await getObjectStorage().getObjectBuffer(a.storageKey),contentType:a.contentType||'image/jpeg'}}
function parseAssetUrl(src){try{const u=new URL(String(src||''),base()),m=/^\/api\/scorm\/awareness-template-assets\/(central|user)\/([a-f0-9]{64})\/([a-z0-9-]{8,80})$/i.exec(u.pathname);return m?{scope:m[1],token:m[2],id:m[3]}:null}catch(_){return null}}
async function inlineAssets(html){let h=String(html||''),atts=[],seen=new Map(),i=0;for(const src of assetRefs(h)){const p=parseAssetUrl(src);if(!p||seen.has(src))continue;const a=await getAsset(p.scope,p.token,p.id),cid='awareness-template-'+(++i)+'@lmsgen';atts.push({filename:'awareness-'+i+'.'+ext(a.contentType),content:a.body,contentType:a.contentType,cid,contentDisposition:'inline'});seen.set(src,'cid:'+cid)}for(const[s,c]of seen)h=h.split(s).join(c);return{html:h,attachments:atts}}
function recipients(v){const a=Array.isArray(v)?v:String(v||'').split(/[\s,;]+/),u=[...new Set(a.map(x=>String(x||'').trim().toLowerCase()).filter(x=>EMAIL_RE.test(x)))];if(!u.length)throw Object.assign(new Error('Add at least one valid recipient.'),{status:400});if(u.length>MAX_RECIPIENTS_PER_SEND)throw Object.assign(new Error('A maximum of 50 recipients can be sent at once.'),{status:400});return u}
function toText(h){return clean(decode(String(h||'').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>/gi,'\n').replace(/<[^>]+>/g,' ')),30000)}
async function each(items,n,fn){const out=new Array(items.length);let c=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{for(;;){const i=c++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}));return out}
async function sendMine(id,hostId,to){if(!MailService.isConfigured())throw Object.assign(new Error('Outbound email is not configured.'),{status:503});const r=await owned(id,hostId),list=recipients(to),smtp=MailService.mailProvider()==='smtp',prep=smtp?await inlineAssets(r.htmlContent):{html:r.htmlContent,attachments:[]},txt=toText(r.htmlContent),res=await each(list,3,async email=>{try{const x=await Delivery.sendContent({to:email,subject:r.subject,html:prep.html,text:txt,attachments:prep.attachments,headers:{'X-LMSGEN-Content-Type':'awareness-library-template'}});return{email,sent:!!x.sent,messageId:x.messageId||null}}catch(e){return{email,sent:false,reason:e.code||'MAIL_SEND_FAILED'}}});const sent=res.filter(x=>x.sent).length;if(sent){r.lastSentAt=new Date();await r.save()}return{requested:list.length,sent,failed:res.length-sent,results:res}}
async function exportMine(id,hostId,to=''){const r=await owned(id,hostId),prep=await inlineAssets(r.htmlContent),message=await Delivery.createEml({to:to?[to]:[],subject:r.subject,html:prep.html,text:toText(r.htmlContent),attachments:prep.attachments,headers:{'X-LMSGEN-Content-Type':'awareness-library-template'}});return{message,title:r.title}}
module.exports={MAX_RECIPIENTS_PER_SEND,REF,ensureSchema,ensureReady,seedReferenceTemplates,discoverZipTemplateEntries,importCentralZip,listCentral,getCentral,updateCentral,replaceCentralThumbnail,ensureCentralThumbnail,ensureCentralThumbnails,importMine,listMine,getMine,updateMine,replaceMineImage,deleteMine,getAsset,sendMine,exportMine,assetUrl,sanitize,images,assetRefs,rewrite,resolveAsset,zipBuf,parseAssetUrl,inlineAssets,toText,referenceZipPath,thumbnailEntry,makeThumbnail};
