(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FzgData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function dateKey(value){
    const match=String(value??'').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/);
    if(!match)return '';
    const [y,m,d]=match.slice(1).map(Number),date=new Date(Date.UTC(y,m-1,d));
    if(y<100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return '';
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function todayKey(now=new Date()){
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  function monthKey(value){const d=dateKey(value);return d?d.slice(0,7).replace('-','/'):'';}
  function dayNumber(value){const d=dateKey(value);return d?Date.parse(d+'T00:00:00Z')/86400000:null;}
  function calendarDays(start,end){const a=dayNumber(start),b=dayNumber(end);return a===null||b===null||b<a?0:b-a+1;}
  function overlapsMonth(row,month){
    const start=dateKey(row['開始日']),end=dateKey(row['截止日']);
    if(!start&&!end)return null;
    const lo=(start||end).slice(0,7),hi=(end||start).slice(0,7),key=month.replace('/','-');
    return lo<=key&&hi>=key;
  }
  function inspectMonth(rows,month){
    if(!/^\d{4}\/(0[1-9]|1[0-2])$/.test(month))return {state:'unverified',message:'來源月份無法確認'};
    if(!rows.length)return {state:'empty',message:''};
    const known=rows.map(r=>overlapsMonth(r,month)).filter(v=>v!==null);
    if(!known.length)return {state:'unverified',message:'資料沒有可辨識日期，來源月份尚未確認'};
    if(!known.some(Boolean))return {state:'mismatch',message:'來源資料日期與 '+month+' 不符，已停止顯示以免誤讀'};
    return {state:'matched',message:''};
  }
  function statusInfo(value){
    const raw=String(value??'').trim();
    if(['待辦','進行中','已完成'].includes(raw))return {raw,status:raw,progress:raw==='已完成'?100:null};
    if(raw==='完成')return {raw,status:'已完成',progress:100};
    const match=raw.match(/^(\d+(?:\.\d+)?)\s*[%％]$/);
    if(match){const n=Number(match[1]);if(n>=0&&n<=100)return {raw,status:n===100?'已完成':n===0?'待辦':'進行中',progress:n};}
    return {raw,status:'未分類',progress:null};
  }
  function normalizeOutsource(row){
    const info=statusInfo(row['狀態']);
    return {...row,'原始狀態':info.raw,'狀態':info.status,'進度百分比':info.progress,
      '狀態顯示':(info.progress!==null&&/[%％]/.test(info.raw))?info.status+'（'+info.raw+'）':info.status};
  }
  function parseGviz(text){
    const value=String(text),begin=value.indexOf('{'),end=value.lastIndexOf('}');
    if(begin<0||end<begin)throw new Error('試算表回應格式錯誤');
    const data=JSON.parse(value.slice(begin,end+1));
    if(data.status==='error'||!data.table||!Array.isArray(data.table.cols)||!Array.isArray(data.table.rows))throw new Error('試算表讀取失敗');
    return data.table;
  }
  function tableRows(table,fallback=[]){
    let cols=table.cols.map(c=>String(c.label||'').trim());
    if(fallback.length&&!cols.includes(fallback[0]))cols=fallback;
    return table.rows.map((r,i)=>{
      const obj={_row:i};cols.forEach((c,j)=>{if(!c)return;const cell=r.c?.[j];obj[c]=cell?String(cell.f??cell.v??''):'';});return obj;
    });
  }
  async function checkedJson(fetcher,url,options={},timeoutMs=25000){
    const controller=new AbortController();
    let timer;
    const operation=(async()=>{
      const response=await fetcher(url,{...options,signal:controller.signal});
      if(!response.ok)throw new Error('伺服器回應 HTTP '+response.status);
      let data;try{data=JSON.parse(await response.text());}catch(e){throw new Error('伺服器未回傳JSON，寫入結果尚未確認');}
      if(!data||typeof data!=='object'||data.error||data.success===false||(data.result&&data.result!=='ok')||!((data.result==='ok')||(data.success===true)))throw new Error(String(data?.error||data?.message||'後端未確認操作成功'));
      return data;
    })();
    const timeout=new Promise((resolve,reject)=>{timer=setTimeout(()=>{reject(new Error('連線逾時，寫入結果尚未確認'));controller.abort();},timeoutMs);});
    try{return await Promise.race([operation,timeout]);}finally{clearTimeout(timer);}
  }

  return {dateKey,todayKey,monthKey,calendarDays,overlapsMonth,inspectMonth,statusInfo,normalizeOutsource,parseGviz,tableRows,checkedJson};
});
