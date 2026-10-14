/* Direct browser fetch to isolated Web App, retaining real redirects/CORS behavior. */
(function(){
  const connection=FzgWebQaConnection.readConnection(),nativeFetch=window.fetch.bind(window);
  const empty='google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}});';
  window.fetch=async function(input,options={}){
    const url=new URL(input,location.href);
    if(url.origin==='https://docs.google.com'&&url.pathname.includes('/d/webqa-internal/')){
      const result=await FzgData.checkedJson(nativeFetch,connection.url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'qaRead',sheet:url.searchParams.get('sheet')||'',qaKey:connection.key}),signal:options.signal});
      if(typeof result.gviz!=='string')throw Error('QA read response missing data');
      return new Response(result.gviz,{status:200,headers:{'Content-Type':'text/plain'}});
    }
    if(url.origin==='https://docs.google.com'&&url.pathname.includes('/d/webqa-outsource/'))return new Response(empty,{status:200});
    if(url.href!==connection.url&&!(url.origin===new URL(connection.url).origin&&url.pathname===new URL(connection.url).pathname&&url.search==='?action=capabilities'))throw Error('QA 模式已阻擋非測試端點');
    if(options.method==='POST'){
      const payload=JSON.parse(options.body||'{}');
      return nativeFetch(url.href,{...options,body:JSON.stringify({...payload,qaKey:connection.key})});
    }
    if(url.searchParams.get('action')==='capabilities'){
      const data=await FzgData.checkedJson(nativeFetch,url.href,{method:'GET'});FzgWebQaConnection.verifyCapabilities(data);
      return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    }
    throw Error('QA 模式不支援此讀取操作');
  };
  const banner=document.createElement('div');banner.style.cssText='padding:12px;background:#563e16;color:#fff1c1;border:1px solid #e6b34c;border-radius:8px';banner.textContent='Google QA 連線模式：僅供新建假資料測試表。確認寫入後可重新整理驗證保存；管理密碼 demo。';document.body.prepend(banner);
})();
