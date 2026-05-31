// ETF NAV/報酬率/配息 自動抓取 - 寫入獨立分頁 nav_data
// 每日 16:00 觸發

function fetchNavData() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('nav_data');
  if (!sheet) { sheet = ss.insertSheet('nav_data'); }
  sheet.clear();
  sheet.appendRow(['ticker','nav','premium','ret1m','ret3m','ret6m','ret1y','divYield','divRecent']);
  
  var tickers = ss.getSheetByName('info').getDataRange().getValues().slice(1).map(function(r){return r[0].toString().trim()}).filter(function(t){return t});
  
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
    
    // Fallback: if MoneyDJ returns empty, calculate returns from history
    if (!ret1m && !ret3m) {
      try {
        var hist = ss.getSheetByName('history');
        if (hist) {
          var hRows = hist.getDataRange().getValues();
          var hRow = hRows.find(function(r){return r[0].toString().trim()===ticker || r[0].toString().trim()===ticker.replace(/^0+/,'')});
          if (hRow && hRow[1]) {
            var prices = hRow[1].toString().split('|').map(Number).filter(function(n){return n>0});
            var len = prices.length;
            var latest = prices[len-1];
            if (len >= 5 && !ret1m) { var p22 = prices[Math.max(0,len-22)]; ret1m = ((latest-p22)/p22*100).toFixed(2); }
            if (len >= 44 && !ret3m) { var p66 = prices[Math.max(0,len-60)]; ret3m = ((latest-p66)/p66*100).toFixed(2); }
          }
        }
      } catch(e2) {}
    }
    
    sheet.appendRow([ticker, nav, premium, ret1m, ret3m, ret6m, ret1y, divYield, divRecent]);
  });
}

