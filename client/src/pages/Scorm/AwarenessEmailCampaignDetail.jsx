import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Download, FileSpreadsheet, Mail, Play, RefreshCw, Square, Trash2, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './awarenessTemplates.css';
import './awarenessEmailCampaigns.css';

const API='/api/scorm/awareness-gallery/email-campaigns';

function statusLabel(value){
  return {draft:'Draft',sending:'Sending',completed:'Submitted',partial:'Submitted with errors',failed:'Failed',stopped:'Stopped'}[value]||value||'Draft';
}

function recipientStatus(item){
  if(item?.openedAt)return 'Tracked open';
  if(item?.status==='delivered')return 'Delivered';
  if(item?.status==='sent')return 'Provider queued';
  if(item?.status==='failed')return 'Failed';
  return 'Pending';
}

async function blobErrorMessage(blob,fallback){
  try{return JSON.parse(await blob.text()).message||fallback}catch{return fallback}
}

function safeFilePart(value){return String(value||'Campaign').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,70)}

function downloadBlob(blob,fileName){
  const url=window.URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();
  window.URL.revokeObjectURL(url);
}

function formatDuration(seconds){
  const value=Math.max(0,Number(seconds)||0);
  if(value<60)return `${value} second${value===1?'':'s'}`;
  const minutes=Math.round(value/60);
  return `${minutes} minute${minutes===1?'':'s'}`;
}

function Metric({label,value,icon:Icon}){
  return <div className="aw-campaign-detail-metric">
    <span>{label}</span>
    <strong>{Icon?<Icon size={17}/>:null}{value}</strong>
  </div>;
}

