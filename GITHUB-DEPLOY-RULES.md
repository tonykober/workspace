# 老爺 GitHub 部署操作規則（秘書工作台 / GitHub Pages）

> 目的：規範 fleet 成員如何依老爺指示，把網頁/資料部署到老爺的 GitHub。
> 適用 repo：`github.com/tonykober/workspace`（GitHub Pages：`https://tonykober.github.io/workspace/`）
> 最後更新：2026-09-22

---

## 0. 鐵則（先讀這段）

1. **只有老爺明確指示才部署**。不要自己主動推、也不要「順便」推。
2. **只推老爺指定的檔案**，用明確路徑 `git add <file>`，不要 `git add .`（避免把別人/暫存檔一起送出）。
3. **驗證用 md5 全等**，不要只看 push 指令有沒有跑、不要只看檔名。
4. **不碰 `~/.codex`、`~/.git-credentials`、`key.txt` 等憑證檔**。
5. 動手前先 `git status -s` 確認工作區乾淨，避免夾帶未提交改動。

---

## 1. 環境與存取

- **本機 repo 路徑**：`/mnt/c/Users/koberhsieh/Projects/workspace`
  - WSL 內所有 instance 都能存取 `/mnt/c`、`/mnt/f`。
- **remote**：`https://github.com/tonykober/workspace.git`（分支 `main`）
- **推送認證**：git credential store（`~/.git-credentials` 已存 token，user-global）。
  → 不需重新登入，直接 `git push` 即可。**不要印出或修改 token。**
- **git 身分**：user.name `ACD_RD1謝岱錡` / user.email `koberhsieh@gmail.com`（沿用，不改）。
- **線上網址規則**：repo 根目錄的 `檔名.html` → `https://tonykober.github.io/workspace/檔名.html`

---

## 2. 卡片清單（首頁入口）的真正來源

首頁 `index.html` 的卡片清單存在 **Google Sheet**，不是任何 .html 檔。
- Sheet id：`12GcnSkOnxfZoiMU6a7402fmZ-h3MIxusBB4nbMChB2s`，分頁 `items`
- 欄位：`title, desc, icon, path, date, archived`
- `index.html` 開機先讀 Sheet（gviz csv），`data/index.json` 只是 Sheet 讀不到時的 fallback
- 新增/改卡片：改 Sheet（透過 Apps Script POST 全量存回）＋ 同步更新 `data/index.json` 並 commit
  - Apps Script endpoint（save）：`https://script.google.com/macros/s/AKfycbz8k4bBNI-8IwICwN4EUSKaJtHOYvz-3s13UnZ3QZDuzlVgAGwa9mY91J3WP1apb50TDg/exec`
- 查重：`any(i["title"]==... )` 避免重複卡

> 只是「更新既有網頁內容」時，通常**不需要動卡片**（卡片 path 指向同一檔名即可）。只有「新增一個可點的頁面」才需要加卡片。

---

## 3. 標準部署流程（更新既有頁面）

前提：作者（產檔的成員）把新版 .html 交接給你，並附 **byte 數 + md5**。

```bash
cd /mnt/c/Users/koberhsieh/Projects/workspace

# 1. 先驗來源檔身分（md5 + byte 要對得上作者給的）
md5sum <來源檔>; stat -c %s <來源檔>

# 2. 複製進 repo（同檔名，覆蓋舊版）
cp <來源檔> <檔名.html>

# 3. 三方 md5 第一關：來源 == repo
md5sum <來源檔> <檔名.html>   # 兩個 hash 要一樣

# 4. 確認只動了目標檔
git status -s

# 5. 只 add 目標檔，commit（訊息用中文），push
git add <檔名.html>
git commit -m "描述這次改了什麼"
git push origin main          # 看到 X..Y main -> main 才算送出

# 6. 確認沒有 ahead（push 真的到 origin）
git status -sb                # 不能有 "ahead"
```

---

## 4. 驗證（這關才算數）

GitHub Pages 有 CDN + build 延遲。**實測可能要等 1~10 分鐘**，不是固定 60~90 秒；
中途 `last-modified` 會停在舊時間騙人 → 要有耐心、用 md5 判斷。

```bash
# 繞快取抓線上版
TS=$(date +%s%N)
curl -s "https://tonykober.github.io/workspace/<檔名.html>?v=$TS" -o /tmp/online.html

# 線上 == 本地 repo（md5 全等才算上線成功）
md5sum /tmp/online.html <檔名.html>

# 再抓「新值出現、舊值消失」的內容特徵字串佐證
grep -o "<新版才有的字串>" /tmp/online.html | wc -l   # 應 ≥1
grep -o "<舊版才有的字串>" /tmp/online.html | wc -l   # 應 =0
```

驗證通過條件（全中）：
- ✅ 線上 md5 == 本地 md5
- ✅ 新值出現、舊值消失
- ✅ `git status -sb` 無 ahead

---

## 5. 常見坑（會靜默失敗）

| 症狀 | 真因 / 對策 |
|---|---|
| push「跑了」但線上還是舊版 | push 沒真的到 origin。查 `git status -sb` 有無 ahead；必要時單獨再 `git push origin main` |
| 只比檔名以為成功 | 檔名可能沒變但內容是舊的 → 一定要 md5 全等 |
| 抓到 200 以為上線了 | Pages 對不存在路徑會回首頁；要比對內容/ md5，不看狀態碼 |
| 等 90 秒沒更新就以為失敗 | build 可能要 5~10 分鐘；耐心等、用 md5 判斷 |
| 驗字串落空 | 可能字串被行內 HTML 標籤切開，或作者數字給錯 → 以 md5 為準，字串挑「純文字、單向互斥」 |
| artifact 的 HTML 直接搬上去壞掉 | artifact 會自動包骨架/依賴；獨立頁要作者「重出一份自包含 html」，別直接複製 |

---

## 6. 交接檢核（作者交檔給部署者時要附）

- **md5**（身分證：一致=就是這份）
- **byte 數**（輔助佐證檔案沒斷）
- **必須全中的新版特徵字串** + **舊版特徵字串（應全 0）**（變更清單：看得出線上停在哪版）
- 特徵字串要挑「純文字、不被行內標籤切開、新舊單向互斥」的

---

## 7. 新增一個可點頁面（含卡片）時的額外步驟

1. 把自包含 .html 放進 repo 根、commit、push（同上流程）
2. 在 Google Sheet `items` 加一列（title/desc/icon/path/date），path 填檔名（如 `foo.html`）
3. 同步更新 `data/index.json` fallback 並 commit
4. 驗證：首頁能看到新卡、點進去是 200 + 真內容（非 404 fallback）

---

## 8. 不要做的事

- ❌ 連 claude.ai/artifact 的臨時網址當長期內容（會失效）→ 一律放進 repo 當 .html
- ❌ `git add .`（夾帶無關檔）
- ❌ 改 `~/.git-credentials` / token / git 身分
- ❌ 沒有老爺指示就部署
- ❌ 只看 exit code / 狀態碼 / 檔名判斷成功
