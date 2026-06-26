const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-web-security','--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const filePath = path.resolve('../src/res-browser.html');
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Screenshot: sidebar folder expanded - click on 2D folder
  try {
    const folders = await page.$$('[class*="cursor-pointer"]');
    for (const f of folders) {
      const text = await page.evaluate(el => el.textContent, f);
      if (text && text.includes('2D')) {
        await f.click();
        await new Promise(r => setTimeout(r, 1000));
        break;
      }
    }
    await page.screenshot({ path: 'screenshots/04-folder-expanded.png' });
    console.log('Screenshot 4: folder expanded');
  } catch(e) { console.log('Folder expand skip:', e.message); }

  // Click a video item to trigger preview
  try {
    const items = await page.$$('[class*="hover"]');
    for (const item of items) {
      const text = await page.evaluate(el => el.textContent, item);
      if (text && text.includes('.mp4')) {
        await item.click();
        await new Promise(r => setTimeout(r, 1500));
        break;
      }
    }
    await page.screenshot({ path: 'screenshots/05-video-preview.png' });
    console.log('Screenshot 5: video preview');
  } catch(e) { console.log('Video preview skip:', e.message); }

  await browser.close();
  console.log('Done!');
})();
