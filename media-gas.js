function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

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

    var indexSheet = ss.getSheetByName('media_index');
    var sheetNames = indexSheet.getDataRange().getValues().slice(1).map(function(r){return r[0]});
    var lastSheetName = sheetNames[sheetNames.length - 1];
    var lastSheet = ss.getSheetByName(lastSheetName);

    // Collect existing IDs with their sheet/row location
    var existingIds = {};
    sheetNames.forEach(function(name) {
      var s = ss.getSheetByName(name);
      if (s && s.getLastRow() > 1) {
        var data = s.getRange(2, 1, s.getLastRow()-1, 5).getValues();
        data.forEach(function(r, idx) {
          if (r[0]) existingIds[r[0].toString()] = {sheetName: name, row: idx + 2};
        });
      }
    });

    // Get full Drive path
    function getFolderPath(folder) {
      var parts = [];
      var current = folder;
      while (true) {
        parts.unshift(current.getName());
        var parents = current.getParents();
        if (parents.hasNext()) {
          current = parents.next();
          if (!current.getParents().hasNext()) break;
        } else {
          break;
        }
      }
      return parts.join('/');
    }

    var rootFolder = DriveApp.getFolderById(folderId);
    var basePath = getFolderPath(rootFolder);

    var count = 0;
    var skipped = 0;
    var updated = 0;

    function scanDir(folder, path) {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fileId = file.getId();
        var categoryEncoded = Utilities.base64Encode(Utilities.newBlob(path).getBytes());

        if (existingIds[fileId]) {
          var loc = existingIds[fileId];
          var existingSheet = ss.getSheetByName(loc.sheetName);
          var existingCategory = existingSheet.getRange(loc.row, 5).getValue();
          if (existingCategory !== categoryEncoded) {
            existingSheet.getRange(loc.row, 5).setValue(categoryEncoded);
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

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

        lastSheet.appendRow([fileId, file.getName(), type, file.getDateCreated().toISOString().slice(0,10), categoryEncoded]);
        existingIds[fileId] = {sheetName: lastSheetName, row: lastSheet.getLastRow()};
        count++;
      }

      var subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        var sub = subfolders.next();
        var subPath = path + '/' + sub.getName();
        scanDir(sub, subPath);
      }
    }

    scanDir(rootFolder, basePath);

    // Write scan report to scan_report sheet
    var reportSheet = ss.getSheetByName('scan_report');
    if (!reportSheet) {
      reportSheet = ss.insertSheet('scan_report');
      reportSheet.appendRow(['timestamp', 'count', 'skipped', 'updated', 'folder']);
    }
    reportSheet.appendRow([new Date().toISOString(), count, skipped, updated, basePath]);

    return ContentService.createTextOutput(JSON.stringify({success:true, count:count, skipped:skipped, updated:updated})).setMimeType(ContentService.MimeType.JSON);
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

function migrateFromOldSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oldSs = SpreadsheetApp.openById('12GcnSkOnxfZoiMU6a7402fmZ-h3MIxusBB4nbMChB2s');
  var oldIndex = oldSs.getSheetByName('media_index');
  var indexSheet = ss.getSheetByName('media_index');
  if (!indexSheet) indexSheet = ss.insertSheet('media_index');
  indexSheet.clear();
  var indexData = oldIndex.getDataRange().getValues();
  if (indexData.length) indexSheet.getRange(1,1,indexData.length,indexData[0].length).setValues(indexData);
  var sheetNames = indexData.slice(1).map(function(r){return r[0]});
  sheetNames.forEach(function(name) {
    var oldSheet = oldSs.getSheetByName(name);
    if (!oldSheet) return;
    var newSheet = ss.getSheetByName(name);
    if (!newSheet) newSheet = ss.insertSheet(name);
    newSheet.clear();
    var data = oldSheet.getDataRange().getValues();
    if (data.length) newSheet.getRange(1,1,data.length,data[0].length).setValues(data);
  });
}

function testAuth() {
  DriveApp.getRootFolder();
  Logger.log('Drive auth OK');
}
