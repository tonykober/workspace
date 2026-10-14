/* ID-based moves. Backend capability required; no delete/add fallback. */
let _moveBatchInFlight=false;
function _moveNotice(message){
  let el=document.getElementById('taskMoveNotice');
  if(!el){el=document.createElement('div');el.id='taskMoveNotice';el.setAttribute('role','status');el.style.cssText='max-width:1200px;margin:8px auto;padding:12px;border:1px solid var(--yellow);border-radius:8px';document.querySelector('header').after(el);}
  el.textContent=message;
}
function _moveFailure(error){
  _writeFailures++;_refreshWriteStatus();_showWriteFailure(error,{});
  return {ok:false,error};
}
function _planTaskMoves(root,toMonth,includeChildren){
  if(!root||!/^\d{4}\/(0[1-9]|1[0-2])$/.test(toMonth))throw new Error('搬移的任務或月份無效');
  const selected=[],seen=new Set();
  function visit(task){
    if(seen.has(task))throw new Error('父子任務關係形成循環，請先確認資料');
    seen.add(task);selected.push(task);
    if(includeChildren){
      const children=tasks.filter(child=>child['父任務']===task['任務名稱']);
      if(children.length&&tasks.filter(other=>other['任務名稱']===task['任務名稱']).length!==1)throw new Error('父任務名稱重複，無法確認要搬移哪些子任務');
      children.forEach(visit);
    }
  }
  visit(root);
  const ids=new Set();
  for(const task of selected){
    if(typeof task.ID!=='string'||!task.ID.trim())throw new Error('任務缺少 ID，已停止搬移；請先完成 ID 資料核對');
    if(ids.has(task.ID))throw new Error('搬移清單有重複 ID，請先確認資料');
    ids.add(task.ID);
    if(!/^(?:\d{4}\/(?:0?[1-9]|1[0-2])|未修正)$/.test(task._month||''))throw new Error('缺少任務的來源月份');
  }
  return selected.filter(task=>task._month!==toMonth);
}
async function _moveTaskTreeToMonth(root,toMonth,includeChildren=true){
  if(_moveBatchInFlight)return _moveFailure(new Error('另一組任務正在搬移，請等待完成'));
  let selected;
  try{selected=_planTaskMoves(root,toMonth,includeChildren);}catch(error){return _moveFailure(error);}
  if(!selected.length)return {ok:true,moved:0};
  _moveBatchInFlight=true;let moved=0;
  try{
    const url=new URL(SCRIPT_URL,location.href);url.searchParams.set('action','capabilities');
    const capabilities=await FzgData.checkedJson(fetch,url.href,{method:'GET'});
    if(capabilities.safeMove!=='id-verified-v1')throw new Error('後端尚未支援經核對的 ID 搬移，已停止；需先完成相容部署');
    for(const task of selected){
      const fromMonth=task._month;
      const result=await writeRequest(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'moveTask',protocol:'id-verified-v1',id:task.ID,fromMonth,toMonth})});
      if(!result.ok){_moveNotice('搬移未完成：已確認 '+moved+' / '+selected.length+' 筆。請保留內容並重新載入核對，勿直接重送。');return {ok:false,moved,error:result.error};}
      if(result.data.id!==task.ID)throw new Error('搬移回覆的任務 ID 不一致，結果未確認');
      // New row positions must come from a later page reload, never from array order.
      task._month=toMonth;task._row=null;task._pendingRow=false;moved++;
      try{const pending=JSON.parse(localStorage.getItem('fzg_pending_edits')||'{}');delete pending[task['任務名稱']];localStorage.setItem('fzg_pending_edits',JSON.stringify(pending));}catch(error){/* Server confirmation is retained even if local storage is unavailable. */}
      _unmodifiedTasks=_unmodifiedTasks.filter(other=>other!==task&&other.ID!==task.ID);
    }
    _moveNotice('已確認搬移 '+moved+' 筆；後續修改會依任務 ID 核對。父子任務逐筆搬移，並非整組交易。');
    return {ok:true,moved};
  }catch(error){_moveNotice('搬移未完成；已確認 '+moved+' 筆，請重新載入核對。');return {..._moveFailure(error),moved};}
  finally{_moveBatchInFlight=false;render();renderFilterBar();}
}
