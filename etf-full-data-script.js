// ETF 完整資料自動抓取 - 從 MoneyDJ
// Sheet ID: 1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs
// 新增 Sheet 分頁 "etf_detail" 存放完整資料

var SHEET_ID = '1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs';
var TICKERS = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];

// === 每日 16:00 執行：NAV + 折溢價 ===
function fetchNavData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  TICKERS.forEach(function(ticker, idx) {
    try {
      var url = 'https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid=' + ticker + '.TW';
      var html = UrlFetchApp.fetch(url, {muteHttpExceptions:true}).getContentText();
      var match = html.match(/col07[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?col08[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([-\d.]+)/);
      if (match) {
        sheet.getRange(idx+2, 8).setValue(parseFloat(match[2]));  // NAV
        sheet.getRange(idx+2, 9).setValue(parseFloat(match[4]));  // premium%
      }
    } catch(e) { Logger.log('NAV error ' + ticker + ': ' + e.message); }
  });
}

// === 每週六執行：規模、受益人、報酬率 ===
function fetchWeeklyData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('etf_detail');
  if (!sheet) { sheet = ss.insertSheet('etf_detail'); sheet.appendRow(['ticker','fundSize','holders','ret1m','ret3m','ret6m','ret1y','yield']); }
  
  TICKERS.forEach(function(ticker, idx) {
    try {
      // Basic info page - 規模、受益人
      var url = 'https://www.moneydj.com/ETF/X/Basic/Basic0004.xdjhtm?etfid=' + ticker + '.TW';
      var html = UrlFetchApp.fetch(url, {muteHttpExceptions:true}).getContentText();
      
      var sizeMatch = html.match(/基金規模[\s\S]*?([\d,.]+)/);
      var holderMatch = html.match(/受益人數[\s\S]*?([\d,]+)/);
      var yieldMatch = html.match(/年化配息率[\s\S]*?([\d.]+)%/);
      
      var fundSize = sizeMatch ? sizeMatch[1].replace(/,/g,'') : '';
      var holders = holderMatch ? holderMatch[1].replace(/,/g,'') : '';
      var annualYield = yieldMatch ? yieldMatch[1] : '';
      
      // Write to etf_detail sheet
      var row = idx + 2;
      sheet.getRange(row, 1).setValue(ticker);
      if (fundSize) sheet.getRange(row, 2).setValue(parseFloat(fundSize));
      if (holders) sheet.getRange(row, 3).setValue(parseFloat(holders));
      if (annualYield) sheet.getRange(row, 8).setValue(parseFloat(annualYield));
      
      Utilities.sleep(1000); // Rate limit
    } catch(e) { Logger.log('Weekly error ' + ticker + ': ' + e.message); }
  });
}

// === 每月1號執行：配息紀錄、持股、產業 ===
function fetchMonthlyData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var divSheet = ss.getSheetByName('etf_dividend');
  if (!divSheet) { divSheet = ss.insertSheet('etf_dividend'); divSheet.appendRow(['ticker','date','amount','yieldPct']); }
  var holdSheet = ss.getSheetByName('etf_holdings');
  if (!holdSheet) { holdSheet = ss.insertSheet('etf_holdings'); holdSheet.appendRow(['ticker','rank','name','pct']); }
  
  divSheet.clear(); divSheet.appendRow(['ticker','date','amount','yieldPct']);
  holdSheet.clear(); holdSheet.appendRow(['ticker','rank','name','pct']);
  
  TICKERS.forEach(function(ticker) {
    try {
      // Dividend page
      var divUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0005.xdjhtm?etfid=' + ticker + '.TW';
      var divHtml = UrlFetchApp.fetch(divUrl, {muteHttpExceptions:true}).getContentText();
      var divRows = divHtml.match(/<td class="col01">(\d{4}\/\d{2}\/\d{2})<\/td>.*?<td class="col07">([\d.]+)<\/td>.*?<td class="col07">([\d.]+)<\/td>/g);
      if (divRows) {
        divRows.slice(0, 6).forEach(function(row) {
          var m = row.match(/col01">([\d\/]+)<.*?col07">([\d.]+)<.*?col07">([\d.]+)</);
          if (m) divSheet.appendRow([ticker, m[1], parseFloat(m[2]), parseFloat(m[3])]);
        });
      }
      
      Utilities.sleep(1000);
      
      // Holdings page
      var holdUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0007.xdjhtm?etfid=' + ticker + '.TW';
      var holdHtml = UrlFetchApp.fetch(holdUrl, {muteHttpExceptions:true}).getContentText();
      var holdRows = holdHtml.match(/<td class="col05">.*?<\/td><td class="col06">[\d.]+<\/td>/g);
      if (holdRows) {
        holdRows.slice(0, 10).forEach(function(row, i) {
          var m = row.match(/col05">.*?>(.*?)\(.*?<\/a><\/td><td class="col06">([\d.]+)/);
          if (!m) m = row.match(/col05">(.*?)<\/td><td class="col06">([\d.]+)/);
          if (m) holdSheet.appendRow([ticker, i+1, m[1], parseFloat(m[2])]);
        });
      }
      
      Utilities.sleep(1000);
    } catch(e) { Logger.log('Monthly error ' + ticker + ': ' + e.message); }
  });
}
