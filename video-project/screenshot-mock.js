const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const MOCK_DATA = [
  {id:'1',title:'角色設計_戰士_v3.mp4',type:'video',category:'角色動畫/戰士',url:'#'},
  {id:'2',title:'場景概念_森林_final.mp4',type:'video',category:'場景設計/森林',url:'#'},
  {id:'3',title:'UI_主選單_動效.mp4',type:'video',category:'UI設計',url:'#'},
  {id:'4',title:'角色設計_法師_概念圖.png',type:'image',category:'角色動畫/法師',url:'#'},
  {id:'5',title:'背景音樂_戰鬥主題.mp3',type:'audio',category:'音效/BGM',url:'#'},
  {id:'6',title:'技術文件_shader規格.pdf',type:'pdf',category:'技術文件',url:'#'},
  {id:'7',title:'角色設計_弓箭手_跑步.mp4',type:'video',category:'角色動畫/弓箭手',url:'#'},
  {id:'8',title:'特效_火焰_粒子測試.mp4',type:'video',category:'特效/火焰',url:'#'},
  {id:'9',title:'場景概念_城堡_日景.png',type:'image',category:'場景設計/城堡',url:'#'},
  {id:'10',title:'角色設計_戰士_待機.mp4',type:'video',category:'角色動畫/戰士',url:'#'},
  {id:'11',title:'場景概念_沙漠_夜景.png',type:'image',category:'場景設計/沙漠',url:'#'},
  {id:'12',title:'UI_血條_動效展示.mp4',type:'video',category:'UI設計',url:'#'},
];

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-web-security','--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const filePath = path.resolve('../src/res-browser.html');
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Inject mock data
  await page.evaluate((data) => {
    localStorage.setItem('cloud_video_manager_data', JSON.stringify(data));
  }, MOCK_DATA);

  // Reload to pick up the data
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot 1: Main view with files
  await page.screenshot({ path: 'screenshots/01-main-list.png' });
  console.log('Screenshot 1: main list view');

  // Click grid view button (second layout button)
  try {
    const gridBtn = await page.$$('button');
    for (const btn of gridBtn) {
      const svg = await btn.$('svg');
      if (svg) {
        const html = await page.evaluate(el => el.outerHTML, btn);
        if (html.includes('rect') && html.includes('width="7"') && html.includes('x="14"')) {
          await btn.click();
          break;
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'screenshots/02-grid-view.png' });
    console.log('Screenshot 2: grid view');
  } catch(e) { console.log('Grid view skip:', e.message); }

  // Screenshot 3: Click search icon
  try {
    const searchBtn = await page.$$('button');
    for (const btn of searchBtn) {
      const html = await page.evaluate(el => el.outerHTML, btn);
      if (html.includes('circle cx="11"')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'screenshots/03-search.png' });
    console.log('Screenshot 3: search open');
  } catch(e) { console.log('Search skip:', e.message); }

  await browser.close();
  console.log('Done! Screenshots saved.');
})();
