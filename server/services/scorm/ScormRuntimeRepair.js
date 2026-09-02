const RUNTIME_REPAIR_SCRIPT_ID = 'quizmoto-runtime-api-repair-v1';

function runtimeRepairScript() {
    return `<script id="${RUNTIME_REPAIR_SCRIPT_ID}">
(function(){
  if(window.__quizmotoRuntimeApiRepairV1)return;
  window.__quizmotoRuntimeApiRepairV1=true;

  var cachedApi=null;

  function validApi(api){
    return !!(api&&typeof api.LMSInitialize==='function'&&typeof api.LMSSetValue==='function'&&typeof api.LMSCommit==='function');
  }

  function findApi(start){
    var current=start,hops=0;
    while(current&&hops<32){
      try{
        if(validApi(current.API))return current.API;
        if(!current.parent||current.parent===current)break;
        current=current.parent;
      }catch(e){break}
      hops++;
    }
    return null;
  }

  function resolveApi(){
    if(validApi(cachedApi))return cachedApi;
    var api=null;
    try{api=findApi(window)}catch(e){}
    if(!api){
      try{if(window.opener&&!window.opener.closed)api=findApi(window.opener)}catch(e){}
    }
    if(validApi(api))cachedApi=api;
    return validApi(api)?api:null;
  }

  function invoke(name,args,fallback){
    var api=resolveApi();
    if(!api||typeof api[name]!=='function')return fallback;
    try{return api[name].apply(api,args||[])}catch(e){
      cachedApi=null;
      api=resolveApi();
      if(!api||typeof api[name]!=='function')return fallback;
      try{return api[name].apply(api,args||[])}catch(ignore){return fallback}
    }
  }

  function asScormString(value,fallback){
    if(value===undefined||value===null)return fallback;
    return String(value);
  }

  window.doLMSInitialize=function(){return asScormString(invoke('LMSInitialize',[''],'false'),'false')};
  window.doLMSFinish=function(){return asScormString(invoke('LMSFinish',[''],'false'),'false')};
  window.doLMSGetValue=function(name){return asScormString(invoke('LMSGetValue',[String(name||'')],''),'')};
  window.doLMSSetValue=function(name,value){return asScormString(invoke('LMSSetValue',[String(name||''),String(value==null?'':value)],'false'),'false')};
  window.doLMSCommit=function(){return asScormString(invoke('LMSCommit',[''],'false'),'false')};
  window.doLMSGetLastError=function(){return asScormString(invoke('LMSGetLastError',[],'0'),'0')};
  window.doLMSGetErrorString=function(code){return asScormString(invoke('LMSGetErrorString',[String(code==null?'':code)],''),'')};
  window.doLMSGetDiagnostic=function(code){return asScormString(invoke('LMSGetDiagnostic',[String(code==null?'':code)],''),'')};

  window.__quizmotoScormRuntime={
    resolveApi:resolveApi,
    initialize:window.doLMSInitialize,
    finish:window.doLMSFinish,
    getValue:window.doLMSGetValue,
    setValue:window.doLMSSetValue,
    commit:window.doLMSCommit
  };
})();
</script>`;
}

function injectRuntimeRepair(source) {
    let html = String(source || '');
    if (!html || html.includes(RUNTIME_REPAIR_SCRIPT_ID)) return html;
    const script = runtimeRepairScript();
    const wrapperTag = /(<script\b[^>]*\bsrc=["'][^"']*scorm_api_wrapper\.js[^"']*["'][^>]*><\/script>)/i;
    if (wrapperTag.test(html)) return html.replace(wrapperTag, `$1\n${script}`);
    if (html.includes('</head>')) return html.replace('</head>', `${script}\n</head>`);
    return `${script}\n${html}`;
}

module.exports = {
    RUNTIME_REPAIR_SCRIPT_ID,
    runtimeRepairScript,
    injectRuntimeRepair
};
