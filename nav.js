/* Workspace navigation - include at bottom of each page */
(function(){
  const nav=document.createElement('div');
  nav.style.cssText='position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:100';
  nav.innerHTML=`
    <a href="index.html" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 14px;color:#58a6ff;text-decoration:none;font-size:13px;text-align:center;transition:border-color .2s" onmouseover="this.style.borderColor='#58a6ff'" onmouseout="this.style.borderColor='#30363d'">🏠 返回工作台</a>
    <button onclick="window.scrollTo({top:0,behavior:'smooth'})" style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 14px;color:#e6edf3;font-size:13px;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor='#58a6ff'" onmouseout="this.style.borderColor='#30363d'">⬆️ 回到頂部</button>
  `;
  document.body.appendChild(nav);
})();
