import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  Image as ImageIcon,
  Library,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './awarenessTemplates.css';

const API='/api/scorm/awareness-gallery';

function apiError(error,fallback){
  return error?.response?.data?.message||error?.message||fallback;
}
function validRecipients(value){
  return [...new Set(String(value||'').split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];
}
function Notice({notice,onClose}){
  if(!notice)return null;
  return <div className={'aw-gallery-notice '+(notice.type==='error'?'is-error':'is-success')}>
    <span>{notice.text}</span><button type="button" onClick={onClose}><X size={14}/></button>
  </div>;
}
function Card({template,central,onPreview,onImport,onEdit,onDelete,onArchive,onThumbnail,onSend,onExport,imported}){
  return <article className={'aw-template-card '+(!template.isActive&&central?'is-inactive':'')}>
    <button type="button" className="aw-card-preview" onClick={()=>onPreview?.(template)}>
      {template.thumbnailUrl||template.coverUrl?<img src={template.thumbnailUrl||template.coverUrl} alt={template.title+' thumbnail'}/>:<div className="aw-card-placeholder"><Mail size={28}/></div>}
      <span className="aw-card-category">{template.category||'Awareness'}</span>
      {central&&!template.isActive&&<span className="aw-card-hidden">Hidden</span>}
    </button>
    <div className="aw-card-body">
      <h3>{template.title}</h3>
      <p>{template.description||'Curated awareness email template ready to use.'}</p>
      <div className="aw-card-meta">
        {central?<span>{template.assetCount||0} template image{template.assetCount===1?'':'s'}</span>:<span>{template.lastSentAt?'Previously sent':'Ready to use'}</span>}
      </div>
      <div className="aw-card-actions">
        <button type="button" className="aw-btn-secondary" onClick={()=>onPreview?.(template)}><Eye size={14}/> Preview</button>
        {central?<>
          {template.isActive&&<button type="button" className="aw-btn-primary" onClick={()=>onImport(template)}><Plus size={14}/> {imported?'Add another copy':'Add to My Library'}</button>}
          {onThumbnail&&<label className="aw-icon-btn aw-file-icon" title="Upload thumbnail"><ImageIcon size={14}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{onThumbnail(template,e.target.files?.[0]);e.target.value=''}}/></label>}
          {onArchive&&<button type="button" className="aw-icon-btn" title={template.isActive?'Hide from users':'Restore to gallery'} onClick={()=>onArchive(template)}><Archive size={14}/></button>}
        </>:<>
          <button type="button" className="aw-btn-primary" onClick={()=>onEdit(template)}><Pencil size={14}/> Edit</button>
          <button type="button" className="aw-btn-secondary" onClick={()=>onSend(template)}><Send size={14}/> Send</button>
          <button type="button" className="aw-btn-secondary" onClick={()=>onExport(template)}><Download size={14}/> Export</button>
          <button type="button" className="aw-icon-btn is-danger" title="Delete" onClick={()=>onDelete(template)}><Trash2 size={14}/></button>
        </>}
      </div>
    </div>
  </article>;
}

