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
    var basePath = body.basePath || '';
    
    var indexSheet = ss.getSheetByName('media_index');
    var sheetNames = indexSheet.getDataRange().getValues().slice(1).map(function(r){return r[0]});
    var lastSheetName = sheetNames[sheetNames.length - 1];
    var lastSheet = ss.getSheetByName(lastSheetName);
    
    // Collect existing IDs for duplicate check
    var existingIds = {};
    sheetNames.forEach(function(name) {
      var s = ss.getSheetByName(name);
      if (s && s.getLastRow() > 1) {
        var ids = s.getRange(2, 1, s.getLastRow()-1, 1).getValues();
        ids.forEach(function(r) { if (r[0]) existingIds[r[0].toString()] = true; });
      }
    });
    
    var count = 0;
    
    // Recursive scan function
    function scanDir(folder, path) {
      // Scan files in this folder
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fileId = file.getId();
        
        // Skip duplicates
        if (existingIds[fileId]) continue;
        
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
        
        lastSheet.appendRow([fileId, file.getName(), type, file.getDateCreated().toISOString().slice(0,10), path]);
        existingIds[fileId] = true;
        count++;
      }
      
      // Recurse into subfolders
      var subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        var sub = subfolders.next();
        var subPath = path ? path + '/' + sub.getName() : sub.getName();
        scanDir(sub, subPath);
      }
    }
    
    var rootFolder = DriveApp.getFolderById(folderId);
    var rootPath = basePath || rootFolder.getName();
    scanDir(rootFolder, rootPath);
    
    return ContentService.createTextOutput(JSON.stringify({success:true, count:count})).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({error:'unknown'})).setMimeType(ContentService.MimeType.JSON);
}

// 一次性：從舊 Sheet 搬移 media 資料到這份 Sheet
function migrateFromOldSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oldSs = SpreadsheetApp.openById('12GcnSkOnxfZoiMU6a7402fmZ-h3MIxusBB4nbMChB2s');
  
  // Copy media_index
  var oldIndex = oldSs.getSheetByName('media_index');
  var indexSheet = ss.getSheetByName('media_index');
  if (!indexSheet) indexSheet = ss.insertSheet('media_index');
  indexSheet.clear();
  var indexData = oldIndex.getDataRange().getValues();
  if (indexData.length) indexSheet.getRange(1,1,indexData.length,indexData[0].length).setValues(indexData);
  
  // Copy each media sheet
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
  
  Logger.log('Migration complete: ' + sheetNames.length + ' sheets copied');
}

// 授權測試用
function testAuth() {
  DriveApp.getRootFolder();
  Logger.log('Drive auth OK');
}
