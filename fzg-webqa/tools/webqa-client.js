/* Direct browser fetch to isolated Web App, retaining real redirects/CORS behavior. */
(function(){
  const connection=FzgWebQaConnection.readConnection(),nativeFetch=window.fetch.bind(window);
  const empty='google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}});';
  const reads=new Map(),pending=new Map();let generation=0,writesInFlight=0;
  window.fetch=async function(input,options={}){
    const url=new URL(input,location.href);
    if(url.origin==='https://docs.google.com'&&url.pathname.includes('/d/webqa-internal/')){
      const sheet=url.searchParams.get('sheet')||'',cached=reads.get(sheet);
      if(cached&&Date.now()-cached.time<30000)return new Response(cached.gviz,{status:200,headers:{'Content-Type':'text/plain'}});
      let request=pending.get(sheet);
      if(!request){
        const started=generation;
        request=FzgData.checkedJson(nativeFetch,connection.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'qaRead',sheet,qaKey:connection.key}),signal:options.signal}).then(result=>{
          if(typeof result.gviz!=='string')throw Error('QA read response missing data');
          if(started===generation&&!writesInFlight)reads.set(sheet,{gviz:result.gviz,time:Date.now()});
          return result;
        }).finally(()=>{if(pending.get(sheet)===request)pending.delete(sheet)});
        pending.set(sheet,request);
      }
      const result=await request;
      return new Response(result.gviz,{status:200,headers:{'Content-Type':'text/plain'}});
    }
    if(url.origin==='https://docs.google.com'&&url.pathname.includes('/d/webqa-outsource/'))return new Response(empty,{status:200});
    if(url.href!==connection.url&&!(url.origin===new URL(connection.url).origin&&url.pathname===new URL(connection.url).pathname&&url.search==='?action=capabilities'))throw Error('QA 模式已阻擋非測試端點');
    if(options.method==='POST'){
      const payload=JSON.parse(options.body||'{}');
      generation++;reads.clear();pending.clear();writesInFlight++;
      try{return await nativeFetch(url.href,{...options,body:JSON.stringify({...payload,qaKey:connection.key})});}
      finally{writesInFlight--;generation++;reads.clear();pending.clear();}
    }
    if(url.searchParams.get('action')==='capabilities'){
      const data=await FzgData.checkedJson(nativeFetch,url.href,{method:'GET'});FzgWebQaConnection.verifyCapabilities(data);
      return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    }
    throw Error('QA 模式不支援此讀取操作');
  };
  const banner=document.createElement('div');banner.style.cssText='padding:12px;background:#563e16;color:#fff1c1;border:1px solid #e6b34c;border-radius:8px';banner.textContent='Google QA 連線模式：僅供假資料。月份讀取暫存 30 秒；任何寫入會清除暫存。重新整理可直接讀取最新資料；管理密碼 demo。';document.body.prepend(banner);
})();
