(function(global){
  const meta=typeof module!=='undefined'&&module.exports?require('./webqa-metadata'):global.FzgWebQaMeta;
  function validate(url,key){
    const parsed=new URL(String(url).trim());
    if(parsed.username||parsed.password||parsed.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]{30,}\/exec$/.test(parsed.pathname)||parsed.search||parsed.hash)throw Error('請貼新建 QA Web App 的完整 /exec 網址');
    if(meta.blockedUrls.includes(parsed.href))throw Error('這是既有正式部署，已阻擋連線；請使用新建 QA 部署');
    if(typeof key!=='string'||!/^[a-f0-9-]{72}$/i.test(key.trim()))throw Error('QA key 格式不符，請複製初始化結果的 qaKey');
    return {url:parsed.href,key:key.trim()};
  }
  function verifyCapabilities(data){
    if(!data||data.result!=='ok'||data.qaOnly!==true||data.qaProtocol!==meta.protocol||data.candidateSha256!==meta.candidateSha256||data.gatewaySha256!==meta.gatewaySha256||data.initialized!==true)throw Error('不是已初始化的本版 QA 部署，已停止連線');
    if(!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now())throw Error('QA key 已過期，請在 QA 編輯器重新產生測試連線');
  }
  function readConnection(){const raw=JSON.parse(sessionStorage.getItem('fzg_webqa_connection')||'null');if(!raw)throw Error('請先設定 QA 連線');return validate(raw.url,raw.key);}
  const api={validate,verifyCapabilities,readConnection};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.FzgWebQaConnection=api;
})(globalThis);
