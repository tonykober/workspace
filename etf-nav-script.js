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

// === 報酬率 + 配息抓取（加入 fetchNavData 或獨立觸發） ===
function fetchReturnsAndDividends() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var tickers = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];
  
  tickers.forEach(function(ticker, idx) {
    var row = idx + 2;
    try {
      // Returns page
      var retUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0008.xdjhtm?etfid=' + ticker + '.TW';
      var retHtml = UrlFetchApp.fetch(retUrl, {muteHttpExceptions:true}).getContentText();
      var retMatch = retHtml.match(/一個月[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/);
      if (retMatch) {
        var tds = retMatch[1].match(/<td[^>]*>([\d.\-]+)<\/td>/g);
        if (tds && tds.length >= 6) {
          var vals = tds.map(function(td) { var m=td.match(/([\d.\-]+)/); return m?parseFloat(m[1]):0; });
          sheet.getRange(row, 10).setValue(vals[2]);  // J: ret1m
          sheet.getRange(row, 11).setValue(vals[3]);  // K: ret3m
          sheet.getRange(row, 12).setValue(vals[4]);  // L: ret6m
          sheet.getRange(row, 13).setValue(vals[5]);  // M: ret1y
        }
      }
      Utilities.sleep(500);
      
      // Dividend page
      var divUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0005.xdjhtm?etfid=' + ticker + '.TW';
      var divHtml = UrlFetchApp.fetch(divUrl, {muteHttpExceptions:true}).getContentText();
      var divRows = divHtml.match(/<td class="col01">\d{4}\/\d{2}\/\d{2}<\/td>.*?<td class="col07">[\d.]+<\/td>.*?<td class="col07">[\d.]+<\/td>/g);
      if (divRows && divRows.length) {
        // First row yield
        var firstMatch = divRows[0].match(/col07">([\d.]+)<.*?col07">([\d.]+)/);
        if (firstMatch) sheet.getRange(row, 14).setValue(parseFloat(firstMatch[2])); // N: divYield
        // Recent 4 dividends as pipe-separated
        var recent = divRows.slice(0,4).map(function(r) {
          var m = r.match(/col01">([^<]+)<.*?col07">([\d.]+)/);
          return m ? m[1].substring(0,7)+':'+m[2] : '';
        }).filter(function(s){return s}).join('|');
        sheet.getRange(row, 15).setValue(recent); // O: divRecent
      }
      Utilities.sleep(500);
    } catch(e) { Logger.log('RetDiv error ' + ticker + ': ' + e.message); }
  });
}
