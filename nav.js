(function(){
  var nav=document.createElement('div');
  nav.style.cssText='position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:100';
  var html='';
  if(sessionStorage.getItem('ws_unlocked')==='1'){
    var from=new URLSearchParams(window.location.search).get('from');
    var backUrl=from==='archive'?'index.html#archive':'index.html';
    var backLabel=from==='archive'?'📦 返回封存':'🏠 返回主頁';
    html+='<a href="'+backUrl+'" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 14px;color:#58a6ff;text-decoration:none;font-size:13px;text-align:center;transition:border-color .2s" onmouseover="this.style.borderColor=\'#58a6ff\'" onmouseout="this.style.borderColor=\'#30363d\'">'+backLabel+'</a>';
  }
  html+='<button onclick="window.scrollTo({top:0,behavior:\'smooth\'})" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 14px;color:#e6edf3;font-size:13px;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor=\'#58a6ff\'" onmouseout="this.style.borderColor=\'#30363d\'">⬆️ 回到頂部</button>';
  nav.innerHTML=html;
  document.body.appendChild(nav);
})();
