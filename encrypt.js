#!/usr/bin/env node
// Encrypts all HTML files in src/ and outputs to root directory
// Usage: node encrypt.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PASSWORD = 'igs0000';
const SRC_DIR = path.join(__dirname, 'src');
const OUT_DIR = __dirname;

function encrypt(text, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    s: salt.toString('base64'),
    iv: iv.toString('base64'),
    t: tag.toString('base64'),
    d: encrypted
  });
}

const DECRYPT_TEMPLATE = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>🔒</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e1a;color:#e8ecf4;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}.lock{text-align:center}.lock h2{margin-bottom:16px;color:#00d4ff}.lock input{padding:10px 16px;font-size:16px;border-radius:6px;border:1px solid #2a3050;background:#131829;color:#fff;width:200px;text-align:center}.lock button{margin-left:8px;padding:10px 20px;border-radius:6px;border:none;background:#00d4ff;color:#000;font-weight:bold;cursor:pointer}.lock .err{color:#ef4444;margin-top:8px;display:none;font-size:13px}</style></head>
<body><div class="lock" id="lock"><h2>🔒 請輸入密碼</h2><input type="password" id="pw" onkeydown="if(event.key==='Enter')go()"><button onclick="go()">進入</button><p class="err" id="err">密碼錯誤</p></div>
<script>
var E=##DATA##;
async function go(){var p=document.getElementById('pw').value;try{var s=Uint8Array.from(atob(E.s),c=>c.charCodeAt(0));var iv=Uint8Array.from(atob(E.iv),c=>c.charCodeAt(0));var t=Uint8Array.from(atob(E.t),c=>c.charCodeAt(0));var d=Uint8Array.from(atob(E.d),c=>c.charCodeAt(0));var key=await crypto.subtle.importKey('raw',await crypto.subtle.deriveBits({name:'PBKDF2',salt:s,iterations:100000,hash:'SHA-256'},await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']),256),'AES-GCM',false,['decrypt']);var ct=new Uint8Array(d.length+t.length);ct.set(d);ct.set(t,d.length);var dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct);document.open();document.write(new TextDecoder().decode(dec));document.close();}catch(e){document.getElementById('err').style.display='block';}}
if(sessionStorage.getItem('ws-k')==='##HASH##'){document.getElementById('pw').value='##BYPASS##';go();}
</script></body></html>`;

const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.html'));
let count = 0;

for (const file of files) {
  const content = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  const encData = encrypt(content, PASSWORD);
  // Simple template - no session bypass for security
  const output = DECRYPT_TEMPLATE.replace('##DATA##', encData)
    .replace(/if\(sessionStorage.*?\n/g, '');
  fs.writeFileSync(path.join(OUT_DIR, file), `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>🔒</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e1a;color:#e8ecf4;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}.lock{text-align:center}.lock h2{margin-bottom:16px;color:#00d4ff}.lock input{padding:10px 16px;font-size:16px;border-radius:6px;border:1px solid #2a3050;background:#131829;color:#fff;width:200px;text-align:center}.lock button{margin-left:8px;padding:10px 20px;border-radius:6px;border:none;background:#00d4ff;color:#000;font-weight:bold;cursor:pointer}.lock .err{color:#ef4444;margin-top:8px;display:none;font-size:13px}</style></head>
<body><div class="lock" id="lock"><h2>🔒 請輸入密碼</h2><input type="password" id="pw" onkeydown="if(event.key==='Enter')go()"><button onclick="go()">進入</button><p class="err" id="err">密碼錯誤</p></div>
<script>
var E=${encData};
async function go(){var p=document.getElementById('pw').value;try{var s=Uint8Array.from(atob(E.s),c=>c.charCodeAt(0));var iv=Uint8Array.from(atob(E.iv),c=>c.charCodeAt(0));var t=Uint8Array.from(atob(E.t),c=>c.charCodeAt(0));var d=Uint8Array.from(atob(E.d),c=>c.charCodeAt(0));var key=await crypto.subtle.importKey('raw',await crypto.subtle.deriveBits({name:'PBKDF2',salt:s,iterations:100000,hash:'SHA-256'},await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']),256),'AES-GCM',false,['decrypt']);var ct=new Uint8Array(d.length+t.length);ct.set(d);ct.set(t,d.length);var dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct);document.open();document.write(new TextDecoder().decode(dec));document.close();}catch(e){document.getElementById('err').style.display='block';}}
</script></body></html>`);
  count++;
}

console.log(`Encrypted ${count} files.`);
