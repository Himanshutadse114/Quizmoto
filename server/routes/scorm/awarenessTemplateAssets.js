'use strict';

const express=require('express');
const router=express.Router();
const Gallery=require('../../services/awareness/AwarenessTemplateGalleryService');

router.get('/:scope/:token/:assetId',async(req,res)=>{
    try{
        const asset=await Gallery.getAsset(String(req.params.scope||'').toLowerCase(),req.params.token,req.params.assetId);
        res.setHeader('Content-Type',asset.contentType||'image/jpeg');
        res.setHeader('Cache-Control','public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options','nosniff');
        res.send(asset.body);
    }catch(e){res.status(e.status||404).end()}
});
module.exports=router;
