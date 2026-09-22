import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Upload,
  UserPlus,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './awarenessEmailCampaigns.css';

const API='/api/scorm/awareness-gallery/email-campaigns';

function csvCell(value){
  const text=String(value??'');
  return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
function isValidEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim().toLowerCase())}
function manualToCsv(items){
  return [['Email','Name'].map(csvCell).join(','),...items.map(item=>[item.email,item.learnerName||''].map(csvCell).join(','))].join('\n');
}
function statusLabel(value){
  return {draft:'Draft',sending:'Sending',completed:'Completed',partial:'Partial',failed:'Failed',stopped:'Stopped'}[value]||value||'Draft';
}

export default function AwarenessEmailCampaigns({templates=[],mail={},onNotice}){
  const {token}=useAuth();
  const headers=useMemo(()=>({Authorization:`Bearer ${token}`}),[token]);
  const fileRef=useRef(null);
  const [campaigns,setCampaigns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [name,setName]=useState('');
  const [selectedTemplateId,setSelectedTemplateId]=useState('');
  const [entryMode,setEntryMode]=useState('csv');
  const [csvText,setCsvText]=useState('');
  const [csvName,setCsvName]=useState('');
  const [csvPreview,setCsvPreview]=useState(null);
  const [manualLearners,setManualLearners]=useState([]);
  const [manualName,setManualName]=useState('');
  const [manualEmail,setManualEmail]=useState('');
  const [batchCount,setBatchCount]=useState(5);
  const [batchDelay,setBatchDelay]=useState(60);

  const load=useCallback(async({showLoader=true}={})=>{
    if(!token)return;
    if(showLoader)setLoading(true);
    try{
      const res=await axios.get(apiUrl(API),{headers});
      setCampaigns(res.data?.campaigns||[]);
    }catch(err){
      setError(err.response?.data?.message||'Unable to load email campaigns.');
    }finally{if(showLoader)setLoading(false)}
  },[token,headers]);

  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(!campaigns.some(item=>item.status==='sending'))return undefined;
    const id=setInterval(()=>load({showLoader:false}),5000);
    return()=>clearInterval(id);
  },[campaigns,load]);

  const learnerCount=entryMode==='manual'?manualLearners.length:Number(csvPreview?.validLearners||0);
  const effectiveBatchCount=learnerCount?Math.min(Number(batchCount)||1,learnerCount):Number(batchCount)||1;
  const estimatedBatchSize=learnerCount?Math.ceil(learnerCount/effectiveBatchCount):0;
  const selectedTemplate=templates.find(item=>item.id===selectedTemplateId)||null;

  const readCsv=async(file)=>{
    if(!file)return;
    setError('');
    try{
      const text=await file.text();
      const res=await axios.post(apiUrl(API+'/preview-csv'),{csvText:text},{headers});
      setCsvText(text);setCsvName(file.name);setCsvPreview(res.data);
    }catch(err){
      setCsvText('');setCsvName('');setCsvPreview(null);
      setError(err.response?.data?.message||'Unable to read this CSV.');
    }
  };

  const addManual=(event)=>{
    event.preventDefault();setError('');
    const email=String(manualEmail||'').trim().toLowerCase();
    const learnerName=String(manualName||'').trim().slice(0,180);
    if(!isValidEmail(email))return setError('Enter a valid learner email address.');
    if(manualLearners.some(item=>item.email===email))return setError('This email has already been added.');
    setManualLearners(current=>[...current,{email,learnerName:learnerName||email.split('@')[0]}]);
    setManualEmail('');setManualName('');
  };

  const downloadCsv=()=>{
    const blob=new Blob(['Email,Name\nlearner1@company.com,Learner One\nlearner2@company.com,Learner Two\n'],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='email-campaign-recipients.csv';a.click();URL.revokeObjectURL(url);
  };

  const resetCreate=()=>{
    setCreating(false);setName('');setSelectedTemplateId('');setEntryMode('csv');setCsvText('');setCsvName('');setCsvPreview(null);setManualLearners([]);setManualName('');setManualEmail('');setBatchCount(5);setBatchDelay(60);setError('');
  };

  const createCampaign=async()=>{
    setError('');
    if(name.trim().length<2)return setError('Enter a campaign name.');
    if(!selectedTemplateId)return setError('Select a template from My Library.');
    if(!learnerCount)return setError(entryMode==='manual'?'Add at least one recipient.':'Upload a recipient CSV first.');
    setBusy('create');
    try{
      const recipientsCsv=entryMode==='manual'?manualToCsv(manualLearners):csvText;
      const res=await axios.post(apiUrl(API),{
        name:name.trim(),
        userTemplateId:selectedTemplateId,
        csvText:recipientsCsv,
        mailBatchCount:Number(batchCount)||5,
        mailBatchDelaySeconds:Number(batchDelay)||60
      },{headers});
      const campaign=res.data?.campaign;
      setCampaigns(current=>[campaign,...current]);
      resetCreate();
      onNotice?.({type:'success',text:`Email campaign “${campaign?.name||name.trim()}” created as a draft.`});
    }catch(err){setError(err.response?.data?.message||'Unable to create the email campaign.')}
    finally{setBusy('')}
  };

  const startCampaign=async(campaign)=>{
    if(!mail?.configured){
      setError('Outbound email is not configured. Verify SMTP or Brevo before starting the campaign.');
      return;
    }
    setBusy('start:'+campaign.id);setError('');
    try{
      const res=await axios.post(apiUrl(API+'/'+campaign.id+'/start'),{},{headers});
      setCampaigns(current=>current.map(item=>item.id===campaign.id?res.data.campaign:item));
      onNotice?.({type:'success',text:`Email campaign “${campaign.name}” started. Delivery is running in controlled batches.`});
    }catch(err){setError(err.response?.data?.message||'Unable to start the email campaign.')}
    finally{setBusy('')}
  };

  const stopCampaign=async(campaign)=>{
    if(!window.confirm(`Stop “${campaign.name}”? Recipients not yet processed will remain unsent.`))return;
    setBusy('stop:'+campaign.id);setError('');
    try{
      const res=await axios.post(apiUrl(API+'/'+campaign.id+'/stop'),{},{headers});
      setCampaigns(current=>current.map(item=>item.id===campaign.id?res.data.campaign:item));
    }catch(err){setError(err.response?.data?.message||'Unable to stop the email campaign.')}
    finally{setBusy('')}
  };

  const deleteCampaign=async(campaign)=>{
    if(!window.confirm(`Delete “${campaign.name}”? This cannot be undone.`))return;
    setBusy('delete:'+campaign.id);setError('');
    try{
      await axios.delete(apiUrl(API+'/'+campaign.id),{headers});
      setCampaigns(current=>current.filter(item=>item.id!==campaign.id));
    }catch(err){setError(err.response?.data?.message||'Unable to delete the email campaign.')}
    finally{setBusy('')}
  };

  if(creating){
    return <div className="aw-campaigns">
      <div className="aw-campaign-page-head">
        <div>
          <button type="button" className="aw-back" onClick={resetCreate}><ArrowLeft size={13}/> Email campaigns</button>
          <div className="aw-kicker"><Mail size={13}/> Campaign delivery</div>
          <h2>Create email campaign</h2>
          <p>Select a reusable My Library template, add recipients and prepare controlled email batches.</p>
        </div>
        <div className="aw-campaign-head-actions">
          <button type="button" className="aw-btn-secondary" onClick={resetCreate}>Cancel</button>
          <button type="button" className="aw-btn-primary" disabled={busy==='create'||!name.trim()||!learnerCount||!selectedTemplateId} onClick={createCampaign}><CheckCircle2 size={14}/>{busy==='create'?'Creating…':'Create draft campaign'}</button>
        </div>
      </div>
      {error&&<div className="aw-campaign-error">{error}</div>}
      <div className="aw-campaign-create-grid">
        <section className="aw-campaign-panel">
          <div className="aw-panel-title"><span>Campaign basics</span><h3>Who should receive this email?</h3></div>
          <label className="aw-campaign-field"><span>Campaign name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={180} placeholder="September Security Awareness"/></label>
          <div className="aw-entry-tabs">
            <button type="button" className={entryMode==='csv'?'is-active':''} onClick={()=>setEntryMode('csv')}><Upload size={13}/> Upload CSV</button>
            <button type="button" className={entryMode==='manual'?'is-active':''} onClick={()=>setEntryMode('manual')}><UserPlus size={13}/> Add manually</button>
          </div>
          {entryMode==='csv'?<div>
            <div className="aw-inline-between"><span>{learnerCount} recipient{learnerCount===1?'':'s'} ready</span><button type="button" className="aw-link-button" onClick={downloadCsv}><Download size={12}/> Download CSV template</button></div>
            <button type="button" className="aw-csv-zone" onClick={()=>fileRef.current?.click()}><Upload size={17}/><span><strong>{csvName||'Choose recipient CSV'}</strong><small>Required: Email · Optional: Name</small></span></button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e=>readCsv(e.target.files?.[0])}/>
            {csvPreview&&<div className="aw-csv-result">{csvPreview.validLearners} valid · {csvPreview.invalidRows?.length||0} invalid</div>}
          </div>:<div className="aw-manual-box">
            <form onSubmit={addManual} className="aw-manual-form">
              <label className="aw-campaign-field"><span>Name · optional</span><input value={manualName} onChange={e=>setManualName(e.target.value)} placeholder="Recipient name"/></label>
              <label className="aw-campaign-field"><span>Email</span><input type="email" value={manualEmail} onChange={e=>setManualEmail(e.target.value)} placeholder="person@company.com"/></label>
              <button type="submit" className="aw-btn-secondary"><UserPlus size={13}/> Add</button>
            </form>
            {manualLearners.length?<div className="aw-recipient-list">{manualLearners.map(item=><div key={item.email}><span><strong>{item.learnerName}</strong><small>{item.email}</small></span><button type="button" onClick={()=>setManualLearners(current=>current.filter(x=>x.email!==item.email))}><Trash2 size={12}/></button></div>)}</div>:<div className="aw-muted-copy">Add recipients one at a time.</div>}
          </div>}
          <div className="aw-batch-grid">
            <label className="aw-campaign-field"><span>Email batches</span><input type="number" min="1" max="50" value={batchCount} onChange={e=>setBatchCount(e.target.value)}/></label>
            <label className="aw-campaign-field"><span>Delay between batches · seconds</span><input type="number" min="15" max="3600" value={batchDelay} onChange={e=>setBatchDelay(e.target.value)}/></label>
          </div>
          <div className="aw-batch-summary"><Clock3 size={14}/><span>{learnerCount?effectiveBatchCount:batchCount} batch{Number(effectiveBatchCount||batchCount)===1?'':'es'} · about {estimatedBatchSize||0} recipient{estimatedBatchSize===1?'':'s'} per batch</span></div>
        </section>

        <section className="aw-campaign-panel">
          <div className="aw-panel-title"><span>Template</span><h3>What should recipients receive?</h3></div>
          {templates.length?<div className="aw-campaign-template-list">{templates.map(item=>{
            const selected=item.id===selectedTemplateId;
            return <button type="button" key={item.id} onClick={()=>setSelectedTemplateId(item.id)} className={selected?'is-selected':''}>
              <img src={item.thumbnailUrl||item.coverUrl||''} alt=""/>
              <span><strong>{item.title}</strong><small>{item.category||'Awareness'} · {item.subject}</small></span>
              <i>{selected?'Selected':'Select'}</i>
            </button>;
          })}</div>:<div className="aw-empty aw-campaign-empty"><Mail size={24}/><h3>No templates in My Library</h3><p>Add a template to My Library before creating an email campaign.</p></div>}
          {selectedTemplate&&<div className="aw-selected-template"><img src={selectedTemplate.thumbnailUrl||selectedTemplate.coverUrl||''} alt=""/><span><small>Selected template</small><strong>{selectedTemplate.title}</strong><em>{selectedTemplate.subject}</em></span></div>}
          <div className="aw-campaign-review">
            <div><span>Recipients</span><strong>{learnerCount}</strong></div>
            <div><span>Template</span><strong>{selectedTemplate?'1':'0'}</strong></div>
            <div><span>Mail provider</span><strong>{mail?.configured?String(mail.provider||'mail').toUpperCase():'Not configured'}</strong></div>
          </div>
        </section>
      </div>
    </div>;
  }

  return <div className="aw-campaigns">
    <div className="aw-campaign-page-head">
      <div>
        <div className="aw-kicker"><Send size={13}/> Email campaigns</div>
        <h2>Email campaigns</h2>
        <p>Create reusable recipient campaigns from templates already imported into My Library.</p>
      </div>
      <div className="aw-campaign-head-actions">
        <button type="button" className="aw-btn-secondary" onClick={()=>load()} disabled={loading}><RefreshCw size={13}/> Refresh</button>
        <button type="button" className="aw-btn-primary" onClick={()=>setCreating(true)} disabled={!templates.length}><Plus size={14}/> Create email campaign</button>
      </div>
    </div>
    {error&&<div className="aw-campaign-error">{error}</div>}
    {!mail?.configured&&<div className="aw-campaign-warning">Outbound mail is not configured. Draft campaigns can be prepared but cannot be started until SMTP or Brevo is ready.</div>}
    {loading?<div className="aw-campaign-loading">Loading email campaigns…</div>:campaigns.length?<div className="aw-campaign-list">{campaigns.map(campaign=>{
      const actionBusy=busy.endsWith(':'+campaign.id);
      const progress=campaign.recipientCount?Math.round((campaign.sentCount/campaign.recipientCount)*100):0;
      return <article key={campaign.id}>
        <div className="aw-campaign-main">
          <div className="aw-campaign-name"><strong>{campaign.name}</strong><span className={'aw-campaign-status is-'+campaign.status}>{statusLabel(campaign.status)}</span><small>{campaign.templateTitle}</small></div>
          <div><span>Recipients</span><strong><Users size={12}/>{campaign.recipientCount}</strong></div>
          <div><span>Accepted</span><strong>{campaign.sentCount}</strong></div>
          <div><span>Failed</span><strong>{campaign.failedCount}</strong></div>
          <div className="aw-campaign-progress"><span>Delivery</span><div><i style={{width:progress+'%'}}/></div><small>{progress}%</small></div>
        </div>
        <div className="aw-campaign-row-foot">
          <span>{campaign.delivery?.batchCount||1} batch{Number(campaign.delivery?.batchCount||1)===1?'':'es'} · {campaign.delivery?.delaySeconds||0}s delay</span>
          <div>
            {campaign.status==='draft'&&<button type="button" className="aw-btn-primary" disabled={actionBusy||!mail?.configured} onClick={()=>startCampaign(campaign)}><Play size={12}/>{actionBusy?'Starting…':'Start'}</button>}
            {campaign.status==='sending'&&<button type="button" className="aw-btn-secondary" disabled={actionBusy} onClick={()=>stopCampaign(campaign)}><Square size={11}/>{actionBusy?'Stopping…':'Stop'}</button>}
            {['draft','stopped'].includes(campaign.status)&&<button type="button" className="aw-btn-secondary aw-danger" disabled={actionBusy} onClick={()=>deleteCampaign(campaign)}><Trash2 size={12}/> Delete</button>}
          </div>
        </div>
      </article>;
    })}</div>:<div className="aw-empty aw-campaign-empty"><Send size={26}/><h3>No email campaigns yet</h3><p>Create a campaign using a template from My Library and a CSV or manually entered recipient list.</p>{templates.length?<button type="button" className="aw-btn-primary" onClick={()=>setCreating(true)}><Plus size={13}/> Create email campaign</button>:null}</div>}
  </div>;
}
