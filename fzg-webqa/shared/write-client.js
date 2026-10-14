/* Write transport: validate application acknowledgements; never retry uncertain writes. */
let _writePending=0,_writeFailures=0,_writeSequence=0;
let _writeTail=Promise.resolve();
function _refreshWriteStatus(){
  const el=document.getElementById('syncStatus');if(!el)return;
  if(_writeFailures){el.textContent='⚠️ '+_writeFailures+'筆寫入未確認';el.style.color='var(--red)';return;}
  el.textContent=_writePending?'🔄 同步中（'+_writePending+'）':'✅ 已同步';el.style.color=_writePending?'var(--yellow)':'var(--green)';
}
function _showWriteFailure(error,options){
  let data;try{data=JSON.parse(options?.body||'{}');}catch(e){data={};}
  if(data.name){try{const p=JSON.parse(localStorage.getItem('fzg_pending_edits')||'{}');delete p[data.name];localStorage.setItem('fzg_pending_edits',JSON.stringify(p));}catch(e){}}
  let el=document.getElementById('writeFailureNotice');
  if(!el){el=document.createElement('div');el.id='writeFailureNotice';el.setAttribute('role','alert');el.style.cssText='max-width:1200px;margin:8px auto;padding:12px;border:1px solid var(--red);border-radius:8px;color:var(--red)';document.querySelector('header').after(el);}
  el.textContent='寫入未確認：'+error.message+'。畫面可能包含尚未儲存的變更；請先保留編輯內容，再重新載入核對。請勿直接重送新增或刪除。';
}
function writeRequest(url,options){
  const number=++_writeSequence;_writePending++;_refreshWriteStatus();
  const run=async()=>{
    try{
      const payload=options?.body?JSON.parse(options.body):null;
      const taskWrite=payload&&['update','delete','updateSort'].includes(payload.action);
      let requestOptions=options;
      if(taskWrite){
        if(typeof payload.id!=='string'||!payload.id.trim())throw new Error('任務缺少 ID，已停止寫入；請先確認 ID 資料');
        if(!/^(?:\d{4}\/(?:0?[1-9]|1[0-2])|未修正)$/.test(payload.month||''))throw new Error('任務缺少有效來源月份');
        const capabilityUrl=new URL(url,location.href);capabilityUrl.searchParams.set('action','capabilities');
        const capabilities=await FzgData.checkedJson(fetch,capabilityUrl.href,{method:'GET'});
        if(capabilities.safeTaskWrites!=='id-checked-v1')throw new Error('後端尚未支援 ID 核對寫入，已停止；需先完成相容部署');
        payload.protocol='id-checked-v1';delete payload.row;
        requestOptions={...options,body:JSON.stringify(payload)};
      }
      if(payload?.action==='moveTask'){
        if(payload.protocol!=='id-verified-v1'||!payload.id)throw new Error('搬移缺少任務 ID 或安全協定');
      }
      const data=await FzgData.checkedJson(fetch,url,requestOptions);
      if(taskWrite&&data.id!==payload.id)throw new Error('後端回覆的任務 ID 不一致，寫入結果未確認');
      return {ok:true,data,number};}
    catch(error){_writeFailures++;_showWriteFailure(error,options);return {ok:false,error,number};}
    finally{_writePending--;_refreshWriteStatus();}
  };
  const result=_writeTail.then(run,run);_writeTail=result.then(()=>undefined);return result;
}