export default function AwarenessTemplates(){
  const {token,user}=useAuth();
  const headers=useMemo(()=>({Authorization:'Bearer '+token}),[token]);
  const isSuperAdmin=Boolean(user?.isSuperAdmin||user?.role==='super_admin');

  const [tab,setTab]=useState('gallery');
  const [central,setCentral]=useState([]);
  const [mine,setMine]=useState([]);
  const [status,setStatus]=useState({mail:{configured:false,provider:null},maxRecipientsPerSend:50});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState(null);
  const [search,setSearch]=useState('');
  const [preview,setPreview]=useState(null);
  const [editor,setEditor]=useState(null);
  const [title,setTitle]=useState('');
  const [subject,setSubject]=useState('');
  const [selectedImage,setSelectedImage]=useState(null);
  const [sendOpen,setSendOpen]=useState(false);
  const [sendTarget,setSendTarget]=useState(null);
  const [recipients,setRecipients]=useState('');
  const [roster,setRoster]=useState([]);
  const [rosterLoading,setRosterLoading]=useState(false);
  const [mailDiagnostic,setMailDiagnostic]=useState(null);
  const [uploading,setUploading]=useState(false);
  const frameRef=useRef(null);
  const seedRepairAttempted=useRef(false);

  const load=useCallback(async()=>{
    if(!token)return;
    setLoading(true);
    try{
      const centralUrl=API+'/central'+(isSuperAdmin?'?includeInactive=1':'');
      const [s,c,m]=await Promise.all([
        axios.get(apiUrl(API+'/status'),{headers}),
        axios.get(apiUrl(centralUrl),{headers}),
        axios.get(apiUrl(API+'/mine'),{headers})
      ]);
      let centralTemplates=c.data?.templates||[];
      if(isSuperAdmin&&!centralTemplates.length&&!seedRepairAttempted.current){
        seedRepairAttempted.current=true;
        try{
          const seeded=await axios.post(apiUrl(API+'/central/seed'),{},{headers});
          centralTemplates=seeded.data?.templates||centralTemplates;
          if(centralTemplates.length){
            setNotice({type:'success',text:'The 8 bundled reference templates were restored to the Central Gallery.'});
          }
        }catch(seedError){
          setNotice({type:'error',text:apiError(seedError,'The bundled reference templates could not be restored automatically.')});
        }
      }
      setStatus(s.data||{});
      setCentral(centralTemplates);
      setMine(m.data?.templates||[]);
    }catch(error){
      setNotice({type:'error',text:apiError(error,'Unable to load awareness templates.')});
    }finally{setLoading(false)}
  },[token,headers,isSuperAdmin]);

  useEffect(()=>{load()},[load]);

  const filteredCentral=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return central;
    return central.filter(item=>[item.title,item.category,item.description].join(' ').toLowerCase().includes(q));
  },[central,search]);

  const previewCentral=async(item)=>{
    setBusy('preview');
    try{
      const res=await axios.get(apiUrl(API+'/central/'+item.id),{headers});
      setPreview({kind:'central',...res.data.template});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to preview the template.')})}
    finally{setBusy('')}
  };

  const previewMine=async(item)=>{
    setBusy('preview');
    try{
      const res=await axios.get(apiUrl(API+'/mine/'+item.id),{headers});
      setPreview({kind:'mine',...res.data.template});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to preview the template.')})}
    finally{setBusy('')}
  };

  const importTemplate=async(item)=>{
    setBusy('import:'+item.id);setNotice(null);
    try{
      const res=await axios.post(apiUrl(API+'/central/'+item.id+'/import'),{},{headers});
      const imported=res.data?.template;
      if(imported)setMine(current=>[imported,...current]);
      setNotice({type:'success',text:'Template added to My Library. You can now preview, edit, send or export it.'});
      setEditor(null);
      setTab('mine');
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to add this template to My Library.')})}
    finally{setBusy('')}
  };

  const openEditor=async(item)=>{
    setBusy('edit');
    try{
      const res=item?.html?{data:{template:item}}:await axios.get(apiUrl(API+'/mine/'+item.id),{headers});
      const next=res.data?.template;
      setEditor(next);
      setTitle(next?.title||'');
      setSubject(next?.subject||'');
      setSelectedImage(null);
      setSendOpen(false);
      setSendTarget(null);
      setRecipients('');
      setPreview(null);
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to open this template.')})}
    finally{setBusy('')}
  };

  const decorateEditor=(doc)=>{
    if(!doc?.body)return;
    doc.body.removeAttribute('contenteditable');
    let style=doc.getElementById('awareness-editor-helper');
    if(!style){
      style=doc.createElement('style');
      style.id='awareness-editor-helper';
      style.textContent='body{cursor:default} img{cursor:pointer} img[data-awareness-selected="1"]{outline:4px solid #14b8a6!important;outline-offset:3px!important}[data-awareness-text-selected="1"]{outline:2px dashed #14b8a6!important;outline-offset:2px!important;cursor:text!important} a{cursor:text!important}';
      doc.head?.appendChild(style);
    }
    const clearSelection=()=>{
      doc.querySelectorAll('[data-awareness-selected]').forEach(el=>el.removeAttribute('data-awareness-selected'));
      doc.querySelectorAll('[data-awareness-text-selected]').forEach(el=>{
        el.removeAttribute('data-awareness-text-selected');
        el.removeAttribute('contenteditable');
      });
    };
    doc.querySelectorAll('a').forEach(a=>{a.onclick=(event)=>event.preventDefault()});
    doc.onpaste=(event)=>{
      const active=doc.activeElement;
      if(active?.getAttribute?.('data-awareness-text-selected')!=='1')return;
      event.preventDefault();
      const plain=event.clipboardData?.getData('text/plain')||'';
      doc.execCommand?.('insertText',false,plain);
    };
    doc.onclick=(event)=>{
      const target=event.target;
      clearSelection();
      if(target?.tagName==='IMG'){
        event.preventDefault();
        target.setAttribute('data-awareness-selected','1');
        setSelectedImage({src:target.getAttribute('src')||'',alt:target.getAttribute('alt')||''});
        return;
      }
      setSelectedImage(null);
      const editable=target?.closest?.('p,h1,h2,h3,h4,h5,h6,span,td,th,li,a,strong,b,em,i,div');
      if(!editable||editable===doc.body||!String(editable.textContent||'').trim())return;
      editable.setAttribute('contenteditable','true');
      editable.setAttribute('data-awareness-text-selected','1');
      editable.focus();
    };
  };

  const serializeEditor=()=>{
    const doc=frameRef.current?.contentDocument;
    if(!doc)return editor?.html||'';
    doc.getElementById('awareness-editor-helper')?.remove();
    doc.querySelectorAll('[data-awareness-selected]').forEach(el=>el.removeAttribute('data-awareness-selected'));
    doc.querySelectorAll('[data-awareness-text-selected]').forEach(el=>{
      el.removeAttribute('data-awareness-text-selected');
      el.removeAttribute('contenteditable');
    });
    doc.body?.removeAttribute('contenteditable');
    const html='<!doctype html>\n'+doc.documentElement.outerHTML;
    decorateEditor(doc);
    return html;
  };

  const persistEditor=async()=>{
    if(!editor)return null;
    const res=await axios.put(apiUrl(API+'/mine/'+editor.id),{
      title,subject,html:serializeEditor()
    },{headers});
    const saved=res.data?.template;
    if(saved){
      setEditor(saved);
      setTitle(saved.title||'');
      setSubject(saved.subject||'');
      setMine(current=>current.map(item=>item.id===saved.id?{...item,...saved}:item));
    }
    return saved;
  };

  const saveEditor=async()=>{
    if(!editor)return;
    setBusy('save');setNotice(null);
    try{
      await persistEditor();
      setNotice({type:'success',text:'Your template copy has been saved.'});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to save the template.')})}
    finally{setBusy('')}
  };

  const replaceImage=async(file)=>{
    if(!editor||!selectedImage?.src||!file)return;
    if(file.size>8*1024*1024){setNotice({type:'error',text:'Choose an image smaller than 8 MB.'});return}
    setBusy('image');setNotice(null);
    try{
      // Save any in-place text edits before replacing an image so the iframe
      // cannot be refreshed from an older server copy and lose the user's work.
      await persistEditor();
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      const res=await axios.post(apiUrl(API+'/mine/'+editor.id+'/image'),{oldSrc:selectedImage.src,dataUrl},{headers});
      const next=res.data?.template;
      setEditor(next);
      setMine(current=>current.map(item=>item.id===next.id?{...item,...next}:item));
      setSelectedImage(null);
      setNotice({type:'success',text:'Image replaced and stored in your template library.'});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to replace the image.')})}
    finally{setBusy('')}
  };

  const removeSelectedImage=()=>{
    const doc=frameRef.current?.contentDocument;
    const img=doc?.querySelector('img[data-awareness-selected="1"]');
    if(img){img.remove();setSelectedImage(null);setNotice({type:'success',text:'Image removed. Save the template to keep this change.'})}
  };

  const deleteMine=async(item)=>{
    if(!window.confirm('Delete “'+item.title+'” from My Library?'))return;
    try{
      await axios.delete(apiUrl(API+'/mine/'+item.id),{headers});
      setMine(current=>current.filter(x=>x.id!==item.id));
      if(editor?.id===item.id)setEditor(null);
      setNotice({type:'success',text:'Template removed from My Library.'});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to delete the template.')})}
  };

  const uploadThumbnail=async(item,file)=>{
    if(!item||!file)return;
    if(file.size>8*1024*1024){setNotice({type:'error',text:'Choose a thumbnail smaller than 8 MB.'});return}
    setBusy('thumbnail:'+item.id);setNotice(null);
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      const res=await axios.post(apiUrl(API+'/central/'+item.id+'/thumbnail'),{dataUrl},{headers});
      const next=res.data?.template;
      if(next)setCentral(current=>current.map(x=>x.id===next.id?next:x));
      setNotice({type:'success',text:'Thumbnail updated. It is automatically cropped to 16:9.'});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to update the thumbnail.')})}
    finally{setBusy('')}
  };

  const archiveCentral=async(item)=>{
    setBusy('archive:'+item.id);
    try{
      const res=await axios.patch(apiUrl(API+'/central/'+item.id),{isActive:!item.isActive},{headers});
      setCentral(current=>current.map(x=>x.id===item.id?res.data.template:x));
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to update the gallery item.')})}
    finally{setBusy('')}
  };

  const exportMine=async(item=editor)=>{
    if(!item)return;
    setBusy('export');
    try{
      if(editor?.id===item.id)await persistEditor();
      const res=await axios.post(apiUrl(API+'/mine/'+item.id+'/export-eml'),{},{headers,responseType:'blob'});
      const disposition=res.headers?.['content-disposition']||'';
      const match=disposition.match(/filename="?([^";]+)"?/i);
      const url=URL.createObjectURL(new Blob([res.data],{type:'message/rfc822'}));
      const a=document.createElement('a');a.href=url;a.download=match?.[1]||'awareness-template.eml';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      setNotice({type:'success',text:'EML exported with the template images embedded.'});
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to export the template.')})}
    finally{setBusy('')}
  };

  const loadRoster=async()=>{
    if(rosterLoading||roster.length)return;
    setRosterLoading(true);
    try{const res=await axios.get(apiUrl('/api/scorm/roster'),{headers});setRoster(res.data?.roster||[])}
    catch(_){setRoster([])}
    finally{setRosterLoading(false)}
  };
  const openSend=(item=editor)=>{
    if(!item)return;
    setSendTarget(item);
    setRecipients('');
    setMailDiagnostic(null);
    setSendOpen(true);
    loadRoster();
  };
  const addRoster=email=>{
    const list=recipients.split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    setRecipients([...new Set([...list,String(email||'').toLowerCase()])].slice(0,status.maxRecipientsPerSend||50).join(', '));
  };
  const verifyMailProvider=async()=>{
    setBusy('mail-verify');setMailDiagnostic(null);
    try{
      const res=await axios.post(apiUrl(API+'/mail/verify'),{},{headers});
      const result=res.data?.result||{};
      setMailDiagnostic({
        type:'success',
        text:(result.provider?String(result.provider).toUpperCase():'Mail provider')+' connection verified successfully.'
      });
    }catch(error){
      setMailDiagnostic({type:'error',text:apiError(error,'Mail provider verification failed.')});
    }finally{setBusy('')}
  };

  const sendPlainTest=async()=>{
    const valid=validRecipients(recipients);
    if(!valid.length)return;
    setBusy('mail-test');setMailDiagnostic(null);
    try{
      const res=await axios.post(apiUrl(API+'/mail/test'),{to:valid[0]},{headers});
      const result=res.data?.result||{};
      setMailDiagnostic({
        type:'success',
        text:(result.provider==='brevo'?'Brevo queued':'SMTP accepted')+' the plain test email for '+valid[0]+
          (result.messageId?' · ID '+result.messageId:'')+
          '. Check Inbox and Spam. This confirms provider acceptance, not final inbox delivery.'
      });
    }catch(error){
      setMailDiagnostic({type:'error',text:apiError(error,'Plain test email was not accepted by the mail provider.')});
    }finally{setBusy('')}
  };

  const sendMail=async()=>{
    const target=sendTarget||editor;
    const valid=validRecipients(recipients);
    if(!target||!valid.length)return;
    if(!status.mail?.configured){
      setNotice({type:'error',text:'Outbound email is not configured on the platform. Configure SMTP or Brevo in the deployment settings, then try again.'});
      return;
    }
    setBusy('send');setNotice(null);
    try{
      if(editor?.id===target.id)await persistEditor();
      const res=await axios.post(apiUrl(API+'/mine/'+target.id+'/send'),{recipients:valid},{headers});
      const d=res.data?.delivery||{};
      const first=d.results?.find?.(x=>x.sent);
      const provider=String(d.provider||first?.provider||status.mail?.provider||'mail').toUpperCase();
      const acceptedText=d.failed
        ? (d.sent+' accepted, '+d.failed+' failed.')
        : (provider==='BREVO'
            ? d.sent+' email'+(d.sent===1?'':'s')+' queued by Brevo for delivery.'
            : d.sent+' email'+(d.sent===1?'':'s')+' accepted by the SMTP server for delivery.');
      setNotice({
        type:d.failed?'error':'success',
        text:acceptedText+
          (first?.messageId?' Message ID: '+first.messageId+'.':'')+
          (!d.failed?' Provider acceptance does not guarantee Inbox placement; check Spam/Junk if it does not appear.':'')
      });
      if(!d.failed){
        setMine(current=>current.map(x=>x.id===target.id?{...x,lastSentAt:new Date().toISOString()}:x));
        setSendOpen(false);setSendTarget(null);setRecipients('');
      }
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to send the template.')})}
    finally{setBusy('')}
  };

  const restoreReferenceTemplates=async()=>{
    if(!isSuperAdmin)return;
    setBusy('seed');setNotice(null);
    try{
      const res=await axios.post(apiUrl(API+'/central/seed'),{},{headers});
      const templates=res.data?.templates||[];
      setCentral(templates);
      seedRepairAttempted.current=true;
      const seeded=Number(res.data?.seeded||0);
      setNotice({
        type:'success',
        text:seeded
          ? seeded+' reference template'+(seeded===1?'':'s')+' restored to the Central Gallery.'
          : templates.length+' reference template'+(templates.length===1?' is':'s are')+' available in the Central Gallery.'
      });
    }catch(error){
      setNotice({type:'error',text:apiError(error,'Unable to restore the 8 bundled reference templates.')});
    }finally{setBusy('')}
  };

  const uploadZip=async(file)=>{
    if(!file)return;
    if(!/\.zip$/i.test(file.name)){setNotice({type:'error',text:'Choose a ZIP file containing the HTML template and images folder.'});return}
    if(file.size>35*1024*1024){setNotice({type:'error',text:'ZIP files must be 35 MB or smaller.'});return}
    setUploading(true);setNotice(null);
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      const zipBase64=String(dataUrl).split(',')[1]||'';
      const res=await axios.post(apiUrl(API+'/central/upload'),{zipBase64,fileName:file.name},{headers});
      const count=res.data?.imported?.length||0;
      setNotice({type:'success',text:count+' template'+(count===1?'':'s')+' added to the Central Library.'+(res.data?.warnings?.length?' Some assets produced warnings.':'')});
      await load();
    }catch(error){setNotice({type:'error',text:apiError(error,'Unable to import the ZIP.')})}
    finally{setUploading(false)}
  };

  const recipientCount=useMemo(()=>validRecipients(recipients).length,[recipients]);

  if(loading)return <div className="aw-loading"><RefreshCw className="animate-spin" size={20}/> Loading awareness template library…</div>;

  return <div className="aw-gallery-page">
    <header className="aw-gallery-header">
      <div><div className="aw-kicker"><Mail size={15}/> Awareness Emails</div><h1>Curated awareness template library</h1><p>Use professionally designed email templates without regenerating the design. Add a template to My Library before editing, sending or exporting it.</p></div>
      <button type="button" className="aw-btn-secondary" onClick={load}><RefreshCw size={14}/> Refresh</button>
    </header>
    <Notice notice={notice} onClose={()=>setNotice(null)}/>

    <div className="aw-tabs">
      <button className={tab==='gallery'?'is-active':''} onClick={()=>{setTab('gallery');setEditor(null)}}><Library size={15}/> Template Gallery <span>{central.filter(x=>x.isActive).length}</span></button>
      <button className={tab==='mine'?'is-active':''} onClick={()=>{setTab('mine');setEditor(null)}}><CheckCircle2 size={15}/> My Library <span>{mine.length}</span></button>
    </div>

    {tab==='gallery'&&<section>
      {isSuperAdmin&&<div className="aw-admin-upload">
        <div><strong>Central Library Manager</strong><span>Recommended ZIP: one folder per template with <b>email.html</b>, <b>thumbnail.jpg</b> and an <b>images/</b> folder. Thumbnail should be 16:9 such as 1200×675. If omitted, LMSGEN creates one from the first template image.</span></div>
        <div className="aw-admin-actions">
          <button type="button" className="aw-btn-secondary" onClick={restoreReferenceTemplates} disabled={busy==='seed'}><RefreshCw size={14}/>{busy==='seed'?'Restoring…':'Restore 8 References'}</button>
          <label className={'aw-btn-primary '+(uploading?'is-disabled':'')}><Upload size={15}/>{uploading?'Importing ZIP…':'Add Template ZIP'}<input type="file" accept=".zip,application/zip" disabled={uploading} onChange={e=>{uploadZip(e.target.files?.[0]);e.target.value=''}}/></label>
        </div>
      </div>}
      <div className="aw-gallery-tools"><div className="aw-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search templates or categories"/></div><span>{filteredCentral.length} template{filteredCentral.length===1?'':'s'}</span></div>
      <div className="aw-template-grid">
        {filteredCentral.map(item=><Card key={item.id} template={item} central onPreview={previewCentral} onImport={importTemplate} onThumbnail={isSuperAdmin?uploadThumbnail:null} onArchive={isSuperAdmin?archiveCentral:null} imported={mine.some(x=>x.centralTemplateId===item.id)}/>)}
      </div>
      {!filteredCentral.length&&<div className="aw-empty"><Library size={26}/><h2>{search?'No matching templates':'No templates in the Central Gallery'}</h2><p>{search?'Try another search term.':'Restore the 8 bundled reference templates or upload a template ZIP.'}</p>{isSuperAdmin&&!search&&<button className="aw-btn-primary" onClick={restoreReferenceTemplates} disabled={busy==='seed'}><RefreshCw size={14}/> Restore 8 Reference Templates</button>}</div>}
    </section>}

    {tab==='mine'&&!editor&&<section>
      <div className="aw-section-copy"><h2>My Library</h2><p>These are your editable copies. Sending and EML export are available only here.</p></div>
      {mine.length?<div className="aw-template-grid">{mine.map(item=><Card key={item.id} template={item} onPreview={previewMine} onEdit={openEditor} onSend={openSend} onExport={exportMine} onDelete={deleteMine}/>)}</div>:<div className="aw-empty"><Library size={30}/><h2>Your library is empty</h2><p>Choose a template from the gallery and add it here first.</p><button className="aw-btn-primary" onClick={()=>setTab('gallery')}><Plus size={14}/> Browse Template Gallery</button></div>}
    </section>}

    {tab==='mine'&&editor&&<section className="aw-editor">
      <div className="aw-editor-head">
        <div><button className="aw-back" onClick={()=>{setEditor(null);setSelectedImage(null)}}>← My Library</button><h2>{title||editor.title}</h2><p>Edit the email directly. Click any text and type. Click an image to replace or remove it.</p></div>
        <div className="aw-editor-actions"><button className="aw-btn-secondary" onClick={()=>exportMine()} disabled={!!busy}><Download size={14}/> Export EML</button><button className="aw-btn-secondary" onClick={()=>openSend(editor)} disabled={!!busy}><Send size={14}/> Send</button><button className="aw-btn-primary" onClick={saveEditor} disabled={!!busy}><Save size={14}/> {busy==='save'?'Saving…':'Save'}</button></div>
      </div>
      <div className="aw-editor-fields"><label><span>Template name</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180}/></label><label><span>Email subject</span><input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={240}/></label></div>
      {selectedImage&&<div className="aw-image-toolbar"><ImageIcon size={15}/><div><strong>Image selected</strong><span>{selectedImage.alt||'Template image'}</span></div><label className="aw-btn-primary"><ImageIcon size={14}/> Replace image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{replaceImage(e.target.files?.[0]);e.target.value=''}}/></label><button className="aw-btn-secondary" onClick={removeSelectedImage}><Trash2 size={14}/> Remove</button></div>}

      <div className="aw-editor-note"><Pencil size={14}/> Click a text block to edit only that text. Click an image to replace or remove it. The layout structure stays protected.</div>
      <div className="aw-editor-frame"><iframe ref={frameRef} title="Editable awareness email" srcDoc={editor.html} onLoad={e=>decorateEditor(e.currentTarget.contentDocument)}/></div>
    </section>}

    {sendOpen&&sendTarget&&<div className="aw-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSendOpen(false);setSendTarget(null)}}}>
      <div className="aw-send-modal">
        <div className="aw-preview-head"><div><span>My Library · Send</span><h2>{sendTarget.title}</h2></div><button onClick={()=>{setSendOpen(false);setSendTarget(null)}}><X size={18}/></button></div>
        <div className="aw-send-modal-body">
          <div className={'aw-mail-status '+(status.mail?.configured?'is-ready':'is-missing')}>
            <strong>{status.mail?.configured?'Mail ready':'Mail setup required'}</strong>
            <span>{status.mail?.configured
              ? 'Using '+String(status.mail?.provider||'mail').toUpperCase()+
                (status.mail?.fromAddress?' from '+status.mail.fromAddress:'')+
                '. Each recipient is submitted separately for privacy.'
              : 'SMTP or Brevo is not configured. You can enter recipients now, but delivery requires the platform mail settings.'}</span>
          </div>
          <label className="aw-send-field"><span>Recipients</span><textarea value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="alex@example.com, sam@example.com"/></label>
          <label className="aw-send-field"><span>Add from learner roster</span><select value="" onChange={e=>addRoster(e.target.value)} disabled={!roster.length}><option value="">{rosterLoading?'Loading roster…':roster.length?'Choose a learner…':'No roster learners loaded'}</option>{roster.map(x=><option key={x.id||x.email} value={x.email}>{x.learnerName?x.learnerName+' — '+x.email:x.email}</option>)}</select></label>
          <div className="aw-send-summary"><span>{recipientCount} valid recipient{recipientCount===1?'':'s'}</span><span>Maximum {status.maxRecipientsPerSend||50}</span></div>
          <div className="aw-mail-diagnostic-actions">
            <button type="button" className="aw-btn-secondary" onClick={verifyMailProvider} disabled={!status.mail?.configured||busy==='mail-verify'}><RefreshCw size={13}/>{busy==='mail-verify'?'Verifying…':'Verify provider'}</button>
            <button type="button" className="aw-btn-secondary" onClick={sendPlainTest} disabled={!status.mail?.configured||!recipientCount||busy==='mail-test'}><Mail size={13}/>{busy==='mail-test'?'Submitting test…':'Send plain test'}</button>
          </div>
          {mailDiagnostic&&<div className={'aw-mail-diagnostic '+(mailDiagnostic.type==='error'?'is-error':'is-success')}>{mailDiagnostic.text}</div>}
        </div>
        <div className="aw-preview-footer">
          <button className="aw-btn-secondary" onClick={()=>{setSendOpen(false);setSendTarget(null)}}>Cancel</button>
          <button className="aw-btn-primary" onClick={sendMail} disabled={!recipientCount||busy==='send'}><Send size={14}/>{busy==='send'?'Sending…':'Send email'}</button>
        </div>
      </div>
    </div>}

    {preview&&<div className="aw-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPreview(null)}}>
      <div className="aw-preview-modal"><div className="aw-preview-head"><div><span>{preview.kind==='central'?'Template Gallery':'My Library'}</span><h2>{preview.title}</h2></div><button onClick={()=>setPreview(null)}><X size={18}/></button></div><iframe title={preview.title} sandbox="allow-same-origin" srcDoc={preview.html}/>{preview.kind==='central'&&preview.isActive&&<div className="aw-preview-footer"><button className="aw-btn-primary" onClick={()=>{const p=preview;setPreview(null);importTemplate(p)}}><Plus size={14}/> Add to My Library</button></div>}</div>
    </div>}
  </div>;
}