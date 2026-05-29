@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Workspace Local Server
echo.
echo Browser: http://localhost:8081/index.html
echo Close this window to stop.
echo.
start http://localhost:8081/index.html
powershell -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8081/'); $listener.Start(); Write-Host 'Server running on http://localhost:8081/ (Ctrl+C to stop)'; while($listener.IsListening){ $ctx = $listener.GetContext(); $path = $ctx.Request.Url.LocalPath; if($path -eq '/') {$path='/index.html'}; $file = Join-Path '%~dp0' ($path -replace '/','\'); if(Test-Path $file -PathType Leaf){ $bytes=[System.IO.File]::ReadAllBytes($file); $ext=[System.IO.Path]::GetExtension($file); $mime=@{'.html'='text/html;charset=utf-8';'.js'='application/javascript;charset=utf-8';'.css'='text/css;charset=utf-8';'.json'='application/json';'.png'='image/png';'.jpg'='image/jpeg';'.svg'='image/svg+xml';'.csv'='text/csv'}; $ctx.Response.ContentType=if($mime[$ext]){$mime[$ext]}else{'application/octet-stream'}; $ctx.Response.ContentLength64=$bytes.Length; $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)}else{ $ctx.Response.StatusCode=404; $bytes=[System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)}; $ctx.Response.Close()}"
