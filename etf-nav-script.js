// ETF NAV/折溢價自動抓取 - 從 MoneyDJ
// 每日 16:00 觸發，寫入 Google Sheet
// 加入現有 TWSE Proxy Apps Script 的 fetchAndSave 函式末尾

function fetchNavData() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var tickers = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];
  
  tickers.forEach(function(ticker, idx) {
    try {
      var url = 'https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid=' + ticker + '.TW';
      var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      var html = res.getContentText();
      
      // Parse first row of premium table: col07=date, col08=nav, col09=price, col09=premium%
      var match = html.match(/col07[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?col08[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([-\d.]+)/);
      if (match) {
        var nav = parseFloat(match[2]);
        var premium = parseFloat(match[4]);
        // Write to columns 8 and 9 (H and I) of the ETF row
        sheet.getRange(idx + 2, 8).setValue(nav);      // Column H = NAV
        sheet.getRange(idx + 2, 9).setValue(premium);  // Column I = premium%
      }
    } catch(e) {
      Logger.log('Error fetching NAV for ' + ticker + ': ' + e.message);
    }
  });
}

// 整合到現有 fetchAndSave：在 fetchAndSave 末尾加入 fetchNavData() 呼叫
// 或設定獨立觸發器：每日 16:00 執行 fetchNavData
