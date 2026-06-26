const { MsEdgeTTS } = require('edge-tts-node');
const fs = require('fs');
const path = require('path');

const segments = [
  { file: 'narr-01-opening.mp3', text: '歡迎使用多媒體中心，您的雲端與本地資源管理系統。' },
  { file: 'narr-02-overview.mp3', text: '多媒體中心支援影片、圖片、音訊與PDF等多種格式的統一管理。左側為資料夾樹狀結構，右側為檔案瀏覽區。' },
  { file: 'narr-03-sync.mp3', text: '系統支援雲端資源自動同步，一鍵匯入所有檔案。匯入完成後會顯示詳細報告，包含總項目數、成功數與失敗數。' },
  { file: 'narr-04-folders.mp3', text: '透過左側資料夾可快速切換分類。支援2D、3D、特效、UI等多種資料夾分類，清楚整理所有素材。' },
  { file: 'narr-05-views.mp3', text: '支援列表與宮格兩種檢視模式，可依需求切換。每個檔案都有縮圖預覽、名稱與日期資訊。' },
  { file: 'narr-06-search.mp3', text: '內建搜尋功能，快速找到需要的檔案。支援依類型、日期等條件篩選。' },
  { file: 'narr-07-local.mp3', text: '除了雲端資源，也支援掃描本地資料夾，將本機檔案納入統一管理。' },
  { file: 'narr-08-ending.mp3', text: '多媒體中心，讓您的創作素材井然有序。立即開始使用吧。' },
];

const outDir = path.join(__dirname, 'audio');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const tts = new MsEdgeTTS({});
  await tts.setMetadata('zh-TW-HsiaoChenNeural', 'audio-24khz-96kbitrate-mono-mp3');

  for (const seg of segments) {
    const filePath = path.join(outDir, seg.file);
    await tts.toFile(filePath, seg.text);
    console.log(`Generated: ${seg.file}`);
  }
  console.log('All narration audio generated!');
})();
