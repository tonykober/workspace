// ETF NAV/報酬率/配息 自動抓取 - 寫入獨立分頁 nav_data
// 每日 16:00 觸發

function fetchNavData() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('nav_data');
  if (!sheet) { sheet = ss.insertSheet('nav_data'); }
  sheet.clear();
  sheet.appendRow(['ticker','nav','premium','ret1m','ret3m','ret6m','ret1y','divYield','divRecent']);
  
  var tickers = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];
  
  tickers.forEach(function(ticker) {
    var nav = '', premium = '', ret1m = '', ret3m = '', ret6m = '', ret1y = '', divYield = '', divRecent = '';
    
    try {
      // NAV + 折溢價
      var navUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid=' + ticker + '.TW';
      var navHtml = UrlFetchApp.fetch(navUrl, {muteHttpExceptions:true}).getContentText();
      var navMatch = navHtml.match(/col07[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?col08[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([-\d.]+)/);
      if (navMatch) { nav = parseFloat(navMatch[2]); premium = parseFloat(navMatch[4]); }
      Utilities.sleep(500);
    } catch(e) { Logger.log('NAV error ' + ticker + ': ' + e.message); }
    
    try {
      // 報酬率
      var retUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0008.xdjhtm?etfid=' + ticker + '.TW';
      var retHtml = UrlFetchApp.fetch(retUrl, {muteHttpExceptions:true}).getContentText();
      var retMatch = retHtml.match(/一個月[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/);
      if (retMatch) {
        var tds = retMatch[1].match(/<td[^>]*>([\d.\-]+)<\/td>/g);
        if (tds && tds.length >= 6) {
          var vals = tds.map(function(td) { var m=td.match(/([\d.\-]+)/); return m?parseFloat(m[1]):0; });
          ret1m = vals[2]; ret3m = vals[3]; ret6m = vals[4]; ret1y = vals[5];
        }
      }
      Utilities.sleep(500);
    } catch(e) { Logger.log('Returns error ' + ticker + ': ' + e.message); }
    
    try {
      // 配息
      var divUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0005.xdjhtm?etfid=' + ticker + '.TW';
      var divHtml = UrlFetchApp.fetch(divUrl, {muteHttpExceptions:true}).getContentText();
      var divRows = divHtml.match(/<td class="col01">\d{4}\/\d{2}\/\d{2}<\/td>.*?<td class="col07">[\d.]+<\/td>.*?<td class="col07">[\d.]+<\/td>/g);
      if (divRows && divRows.length) {
        var firstMatch = divRows[0].match(/col07">([\d.]+)<.*?col07">([\d.]+)/);
        if (firstMatch) divYield = parseFloat(firstMatch[2]);
        divRecent = divRows.slice(0,4).map(function(r) {
          var m = r.match(/col01">([^<]+)<.*?col07">([\d.]+)/);
          return m ? m[1].substring(0,7)+':'+m[2] : '';
        }).filter(function(s){return s}).join('|');
      }
      Utilities.sleep(500);
    } catch(e) { Logger.log('Dividend error ' + ticker + ': ' + e.message); }
    
    sheet.appendRow([ticker, nav, premium, ret1m, ret3m, ret6m, ret1y, divYield, divRecent]);
  });
}

// === 自選股 PE/殖利率自動抓取（每日 16:00 跟 fetchNavData 一起跑）===
function fetchWatchlistData() {
  var ss = SpreadsheetApp.openById("1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs");
  var sheet = ss.getSheetByName("watchlist");
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return;
  var tickers = sheet.getRange(1,1,lastRow,1).getValues().map(function(r){return r[0].toString().trim()});
  var twseData=[],tpexData=[],twseInfo=[],tpexInfo=[];
  try{twseData=JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{tpexData=JSON.parse(UrlFetchApp.fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{twseInfo=JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/opendata/t187ap03_L",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{tpexInfo=JSON.parse(UrlFetchApp.fetch("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O",{muteHttpExceptions:true}).getContentText())}catch(e){}
  var indMap={"01":"水泥","02":"食品","03":"塑膠","04":"紡織","05":"電機","06":"電器","08":"玻璃","09":"造紙","10":"鋼鐵","11":"橡膠","12":"汽車","14":"建材","15":"航運","16":"觀光","17":"金融","18":"貿易","20":"其他","21":"化學","22":"生技","23":"油電","24":"半導體","25":"電腦週邊","26":"光電","27":"通信","28":"電子零組件","29":"電子通路","30":"資訊服務","31":"其他電子","35":"綠能","36":"數位雲端","37":"運動休閒","38":"居家生活"};
  tickers.forEach(function(ticker,idx){
    if(!ticker)return;
    var row=idx+1;
    var found=twseData.find(function(d){return d.Code===ticker});
    if(found){
      if(found.PEratio)sheet.getRange(row,8).setValue(found.PEratio);
      if(found.DividendYield)sheet.getRange(row,10).setValue(found.DividendYield);
      if(found.PBratio)sheet.getRange(row,11).setValue(found.PBratio);
    }else{
      var otc=tpexData.find(function(d){return d.SecuritiesCompanyCode===ticker});
      if(otc){
        if(otc.PriceEarningRatio)sheet.getRange(row,8).setValue(otc.PriceEarningRatio);
        if(otc.YieldRatio)sheet.getRange(row,10).setValue(otc.YieldRatio);
      }
    }
    var info=twseInfo.find(function(d){return d["公司代號"]===ticker});
    if(!info)info=tpexInfo.find(function(d){return d.SecuritiesCompanyCode===ticker});
    if(info){
      var code=info["產業別"]||info.SecuritiesIndustryCode||"";
      sheet.getRange(row,9).setValue(indMap[code]||code);
    }
  });
}

// === ETF 收盤價備案（超過24小時沒更新就從TWSE抓）===
function checkAndUpdatePrices() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var updated = sheet.getRange(2, 5).getValue();
  if (!updated || (new Date() - new Date(updated)) > 24*60*60*1000) {
    try {
      var data = JSON.parse(UrlFetchApp.fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',{muteHttpExceptions:true}).getContentText());
      var tickers = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];
      tickers.forEach(function(ticker, idx) {
        var found = data.find(function(d){return d.Code === ticker});
        if (found) {
          var price = parseFloat(found.ClosingPrice);
          var change = parseFloat(found.Change);
          var prev = price - change;
          var pct = prev > 0 ? (change/prev*100).toFixed(2) : 0;
          sheet.getRange(idx+2, 2).setValue(price);
          sheet.getRange(idx+2, 3).setValue(change);
          sheet.getRange(idx+2, 4).setValue(pct);
          sheet.getRange(idx+2, 5).setValue(new Date().toLocaleString('zh-TW'));
        }
      });
    } catch(e) { Logger.log('Price backup error: ' + e.message); }
  }
}

// === 一次性：補齊 3 個月歷史 sparkline ===
function backfillSparkline() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  
  // ETF (Sheet1)
  var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var etfTickers = ['0050','0056','00878','00919','00929','00940','006208','00713','00900','00939'];
  etfTickers.forEach(function(ticker, idx) {
    var prices = fetchThreeMonths(ticker);
    if (prices.length) {
      sheet1.getRange(idx + 2, 7).setValue(prices.join('|')); // G欄 sparkline
    }
    Utilities.sleep(1000);
  });
  
  // 自選股 (watchlist)
  var wlSheet = ss.getSheetByName('watchlist');
  if (wlSheet && wlSheet.getLastRow() > 0) {
    var wlTickers = wlSheet.getRange(1, 1, wlSheet.getLastRow(), 1).getValues().map(function(r){return r[0].toString().trim()}).filter(function(t){return t});
    wlTickers.forEach(function(ticker, idx) {
      var prices = fetchThreeMonths(ticker);
      if (prices.length) {
        wlSheet.getRange(idx + 1, 12).setValue(prices.join('|')); // L欄 sparkline
      }
      Utilities.sleep(1000);
    });
  }
  
  Logger.log('backfillSparkline 完成');
}

function fetchThreeMonths(ticker) {
  var allPrices = [];
  var months = ['20260301','20260401','20260501'];
  for (var i = 0; i < months.length; i++) {
    try {
      var url = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=' + months[i] + '&stockNo=' + ticker;
      var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      var json = JSON.parse(res.getContentText());
      if (json.stat === 'OK' && json.data) {
        json.data.forEach(function(row) {
          var price = parseFloat(row[6].replace(/,/g, ''));
          if (price > 0) allPrices.push(price);
        });
      }
    } catch(e) {
      Logger.log('TWSE fetch error ' + ticker + ' ' + months[i] + ': ' + e.message);
    }
    Utilities.sleep(1000);
  }
  // 取最近 60 筆
  return allPrices.slice(-60);
}