export default function AwarenessEmailCampaignDetail(){
  const {campaignId}=useParams();
  const navigate=useNavigate();
  const {token}=useAuth();
  const headers=useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  const [campaign,setCampaign]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  const load=useCallback(async({showLoader=true}={})=>{
    if(!token||!campaignId)return;
    if(showLoader)setLoading(true);
    try{
      const res=await axios.get(apiUrl(`${API}/${campaignId}`),{headers});
      setCampaign(res.data?.campaign||null);
      setError('');
    }catch(err){
      setError(err.response?.data?.message||'Unable to load campaign statistics.');
    }finally{if(showLoader)setLoading(false)}
  },[campaignId,headers,token]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(campaign?.status!=='sending')return undefined;
    const id=setInterval(()=>load({showLoader:false}),5000);
    return()=>clearInterval(id);
  },[campaign?.status,load]);

  const runAction=async(action)=>{
    if(!campaign)return;
    if(action==='stop'&&!window.confirm(`Stop “${campaign.name}”? Recipients not yet processed will remain unsent.`))return;
    if(action==='delete'&&!window.confirm(`Delete “${campaign.name}”? This cannot be undone.`))return;
    setBusy(action);setError('');
    try{
      if(action==='delete'){
        await axios.delete(apiUrl(`${API}/${campaign.id}`),{headers});
        navigate('/scorm/awareness-templates?tab=campaigns',{replace:true});
        return;
      }
      const res=await axios.post(apiUrl(`${API}/${campaign.id}/${action}`),{},{headers});
      setCampaign(current=>({...current,...(res.data?.campaign||{})}));
      await load({showLoader:false});
    }catch(err){setError(err.response?.data?.message||`Unable to ${action} this campaign.`)}
    finally{setBusy('')}
  };

  const downloadReport=async(format)=>{
    if(!campaign||busy)return;
    setBusy(`report-${format}`);setError('');
    try{
      const response=await axios.get(apiUrl(`${API}/${campaign.id}/report?format=${format}`),{
        headers,responseType:'blob',validateStatus:()=>true
      });
      if(response.status!==200){
        setError(await blobErrorMessage(response.data,'Unable to generate the campaign report.'));
        return;
      }
      downloadBlob(response.data,`LMSGEN_Awareness_${safeFilePart(campaign.name)}.${format==='pdf'?'pdf':'xlsx'}`);
    }catch(err){setError(err.message||'Campaign report download failed.')}
    finally{setBusy('')}
  };

  if(loading)return <div className="aw-campaign-loading" role="status"><RefreshCw size={17} className="animate-spin"/> Loading campaign statistics…</div>;

  if(!campaign)return <div className="aw-campaigns">
    <button type="button" className="aw-back" onClick={()=>navigate('/scorm/awareness-templates?tab=campaigns')}><ArrowLeft size={13}/> Email campaigns</button>
    <div className="aw-campaign-error" role="alert">{error||'Campaign statistics are unavailable.'}</div>
  </div>;

  const processed=Number(campaign.sentCount||0)+Number(campaign.failedCount||0);
  const progress=campaign.recipientCount?Math.min(100,Math.round((processed/campaign.recipientCount)*100)):0;
  const recipients=campaign.recipients||[];

  return <div className="aw-campaigns aw-campaign-detail-page">
    <div className="aw-campaign-page-head">
      <div>
        <button type="button" className="aw-back" onClick={()=>navigate('/scorm/awareness-templates?tab=campaigns')}><ArrowLeft size={13}/> Email campaigns</button>
        <div className="aw-kicker"><Mail size={13}/> Campaign statistics</div>
        <h2>{campaign.name}</h2>
        <p>{campaign.templateTitle||'Awareness email campaign'}</p>
      </div>
      <div className="aw-campaign-head-actions">
        <button type="button" className="aw-btn-secondary" onClick={()=>downloadReport('pdf')} disabled={!!busy}><Download size={13}/>{busy==='report-pdf'?'Preparing…':'PDF report'}</button>
        <button type="button" className="aw-btn-secondary" onClick={()=>downloadReport('excel')} disabled={!!busy}><FileSpreadsheet size={13}/>{busy==='report-excel'?'Preparing…':'Excel report'}</button>
        <button type="button" className="aw-btn-secondary" onClick={()=>load()} disabled={loading||!!busy}><RefreshCw size={13}/> Refresh</button>
        {campaign.status==='draft'&&<button type="button" className="aw-btn-primary" disabled={!!busy} onClick={()=>runAction('start')}><Play size={12}/>{busy==='start'?'Starting…':'Start campaign'}</button>}
        {campaign.status==='sending'&&<button type="button" className="aw-btn-secondary" disabled={!!busy} onClick={()=>runAction('stop')}><Square size={11}/>{busy==='stop'?'Stopping…':'Stop campaign'}</button>}
        {['draft','stopped'].includes(campaign.status)&&<button type="button" className="aw-btn-secondary aw-danger" disabled={!!busy} onClick={()=>runAction('delete')}><Trash2 size={12}/>{busy==='delete'?'Deleting…':'Delete'}</button>}
      </div>
    </div>

    {error&&<div className="aw-campaign-error" role="alert">{error}</div>}

    <section className="aw-campaign-detail-summary">
      <div className="aw-campaign-detail-title">
        <span className={'aw-campaign-status is-'+campaign.status}>{statusLabel(campaign.status)}</span>
        <span>{campaign.createdAt?`Created ${new Date(campaign.createdAt).toLocaleString()}`:''}</span>
      </div>
      <div className="aw-campaign-detail-metrics">
        <Metric label="Recipients" value={campaign.recipientCount||0} icon={Users}/>
        <Metric label="Provider queued" value={campaign.sentCount||0}/>
        <Metric label="Delivered" value={campaign.deliveredCount||0}/>
        <Metric label="Tracked opens" value={campaign.openedCount||0}/>
        <Metric label="Failed" value={campaign.failedCount||0}/>
      </div>
      <div className="aw-campaign-detail-progress">
        <div><span>Processing progress</span><strong>{progress}%</strong></div>
        <div className="aw-campaign-detail-progress-track"><span style={{width:progress+'%'}}/></div>
        <p>Up to {campaign.delivery?.batchSize||1} emails per batch · {formatDuration(campaign.delivery?.delaySeconds||0)} pause · provider acceptance is not inbox delivery.</p>
      </div>
    </section>

    <section className="aw-recipient-activity aw-recipient-activity-page">
      <div className="aw-recipient-activity-head"><strong>Recipient activity</strong><span>Open tracking is an estimate because some mail apps block or proxy images.</span></div>
      {recipients.length?<div className="aw-recipient-table"><div className="aw-recipient-table-row is-head"><span>Recipient</span><span>Status</span><span>Tracked opens</span><span>Last activity</span></div>{recipients.map(item=><div className="aw-recipient-table-row" key={item.id}><span><strong>{item.learnerName||'Recipient'}</strong><small>{item.email}</small></span><span data-status={recipientStatus(item).toLowerCase().replace(/\s+/g,'-')} title={item.errorCode||''}>{recipientStatus(item)}</span><span>{item.openCount||0}</span><span>{item.lastOpenedAt?new Date(item.lastOpenedAt).toLocaleString():item.sentAt?`Queued ${new Date(item.sentAt).toLocaleString()}`:'—'}</span></div>)}</div>:<div className="aw-muted-copy">No recipient activity is available yet.</div>}
    </section>
  </div>;
}
