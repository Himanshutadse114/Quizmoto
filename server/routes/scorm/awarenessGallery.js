'use strict';

const express=require('express');
const router=express.Router();
const auth=require('../middleware');
const Gallery=require('../../services/awareness/AwarenessTemplateGalleryService');
const MailService=require('../../services/mail/MailService');

function editor(req,res,next){
    const role=String(req.scormRole||'').toLowerCase();
    if(!['super_admin','admin','co_admin'].includes(role)){
        return res.status(403).json({message:'Awareness template access is required.',code:'AWARENESS_TEMPLATE_ACCESS_REQUIRED'});
    }
    next();
}
function superAdmin(req,res,next){
    if(String(req.scormRole||'').toLowerCase()!=='super_admin'){
        return res.status(403).json({message:'Super Admin access is required to manage the Central Template Library.',code:'AWARENESS_LIBRARY_SUPER_ADMIN_REQUIRED'});
    }
    next();
}
function fail(res,error,fallback){
    res.status(error.status||500).json({ok:false,message:error.message||fallback,code:error.code||'AWARENESS_GALLERY_ERROR',warnings:error.warnings||undefined});
}

router.get('/status',auth,editor,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({ok:true,mail:{configured:MailService.isConfigured(),provider:MailService.mailProvider()},maxRecipientsPerSend:Gallery.MAX_RECIPIENTS_PER_SEND,isSuperAdmin:String(req.scormRole||'').toLowerCase()==='super_admin'});
});

router.get('/central',auth,editor,async(req,res)=>{
    try{
        const includeInactive=String(req.scormRole||'').toLowerCase()==='super_admin'&&String(req.query.includeInactive||'')==='1';
        res.setHeader('Cache-Control','no-store');
        res.json({ok:true,templates:await Gallery.listCentral(includeInactive)});
    }catch(e){fail(res,e,'Unable to load the Central Template Library.')}
});
router.get('/central/:id',auth,editor,async(req,res)=>{
    try{
        const includeInactive=String(req.scormRole||'').toLowerCase()==='super_admin';
        res.setHeader('Cache-Control','no-store');
        res.json({ok:true,template:await Gallery.getCentral(req.params.id,includeInactive)});
    }catch(e){fail(res,e,'Unable to load this central template.')}
});
router.post('/central/upload',auth,superAdmin,async(req,res)=>{
    try{
        const result=await Gallery.importCentralZip({
            zipBase64:req.body?.zipBase64,
            fileName:req.body?.fileName||'awareness-templates.zip',
            createdByUserId:req.authenticatedUserId||null
        });
        res.status(201).json({ok:true,...result});
    }catch(e){fail(res,e,'Unable to import the template ZIP.')}
});
router.patch('/central/:id',auth,superAdmin,async(req,res)=>{
    try{res.json({ok:true,template:await Gallery.updateCentral(req.params.id,req.body||{})})}
    catch(e){fail(res,e,'Unable to update this central template.')}
});
router.post('/central/:id/import',auth,editor,async(req,res)=>{
    try{
        const template=await Gallery.importMine({
            centralTemplateId:req.params.id,
            hostId:req.userId,
            createdByUserId:req.authenticatedUserId||null
        });
        res.status(201).json({ok:true,template});
    }catch(e){fail(res,e,'Unable to add this template to My Library.')}
});

router.get('/mine',auth,editor,async(req,res)=>{
    try{
        res.setHeader('Cache-Control','no-store');
        res.json({ok:true,templates:await Gallery.listMine(req.userId)});
    }catch(e){fail(res,e,'Unable to load My Library.')}
});
router.get('/mine/:id',auth,editor,async(req,res)=>{
    try{
        res.setHeader('Cache-Control','no-store');
        res.json({ok:true,template:await Gallery.getMine(req.params.id,req.userId)});
    }catch(e){fail(res,e,'Unable to load this template.')}
});
router.put('/mine/:id',auth,editor,async(req,res)=>{
    try{res.json({ok:true,template:await Gallery.updateMine(req.params.id,req.userId,req.body||{})})}
    catch(e){fail(res,e,'Unable to save the template.')}
});
router.post('/mine/:id/image',auth,editor,async(req,res)=>{
    try{
        const result=await Gallery.replaceMineImage({
            id:req.params.id,
            hostId:req.userId,
            oldSrc:req.body?.oldSrc,
            dataUrl:req.body?.dataUrl
        });
        res.json({ok:true,...result});
    }catch(e){fail(res,e,'Unable to replace the selected image.')}
});
router.delete('/mine/:id',auth,editor,async(req,res)=>{
    try{await Gallery.deleteMine(req.params.id,req.userId);res.json({ok:true})}
    catch(e){fail(res,e,'Unable to delete the template from My Library.')}
});
router.post('/mine/:id/send',auth,editor,async(req,res)=>{
    try{
        const delivery=await Gallery.sendMine(req.params.id,req.userId,req.body?.recipients||req.body?.to||[]);
        res.status(delivery.failed&&!delivery.sent?502:200).json({ok:delivery.failed===0,delivery});
    }catch(e){fail(res,e,'Unable to send the awareness email.')}
});
router.post('/mine/:id/export-eml',auth,editor,async(req,res)=>{
    try{
        const out=await Gallery.exportMine(req.params.id,req.userId,String(req.body?.to||'').trim());
        const name=String(out.title||'awareness-template').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'awareness-template';
        res.setHeader('Content-Type','message/rfc822');
        res.setHeader('Content-Disposition','attachment; filename="'+name+'.eml"');
        res.setHeader('Cache-Control','private, no-store');
        res.send(out.message);
    }catch(e){fail(res,e,'Unable to export the template.')}
});

module.exports=router;