// === ETF 完整資料抓取：規模/受益人/持股/產業 ===
function fetchFundInfo() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var info = ss.getSheetByName('info');
  if (!info) return;
  var holdSheet = ss.getSheetByName('holdings');
  if (!holdSheet) { holdSheet = ss.insertSheet('holdings'); holdSheet.appendRow(['ticker','h1','p1','h2','p2','h3','p3','h4','p4','h5','p5','h6','p6','h7','p7','h8','p8','h9','p9','h10','p10']); }
  var secSheet = ss.getSheetByName('sectors');
  if (!secSheet) { secSheet = ss.insertSheet('sectors'); secSheet.appendRow(['ticker','s1','p1','s2','p2','s3','p3','s4','p4','s5','p5','s6','p6']); }
  var rows = info.getDataRange().getValues();
  rows.forEach(function(row, idx) {
    if (idx === 0) return;
    var ticker = row[0].toString().trim();
    if (!ticker) return;
    
    // 1. Fund size from Yahoo
    try {
      var yUrl = 'https://tw.stock.yahoo.com/quote/' + ticker + '.TW/profile';
      var yHtml = UrlFetchApp.fetch(yUrl, {muteHttpExceptions:true, headers:{'User-Agent':'Mozilla/5.0'}}).getContentText();
      var aum = yHtml.match(/"totalAssets":"([\d.]+)"/);
      if (aum) info.getRange(idx+1, 5).setValue((parseFloat(aum[1]) / 100000000).toFixed(0));
    } catch(e) {}
    Utilities.sleep(500);
    
    // 2. Beneficiary count from MoneyDJ
    try {
      var bUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0019.xdjhtm?etfid=' + ticker + '.TW';
      var bHtml = UrlFetchApp.fetch(bUrl, {muteHttpExceptions:true}).getContentText();
      var bNums = bHtml.match(/<td class="col\d+">([\d,]+)<\/td>/);
      if (bNums) info.getRange(idx+1, 6).setValue((parseInt(bNums[1].replace(/,/g,'')) / 10000).toFixed(1));
    } catch(e) {}
    Utilities.sleep(2000);
    
    // 2b. Type from TWSE ETF list + frequency from divRecent
    try {
      // Type: always update from TWSE ETF list
      var etfListUrl = 'https://www.twse.com.tw/rwd/zh/ETF/list?response=json';
      var etfList = JSON.parse(UrlFetchApp.fetch(etfListUrl, {muteHttpExceptions:true}).getContentText());
      var etfRow = (etfList.data||[]).find(function(r){return r[1]===ticker});
      if (etfRow) {
        var etfName = etfRow[2] || '';
        var idxName = etfRow[4] || '';
        var type = '股票型';
        if (/主動/.test(etfName)) type = '主動型';
        else if (/債|公債|投資級|收益/.test(idxName)) type = '債券型';
        else if (/高股息|高息|優息|填息|價值高息/.test(idxName)) type = '高股息';
        else if (/50|100|加權|市值|TOP/.test(idxName)) type = '市值型';
        else if (/科技|資訊|半導體|5G|AI|電動車|元宇宙/.test(idxName)) type = '主題型';
        info.getRange(idx+1, 3).setValue(type);
      }
      // Frequency: from divRecent
      var navSheet = ss.getSheetByName('nav_data');
      if (navSheet) {
        var navRows = navSheet.getDataRange().getValues();
        var navRow = navRows.find(function(r){return r[0].toString().trim()===ticker});
        if (navRow && navRow[8]) {
          var divDates = navRow[8].toString().split('|').map(function(s){return s.split(':')[0]});
          if (divDates.length >= 3) {
            var months = divDates.map(function(d){return parseInt(d.split('/')[1])});
            var gaps = [];
            for (var gi=1;gi<months.length;gi++) { var diff=months[gi-1]-months[gi]; if(diff<=0)diff+=12; gaps.push(diff); }
            var avgGap = gaps.reduce(function(s,v){return s+v},0)/gaps.length;
            var freq = avgGap <= 1.5 ? '月配' : avgGap <= 4 ? '季配' : avgGap <= 7 ? '半年配' : '年配';
            info.getRange(idx+1, 4).setValue(freq);
          } else if (divDates.length === 0 || (divDates.length === 1 && divDates[0] === '')) {
            info.getRange(idx+1, 4).setValue('不配息');
          }
        } else {
          info.getRange(idx+1, 4).setValue('不配息');
        }
      }
    } catch(e) { Logger.log('Type/Freq error ' + ticker + ': ' + e.message); }
    Utilities.sleep(500);
    
    // 3. Top holdings + 4. Sectors from MoneyDJ Basic0007
    try {
      var hUrl = 'https://www.moneydj.com/ETF/X/Basic/Basic0007.xdjhtm?etfid=' + ticker + '.TW';
      var hHtml = UrlFetchApp.fetch(hUrl, {muteHttpExceptions:true}).getContentText();
      
      // Holdings
      var hMatches = hHtml.match(/<td class="col05"><a[^>]*>([^<]+)<\/a><\/td><td class="col06">([\d.]+)<\/td>/g);
      if (hMatches && hMatches.length) {
        var hRow = [ticker];
        hMatches.slice(0,10).forEach(function(m) {
          var parts = m.match(/>([^<(]+)\(/);
          var pct = m.match(/col06">([\d.]+)/);
          hRow.push(parts ? parts[1].trim() : '');
          hRow.push(pct ? parseFloat(pct[1]) : 0);
        });
        var hRows = holdSheet.getDataRange().getValues();
        var hIdx = hRows.findIndex(function(r){return r[0].toString().trim()===ticker});
        if (hIdx >= 0) { holdSheet.getRange(hIdx+1, 1).setNumberFormat('@'); holdSheet.getRange(hIdx+1, 1, 1, hRow.length).setValues([hRow]); }
        else { var hr = holdSheet.getLastRow()+1; holdSheet.getRange(hr,1).setNumberFormat('@'); holdSheet.appendRow(hRow); }
      }
      
      // Sectors - pattern: color div, col02=name, col03=amount, col04=percentage
      var sMatches = hHtml.match(/<td class="col02">(.*?)<\/td><td class="col03">[\d,.]+<\/td><td class="col04">([\d.]+)<\/td>/g);
      if (sMatches && sMatches.length) {
        var sRow = [ticker];
        sMatches.slice(0,6).forEach(function(m) {
          var nm = m.match(/col02">(.*?)<\/td>/);
          var pc = m.match(/col04">([\d.]+)/);
          sRow.push(nm ? nm[1].trim() : '');
          sRow.push(pc ? parseFloat(pc[1]) : 0);
        });
        var sRows = secSheet.getDataRange().getValues();
        var sIdx = sRows.findIndex(function(r){return r[0].toString().trim()===ticker});
        if (sIdx >= 0) { secSheet.getRange(sIdx+1, 1).setNumberFormat('@'); secSheet.getRange(sIdx+1, 1, 1, sRow.length).setValues([sRow]); }
        else { var sr = secSheet.getLastRow()+1; secSheet.getRange(sr,1).setNumberFormat('@'); secSheet.appendRow(sRow); }
      }
    } catch(e) { Logger.log('Holdings/Sectors error ' + ticker + ': ' + e.message); }
    Utilities.sleep(1000);
  });
  
  // Also update watchlist quarterLine
  updateWatchlistQuarterLine(ss);
}

// === 自選股離季線自動計算 ===
function updateWatchlistQuarterLine(ss) {
  if (!ss) ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var wl = ss.getSheetByName('watchlist');
  var hist = ss.getSheetByName('history');
  if (!wl || !hist) return;
  var histRows = hist.getDataRange().getValues();
  var wlRows = wl.getDataRange().getValues();
  wlRows.forEach(function(row, idx) {
    var ticker = row[0].toString().trim();
    if (!ticker) return;
    var hRow = histRows.find(function(r){return r[0].toString().trim()===ticker});
    if (hRow && hRow[1]) {
      var prices = hRow[1].toString().split('|').map(Number).filter(function(n){return n>0});
      if (prices.length >= 5) {
        var ma = prices.reduce(function(s,v){return s+v},0) / prices.length;
        var latest = prices[prices.length-1];
        var qLine = ((latest - ma) / ma * 100).toFixed(1);
        wl.getRange(idx+1, 11).setValue(qLine); // K欄: quarterLine
      }
    }
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
  var twseData=[],tpexData=[],twseInfo=[],tpexInfo=[],priceData=[];
  try{twseData=JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{tpexData=JSON.parse(UrlFetchApp.fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{twseInfo=JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/opendata/t187ap03_L",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{tpexInfo=JSON.parse(UrlFetchApp.fetch("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O",{muteHttpExceptions:true}).getContentText())}catch(e){}
  try{priceData=JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",{muteHttpExceptions:true}).getContentText())}catch(e){}
  var indMap={"01":"水泥","02":"食品","03":"塑膠","04":"紡織","05":"電機","06":"電器","08":"玻璃","09":"造紙","10":"鋼鐵","11":"橡膠","12":"汽車","14":"建材","15":"航運","16":"觀光","17":"金融","18":"貿易","20":"其他","21":"化學","22":"生技","23":"油電","24":"半導體","25":"電腦週邊","26":"光電","27":"通信","28":"電子零組件","29":"電子通路","30":"資訊服務","31":"其他電子","32":"文化創意","33":"農業科技","34":"電子商務","35":"綠能","36":"數位雲端","37":"運動休閒","38":"居家生活","91":"存託憑證"};
  tickers.forEach(function(ticker,idx){
    if(!ticker)return;
    var row=idx+1;
    // Price from TWSE STOCK_DAY_ALL
    var pFound=priceData.find(function(d){return d.Code===ticker});
    if(pFound){
      var price=parseFloat(pFound.ClosingPrice);
      var change=parseFloat(pFound.Change);
      var prev=price-change;
      var pct=prev>0?(change/prev*100).toFixed(2):'0';
      sheet.getRange(row,4).setValue(price);
      sheet.getRange(row,5).setValue(change);
      sheet.getRange(row,6).setValue(pct);
      sheet.getRange(row,7).setValue(new Date().toLocaleString('zh-TW'));
    }
    // PE/Yield
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
      // Fill name if empty
      var curName = sheet.getRange(row,2).getValue();
      if(!curName || curName===ticker) sheet.getRange(row,2).setValue(info["公司簡稱"]||info.CompanyName||ticker);
    }
  });
  // Update quarterLine for watchlist
  updateWatchlistQuarterLine(ss);
}

// === ETF 收盤價備案（超過24小時沒更新就從TWSE抓）===
function checkAndUpdatePrices() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  var updated = sheet.getRange(2, 5).getValue();
  if (!updated || (new Date() - new Date(updated)) > 24*60*60*1000) {
    try {
      var data = JSON.parse(UrlFetchApp.fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',{muteHttpExceptions:true}).getContentText());
      var tickers = ss.getSheetByName('info').getDataRange().getValues().slice(1).map(function(r){return r[0].toString().trim()}).filter(function(t){return t});
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

// === 一次性：修復所有分頁的 ticker 前導零 ===
function fixTickerLeadingZeros() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  // Get correct tickers from TWSE
  var allData = JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",{muteHttpExceptions:true}).getContentText());
  var codeMap = {};
  allData.forEach(function(d) { codeMap[d.Code.replace(/^0+/,'')] = d.Code; }); // stripped → full
  
  var sheets = ['info','Sheet1','nav_data','history','watchlist','pinned','etf_dividend','etf_holdings','etf_detail','holdings','sectors'];
  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return;
    var range = sheet.getRange(1, 1, lastRow, 1);
    range.setNumberFormat('@'); // Set entire ticker column to plain text
    var values = range.getValues();
    var changed = false;
    values.forEach(function(row, i) {
      var val = row[0].toString().trim();
      if (!val || val === 'ticker') return;
      // If it's a number without leading zeros, try to find the correct full code
      var full = codeMap[val] || codeMap[val.replace(/^0+/,'')];
      if (full && full !== val) {
        values[i][0] = full;
        changed = true;
      }
    });
    if (changed) range.setValues(values);
  });
  Logger.log('fixTickerLeadingZeros 完成');
}

// === 一次性：補齊 3 個月歷史 sparkline（寫入獨立分頁 history）===
function backfillSparkline() {
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  var hist = ss.getSheetByName('history');
  if (!hist) { hist = ss.insertSheet('history'); }
  hist.clear();
  hist.appendRow(['ticker','sparkline']);
  
  var months = ['20260301','20260401','20260501'];
  // Dynamic: read all tickers from info + watchlist
  var infoTickers = ss.getSheetByName('info').getDataRange().getValues().slice(1).map(function(r){return r[0].toString().trim()}).filter(function(t){return t});
  var wlSheet = ss.getSheetByName('watchlist');
  var wlTickers = wlSheet ? wlSheet.getDataRange().getValues().map(function(r){return r[0].toString().trim()}).filter(function(t){return t}) : [];
  var allTickers = infoTickers.concat(wlTickers.filter(function(t){return infoTickers.indexOf(t)<0}));
  
  allTickers.forEach(function(ticker) {
    var prices = [];
    months.forEach(function(m) {
      try {
        var url = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=' + m + '&stockNo=' + ticker;
        var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
        var d = JSON.parse(res.getContentText());
        if (d.data) d.data.forEach(function(row) { prices.push(parseFloat(row[6].replace(/,/g,''))); });
      } catch(e) {}
      Utilities.sleep(1000);
    });
    if (prices.length > 60) prices = prices.slice(-60);
    hist.appendRow([ticker, prices.join('|')]);
  });
  Logger.log('backfillSparkline 完成');
}

// === Web App doPost：處理前端新增 ETF / 自選股 ===
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById('1GT8LkzWJPo9psHwRIJwjfV2HEoYf7x8eIkI22BhuqIs');
  
  if (data.action === 'addETF') {
    var info = ss.getSheetByName('info');
    var ticker = data.ticker;
    var existing = info.getDataRange().getValues().some(function(r){return r[0].toString().trim()===ticker});
    if (existing) return ContentService.createTextOutput('exists');
    var name = ticker;
    try {
      var allStocks = JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",{muteHttpExceptions:true}).getContentText());
      var nf = allStocks.find(function(d){return d.Code===ticker});
      if (nf && nf.Name) name = nf.Name;
    } catch(ex) {}
    var newRow = info.getLastRow() + 1;
    info.getRange(newRow, 1).setNumberFormat('@').setValue(ticker);
    info.getRange(newRow, 2).setValue(name);
    // Fetch fund size from Yahoo Finance TW
    try {
      var yUrl = 'https://tw.stock.yahoo.com/quote/' + ticker + '.TW/profile';
      var yHtml = UrlFetchApp.fetch(yUrl, {muteHttpExceptions:true, headers:{'User-Agent':'Mozilla/5.0'}}).getContentText();
      var aum = yHtml.match(/"totalAssets":"([\d.]+)"/);
      if (aum) info.getRange(newRow, 5).setValue((parseFloat(aum[1]) / 100000000).toFixed(0));
    } catch(ey) {}
    
    // Immediately fetch NAV/premium/returns/dividend
    var navSheet = ss.getSheetByName('nav_data');
    if (navSheet) {
      var nav='',premium='',ret1m='',ret3m='',ret6m='',ret1y='',divYield='',divRecent='';
      try {
        var navUrl='https://www.moneydj.com/ETF/X/Basic/Basic0003.xdjhtm?etfid='+ticker+'.TW';
        var navHtml=UrlFetchApp.fetch(navUrl,{muteHttpExceptions:true}).getContentText();
        var nm=navHtml.match(/col07[\s\S]*?(\d{4}\/\d{2}\/\d{2})[\s\S]*?col08[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([\d.]+)[\s\S]*?col09[\s\S]*?([-\d.]+)/);
        if(nm){nav=parseFloat(nm[2]);premium=parseFloat(nm[4]);}
      }catch(ex2){}
      try {
        var retUrl='https://www.moneydj.com/ETF/X/Basic/Basic0008.xdjhtm?etfid='+ticker+'.TW';
        var retHtml=UrlFetchApp.fetch(retUrl,{muteHttpExceptions:true}).getContentText();
        var rm=retHtml.match(/市價\([\d\/]+\)<\/th>([\s\S]*?)<\/tr>/);
        if(rm){var nums=rm[1].match(/>([\d.]+)<\/td>/g);if(nums&&nums.length>=6){var v=nums.map(function(n){return parseFloat(n.match(/([\d.]+)/)[1])});ret1m=v[2];ret3m=v[3];ret6m=v[4];ret1y=v[5];}}
      }catch(ex3){}
      try {
        var divUrl='https://www.moneydj.com/ETF/X/Basic/Basic0005.xdjhtm?etfid='+ticker+'.TW';
        var divHtml=UrlFetchApp.fetch(divUrl,{muteHttpExceptions:true}).getContentText();
        var dr=divHtml.match(/<td class="col01">\d{4}\/\d{2}\/\d{2}<\/td>.*?<td class="col07">[\d.]+<\/td>.*?<td class="col07">[\d.]+<\/td>/g);
        if(dr&&dr.length){var fm=dr[0].match(/col07">([\d.]+)<.*?col07">([\d.]+)/);if(fm)divYield=parseFloat(fm[2]);divRecent=dr.slice(0,6).map(function(r){var x=r.match(/col01">([^<]+)<.*?col07">([\d.]+)/);return x?x[1].substring(0,7)+':'+x[2]:''}).filter(function(s){return s}).join('|');}
      }catch(ex4){}
      navSheet.appendRow([ticker,nav,premium,ret1m||'',ret3m||'',ret6m||'',ret1y||'',divYield,divRecent]);
    }
    
    // Try to get current price from TWSE
    try {
      var priceData = JSON.parse(UrlFetchApp.fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',{muteHttpExceptions:true}).getContentText());
      var found = priceData.find(function(d){return d.Code === ticker});
      if (found) {
        var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
        var lastRow = sheet1.getLastRow() + 1;
        var price = parseFloat(found.ClosingPrice);
        var change = parseFloat(found.Change);
        var prev = price - change;
        var pct = prev > 0 ? (change/prev*100).toFixed(2) : 0;
        sheet1.getRange(lastRow, 1).setNumberFormat('@').setValue(ticker);
        sheet1.getRange(lastRow, 2).setValue(price);
        sheet1.getRange(lastRow, 3).setValue(change);
        sheet1.getRange(lastRow, 4).setValue(pct);
        sheet1.getRange(lastRow, 5).setValue(new Date().toLocaleString('zh-TW'));
      }
    } catch(ex5) {}
    
    // Fetch 3-month sparkline history and write to history sheet
    try {
      var hist = ss.getSheetByName('history');
      if (!hist) { hist = ss.insertSheet('history'); hist.appendRow(['ticker','sparkline']); }
      var prices = [];
      var months = ['20260301','20260401','20260501'];
      months.forEach(function(m) {
        try {
          var hUrl = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=' + m + '&stockNo=' + ticker;
          var hRes = UrlFetchApp.fetch(hUrl, {muteHttpExceptions:true});
          var hd = JSON.parse(hRes.getContentText());
          if (hd.data) hd.data.forEach(function(row) { prices.push(parseFloat(row[6].replace(/,/g,''))); });
        } catch(ex6) {}
        Utilities.sleep(1000);
      });
      if (prices.length > 60) prices = prices.slice(-60);
      if (prices.length) {
        hist.appendRow([ticker, prices.join('|')]);
        // Write sparkline (last 22 days) and quarterLine to Sheet1
        var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
        var s1Rows = sheet1.getDataRange().getValues();
        var s1Row = -1;
        for (var ri = 0; ri < s1Rows.length; ri++) { if (s1Rows[ri][0].toString().trim() === ticker) { s1Row = ri+1; break; } }
        if (s1Row < 0) s1Row = sheet1.getLastRow() + 1;
        var spark22 = prices.slice(-22).join('|');
        sheet1.getRange(s1Row, 7).setValue(spark22); // G: sparkline
        // Calculate quarterLine (deviation from 60-day MA)
        if (prices.length >= 5) {
          var ma = prices.reduce(function(s,v){return s+v},0) / prices.length;
          var latest = prices[prices.length-1];
          var qLine = ((latest - ma) / ma * 100).toFixed(1);
          sheet1.getRange(s1Row, 6).setValue(qLine); // F: quarterLine
        }
        // Fallback: calculate returns from history if MoneyDJ failed
        var navSheet2 = ss.getSheetByName('nav_data');
        if (navSheet2 && prices.length >= 22) {
          var len = prices.length;
          var lat = prices[len-1];
          var navRows = navSheet2.getDataRange().getValues();
          for (var ni = 0; ni < navRows.length; ni++) {
            if (navRows[ni][0].toString().trim() === ticker) {
              if (!navRows[ni][3]) navSheet2.getRange(ni+1,4).setValue(((lat-prices[Math.max(0,len-22)])/prices[Math.max(0,len-22)]*100).toFixed(2));
              if (!navRows[ni][4] && len>=44) navSheet2.getRange(ni+1,5).setValue(((lat-prices[Math.max(0,len-44)])/prices[Math.max(0,len-44)]*100).toFixed(2));
              if (!navRows[ni][5] && len>=60) navSheet2.getRange(ni+1,6).setValue(((lat-prices[0])/prices[0]*100).toFixed(2));
              break;
            }
          }
        }
      }
    } catch(ex7) {}
    
    return ContentService.createTextOutput('ok');
  }
  
  if (data.action === 'removeETF') {
    var ticker = data.ticker;
    // Remove from info
    var info = ss.getSheetByName('info');
    var infoRows = info.getDataRange().getValues();
    for (var i = infoRows.length-1; i >= 0; i--) { if (infoRows[i][0].toString().trim() === ticker) { info.deleteRow(i+1); break; } }
    // Remove from nav_data
    var navSheet = ss.getSheetByName('nav_data');
    if (navSheet) { var nr = navSheet.getDataRange().getValues(); for (var i = nr.length-1; i >= 0; i--) { if (nr[i][0].toString().trim() === ticker) { navSheet.deleteRow(i+1); break; } } }
    // Remove from Sheet1
    var s1 = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
    var s1r = s1.getDataRange().getValues(); for (var i = s1r.length-1; i >= 0; i--) { if (s1r[i][0].toString().trim() === ticker) { s1.deleteRow(i+1); break; } }
    return ContentService.createTextOutput('ok');
  }
  
  if (data.action === 'add') {
    var wl = ss.getSheetByName('watchlist');
    var ticker = data.ticker;
    var name = ticker;
    var price=0,change=0,pct=0;
    try {
      var pd = JSON.parse(UrlFetchApp.fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",{muteHttpExceptions:true}).getContentText());
      var pf = pd.find(function(d){return d.Code===ticker});
      if(pf){
        if(pf.Name) name = pf.Name;
        price=parseFloat(pf.ClosingPrice);change=parseFloat(pf.Change);var prev=price-change;pct=prev>0?(change/prev*100).toFixed(2):'0';
      }
    } catch(e) {}
    var wlRow = wl.getLastRow() + 1;
    wl.getRange(wlRow, 1).setNumberFormat('@').setValue(ticker);
    wl.getRange(wlRow, 2).setValue(name);
    wl.getRange(wlRow, 4).setValue(price);
    wl.getRange(wlRow, 5).setValue(change);
    wl.getRange(wlRow, 6).setValue(pct);
    wl.getRange(wlRow, 7).setValue(new Date().toLocaleString('zh-TW'));
    return ContentService.createTextOutput('ok');
  }
  
  if (data.action === 'remove') {
    var wl = ss.getSheetByName('watchlist');
    var range = wl.getDataRange().getValues();
    for (var i = 0; i < range.length; i++) {
      if (range[i][0].toString() === data.ticker) { wl.deleteRow(i+1); break; }
    }
    return ContentService.createTextOutput('ok');
  }
  
  if (data.action === 'pin') {
    var pinSheet = ss.getSheetByName('pinned');
    if (!pinSheet) { pinSheet = ss.insertSheet('pinned'); pinSheet.appendRow(['ticker','tab']); }
    pinSheet.appendRow([data.ticker, data.tab]);
    return ContentService.createTextOutput('ok');
  }
  
  if (data.action === 'unpin') {
    var pinSheet = ss.getSheetByName('pinned');
    if (pinSheet) {
      var rows = pinSheet.getDataRange().getValues();
      for (var i = rows.length-1; i >= 0; i--) {
        if (rows[i][0].toString() === data.ticker && rows[i][1] === data.tab) { pinSheet.deleteRow(i+1); break; }
      }
    }
    return ContentService.createTextOutput('ok');
  }
  
  return ContentService.createTextOutput('unknown action');
}
