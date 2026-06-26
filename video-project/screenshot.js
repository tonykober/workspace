const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const filePath = path.resolve('../src/res-browser.html');
  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait for React to render
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: 'screenshots/main-view.png', fullPage: false });
  console.log('Screenshot 1: main view captured');

  await browser.close();
})();
