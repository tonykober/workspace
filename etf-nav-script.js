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
