function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('items');
  if (!sheet) sheet = ss.insertSheet('items');

  if (body.action === 'save') {
    sheet.clear();
    if (body.items && body.items.length) {
      var data = body.items.map(function(i){return [i.title||'',i.desc||'',i.icon||'',i.path||'',i.date||'',i.archived?'TRUE':'FALSE']});
      sheet.getRange(1,1,data.length,6).setValues(data);
    }
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'addCard') {
    sheet.appendRow([body.title||'', body.desc||'', body.icon||'📄', body.path||'', body.date||new Date().toISOString().slice(0,10), 'FALSE']);
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'removeCard') {
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length-1; i >= 0; i--) {
      if (rows[i][3] === body.path) { sheet.deleteRow(i+1); break; }
    }
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'archiveCard') {
    var rows = sheet.getDataRange().getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][3] === body.path) { sheet.getRange(i+1, 6).setValue('TRUE'); break; }
    }
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'restoreCard') {
    var rows = sheet.getDataRange().getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][3] === body.path) { sheet.getRange(i+1, 6).setValue('FALSE'); break; }
    }
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'addMedia') {
    var indexSheet = ss.getSheetByName('media_index');
    var sheetNames = indexSheet.getDataRange().getValues().slice(1).map(function(r){return r[0]});
    var lastSheetName = sheetNames[sheetNames.length - 1];
    var lastSheet = ss.getSheetByName(lastSheetName);
    if (lastSheet.getLastRow() > 3000) {
      var newName = 'media_' + (sheetNames.length + 1);
      lastSheet = ss.insertSheet(newName);
      lastSheet.appendRow(['id', 'title', 'type', 'date', 'category']);
      indexSheet.appendRow([newName]);
    }
    lastSheet.appendRow([body.id||'', body.title||'', body.type||'video', body.date||new Date().toISOString().slice(0,10), body.category||'']);
    return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'scanFolder') {
    var folderId = body.folderId;
    var category = body.category || '';
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();

    var indexSheet = ss.getSheetByName('media_index');
    var sheetNames = indexSheet.getDataRange().getValues().slice(1).map(function(r){return r[0]});
    var lastSheetName = sheetNames[sheetNames.length - 1];
    var lastSheet = ss.getSheetByName(lastSheetName);

    var count = 0;
    while (files.hasNext()) {
      var file = files.next();
      var type = 'video';
      var mime = file.getMimeType();
      if (mime.indexOf('image') >= 0) type = 'image';
      else if (mime.indexOf('audio') >= 0) type = 'audio';
      else if (mime.indexOf('pdf') >= 0) type = 'pdf';

      if (lastSheet.getLastRow() > 3000) {
        var newName = 'media_' + (sheetNames.length + 1);
        lastSheet = ss.insertSheet(newName);
        lastSheet.appendRow(['id', 'title', 'type', 'date', 'category']);
        indexSheet.appendRow([newName]);
        sheetNames.push(newName);
      }

      lastSheet.appendRow([file.getId(), file.getName(), type, file.getDateCreated().toISOString().slice(0,10), category]);
      count++;
    }
    return ContentService.createTextOutput(JSON.stringify({success:true, count:count})).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({error:'unknown'})).setMimeType(ContentService.MimeType.JSON);
}

function importMediaData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var baseUrl = 'https://raw.githubusercontent.com/tonykober/workspace/main/';
  var parts = ['video_data_part1.json', 'video_data_part2.json', 'video_data_part3.json'];
  parts.forEach(function(file, idx) {
    var sheetName = 'media_' + (idx + 1);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();
    sheet.appendRow(['id', 'title', 'type', 'date', 'category']);
    var data = JSON.parse(UrlFetchApp.fetch(baseUrl + file, {muteHttpExceptions:true}).getContentText());
    if (data && data.length) {
      var rows = data.map(function(item) {
        return [item.id||'', item.title||'', item.type||'video', item.date||'', item.category||''];
      });
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    Utilities.sleep(1000);
  });
  var indexSheet = ss.getSheetByName('media_index');
  if (!indexSheet) indexSheet = ss.insertSheet('media_index');
  indexSheet.clear();
  indexSheet.appendRow(['sheet_name']);
  indexSheet.appendRow(['media_1']);
  indexSheet.appendRow(['media_2']);
  indexSheet.appendRow(['media_3']);
}
