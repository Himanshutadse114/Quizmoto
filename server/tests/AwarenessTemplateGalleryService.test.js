const {expect}=require('chai');
const fs=require('fs');
const os=require('os');
const path=require('path');
const JSZip=require('jszip');

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'awareness-gallery-'));
process.env.NODE_ENV='test';
process.env.REPORT_ARTIFACTS_DIR=tempRoot;
process.env.AWARENESS_ASSET_BASE_URL='https://api.example.com';
process.env.AWARENESS_SEED_REFERENCE_TEMPLATES='true';

const {sequelize}=require('../config/database');
const {getObjectStorage,_resetObjectStorageCache}=require('../storage/ObjectStorage');
const Central=require('../models/scorm/ScormAwarenessLibraryTemplate');
const UserTemplate=require('../models/scorm/ScormAwarenessUserTemplate');
const Gallery=require('../services/awareness/AwarenessTemplateGalleryService');

describe('AwarenessTemplateGalleryService',function(){
    this.timeout(30000);

    before(async()=>{
        _resetObjectStorageCache();
        await sequelize.sync({force:true});
    });

    after(()=>{
        fs.rmSync(tempRoot,{recursive:true,force:true});
    });

    it('discovers the eight supplied reference HTML templates',async()=>{
        const zipPath=path.resolve(__dirname,'../../Educational-email-Templete.zip');
        const zip=await JSZip.loadAsync(fs.readFileSync(zipPath));
        const entries=Gallery.discoverZipTemplateEntries(zip);
        expect(entries).to.have.length(8);
        expect(entries.some(x=>/data-privacy-newsletter\.html$/i.test(x))).to.equal(true);
        expect(entries.some(x=>/ai-scams-deepfakes\.html$/i.test(x))).to.equal(true);
    });

    it('seeds the eight reference templates and stores their images',async()=>{
        const result=await Gallery.seedReferenceTemplates();
        expect(result.seeded).to.equal(8);
        const rows=await Central.findAll();
        expect(rows).to.have.length(8);
        for(const row of rows){
            const manifest=JSON.parse(row.assetManifestJson||'[]');
            expect(manifest.length).to.be.greaterThan(0);
            expect(row.htmlTemplate).to.include('/api/scorm/awareness-template-assets/central/');
            expect(row.htmlTemplate).to.not.match(/src=["']\.?\/?images\//i);
            for(const asset of manifest){
                expect(await getObjectStorage().exists(asset.storageKey)).to.equal(true);
            }
        }
    });

    it('does not duplicate seeded templates on a second seed pass',async()=>{
        const result=await Gallery.seedReferenceTemplates();
        expect(result.seeded).to.equal(0);
        expect(await Central.count()).to.equal(8);
    });

    it('imports a central template into My Library before export is available',async()=>{
        const central=await Central.findOne({where:{seedKey:'reference:ransomware'}});
        const mine=await Gallery.importMine({centralTemplateId:central.id,hostId:42,createdByUserId:42});
        expect(mine.centralTemplateId).to.equal(central.id);
        expect(await UserTemplate.count({where:{hostId:42}})).to.equal(1);
        const exported=await Gallery.exportMine(mine.id,42);
        const source=exported.message.toString('utf8');
        expect(source).to.include('Content-ID: <awareness-template-');
        expect(source).to.include('multipart/related');
    });

    it('replaces an imported image with a user-owned object-store asset',async()=>{
        const central=await Central.findOne({where:{seedKey:'reference:data-privacy'}});
        const mine=await Gallery.importMine({centralTemplateId:central.id,hostId:77,createdByUserId:77});
        const oldSrc=Gallery.images(mine.html)[0];
        const parsed=Gallery.parseAssetUrl(oldSrc);
        expect(parsed.scope).to.equal('central');
        const original=await Gallery.getAsset(parsed.scope,parsed.token,parsed.id);
        const dataUrl='data:'+original.contentType+';base64,'+original.body.toString('base64');
        const result=await Gallery.replaceMineImage({id:mine.id,hostId:77,oldSrc,dataUrl});
        expect(result.url).to.include('/awareness-template-assets/user/');
        expect(result.template.html).to.include(result.url);
        const row=await UserTemplate.findByPk(mine.id);
        expect(JSON.parse(row.userAssetManifestJson)).to.have.length(1);
    });

    it('keeps the uploaded email structure while removing unsafe scripting',()=>{
        const html='<html><head><style>.x{color:red}</style><script>alert(1)</script></head><body onload="bad()"><table><tr><td>Hello</td></tr></table></body></html>';
        const clean=Gallery.sanitize(html);
        expect(clean).to.include('<style>.x{color:red}</style>');
        expect(clean).to.include('<table>');
        expect(clean).to.not.match(/<script/i);
        expect(clean).to.not.include('onload=');
    });

    it('recognises img, background attributes and CSS url assets',()=>{
        const html='<html><head><style>.hero{background-image:url("./images/bg.png")}</style></head><body background="./images/paper.jpg"><img src="./images/hero.png"></body></html>';
        expect(Gallery.assetRefs(html)).to.deep.equal([
            './images/hero.png',
            './images/paper.jpg',
            './images/bg.png'
        ]);
        const map=new Map([
            ['./images/hero.png','https://cdn.example/hero.png'],
            ['./images/paper.jpg','https://cdn.example/paper.jpg'],
            ['./images/bg.png','https://cdn.example/bg.png']
        ]);
        const rewritten=Gallery.rewrite(html,map);
        expect(rewritten).to.include('src="https://cdn.example/hero.png"');
        expect(rewritten).to.include('background="https://cdn.example/paper.jpg"');
        expect(rewritten).to.include('url("https://cdn.example/bg.png")');
    });

    it('replaces a user-owned image without leaving the previous object orphaned',async()=>{
        const central=await Central.findOne({where:{seedKey:'reference:data-privacy'}});
        const mine=await Gallery.importMine({centralTemplateId:central.id,hostId:88,createdByUserId:88});
        const firstSrc=Gallery.images(mine.html)[0];
        const firstParsed=Gallery.parseAssetUrl(firstSrc);
        const original=await Gallery.getAsset(firstParsed.scope,firstParsed.token,firstParsed.id);
        const dataUrl='data:'+original.contentType+';base64,'+original.body.toString('base64');

        const first=await Gallery.replaceMineImage({id:mine.id,hostId:88,oldSrc:firstSrc,dataUrl});
        const rowAfterFirst=await UserTemplate.findByPk(mine.id);
        const firstManifest=JSON.parse(rowAfterFirst.userAssetManifestJson);
        expect(firstManifest).to.have.length(1);
        expect(await getObjectStorage().exists(firstManifest[0].storageKey)).to.equal(true);

        const second=await Gallery.replaceMineImage({id:mine.id,hostId:88,oldSrc:first.url,dataUrl});
        const rowAfterSecond=await UserTemplate.findByPk(mine.id);
        const secondManifest=JSON.parse(rowAfterSecond.userAssetManifestJson);
        expect(secondManifest).to.have.length(1);
        expect(second.url).to.not.equal(first.url);
        expect(await getObjectStorage().exists(firstManifest[0].storageKey)).to.equal(false);
        expect(await getObjectStorage().exists(secondManifest[0].storageKey)).to.equal(true);
    });

    it('resolves image-folder paths relative to each HTML template',()=>{
        expect(Gallery.resolveAsset('folder/email.html','./images/hero.png')).to.equal('folder/images/hero.png');
        expect(Gallery.resolveAsset('folder/sub/email.html','../images/card.png')).to.equal('folder/images/card.png');
        expect(Gallery.resolveAsset('folder/email.html','../../../secret.png')).to.equal('');
    });

    it('finds the production-bundled reference ZIP path',()=>{
        const seedPath=Gallery.referenceZipPath();
        expect(seedPath).to.match(/Educational-email-Templete\.zip$/);
        expect(fs.existsSync(seedPath)).to.equal(true);
    });
});
