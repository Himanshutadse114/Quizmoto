// Used by both direct readers and embedded public readers. Never silently
// claim a clipboard success or copy a link after the user cancels native share.
module.exports = `
const shareButton=document.getElementById('shareBtn');
const shareStatus=document.getElementById('shareStatus');
let shareFeedbackTimer=null;
const originalShareLabel=shareButton.innerHTML;
function shareFeedback(message,copied=false){
  if(shareFeedbackTimer)clearTimeout(shareFeedbackTimer);
  shareStatus.textContent=message;
  shareStatus.classList.add('is-visible');
  shareButton.innerHTML=copied?'<span class="label">Link copied</span>':originalShareLabel;
  shareButton.setAttribute('aria-label',copied?'Link copied':'Share publication');
  shareButton.title=copied?'Link copied':'Share';
  shareFeedbackTimer=setTimeout(()=>{
    shareStatus.classList.remove('is-visible');
    shareButton.innerHTML=originalShareLabel;
    shareButton.setAttribute('aria-label','Share publication');
    shareButton.title='Share';
  },3500);
}
async function copyPublicationLink(url){
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);return true}
  }catch(_){}
  const previous=document.activeElement;
  const field=document.createElement('textarea');
  field.value=url;
  field.setAttribute('readonly','');
  field.setAttribute('aria-label','Publication link');
  field.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(field);
  let copied=false;
  try{field.focus();field.select();copied=Boolean(document.execCommand('copy'))}catch(_){}
  field.remove();
  previous?.focus?.({preventScroll:true});
  return copied;
}
shareButton.onclick=async()=>{
  if(shareButton.disabled)return;
  shareButton.disabled=true;
  const url=DATA.shareUrl||location.href;
  const payload={title:DATA.title,url};
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare(payload))){
      try{await navigator.share(payload);shareFeedback('Publication shared.');return}
      catch(error){if(error?.name==='AbortError')return}
    }
    const copied=await copyPublicationLink(url);
    shareFeedback(copied?'Link copied':'Unable to copy the link. Copy the publication URL from your address bar.',copied);
  }catch(_){shareFeedback('Unable to share the publication. Please try again.')}
  finally{shareButton.disabled=false}
};
`;
