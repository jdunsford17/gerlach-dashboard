// Gerlach EMS daily ImageTrend import. No credentials belong in this code.
// Run install once. Copy SETUP_CODE from Project Settings > Script properties.
const GERLACH_SUBJECT = 'Scheduled Report: Gerlach EMS Operations and Crew Records';
const GERLACH_SENDER = 'noreply@imagetrend.com';
function install() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('SETUP_CODE', Utilities.getUuid() + Utilities.getUuid());
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'checkReport').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkReport').timeBased().everyMinutes(5).create();
  GmailApp.getUserLabelByName('Gerlach EMS/Imported') || GmailApp.createLabel('Gerlach EMS/Imported');
}
function doPost(e) {
  const p = PropertiesService.getScriptProperties();
  const b = JSON.parse(e.postData.contents);
  const code = p.getProperty('SETUP_CODE');
  if (!code || b.setupCode !== code) return json_({configured:false});
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?\/api\/statistics\/email$/.test(b.endpoint) || !b.importToken) return json_({configured:false});
  p.setProperties({ENDPOINT:b.endpoint, IMPORT_TOKEN:b.importToken});
  p.deleteProperty('SETUP_CODE');
  return json_({configured:true});
}
function json_(b) { return ContentService.createTextOutput(JSON.stringify(b)).setMimeType(ContentService.MimeType.JSON); }
function checkReport() {
  const clock = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'HHmm');
  if (!(clock >= '2340' || clock <= '0015')) return;
  checkReportNow();
}
// Run this manually after connecting to test without waiting until tonight.
function checkReportNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const p = PropertiesService.getScriptProperties();
    if (!p.getProperty('ENDPOINT')) return;
    const messages = GmailApp.search('from:' + GERLACH_SENDER + ' subject:"' + GERLACH_SUBJECT + '" has:attachment newer_than:3d', 0, 50)
      .flatMap(t => t.getMessages())
      .filter(m => m.getSubject() === GERLACH_SUBJECT && /(?:^|<)noreply@imagetrend\.com>?$/i.test(m.getFrom().trim()))
      .sort((a,b) => b.getDate().getTime() - a.getDate().getTime());
    if (!messages.length) return;
    const message = messages[0];
    if (p.getProperty('LAST_MESSAGE') === message.getId()) return;
    const files = message.getAttachments({includeInlineImages:false}).filter(a => /\.csv$/i.test(a.getName()));
    if (files.length !== 1) throw new Error('Expected exactly one CSV attachment. Existing dashboard statistics retained.');
    if (files[0].getBytes().length > 8000000) throw new Error('CSV exceeds 8 MB. Existing dashboard statistics retained.');
    const result = UrlFetchApp.fetch(p.getProperty('ENDPOINT'), {
      method:'post', contentType:'application/json', followRedirects:false, muteHttpExceptions:true,
      headers:{Authorization:'Bearer ' + p.getProperty('IMPORT_TOKEN')},
      payload:JSON.stringify({csv:files[0].getDataAsString('UTF-8'), messageId:message.getId(), receivedAt:message.getDate().toISOString()})
    });
    let data;
    try { data = JSON.parse(result.getContentText()); } catch (_) { throw new Error('Dashboard did not accept the import. Check the connection.'); }
    if (result.getResponseCode() !== 200 || !data.saved) throw new Error('Import failed. Existing statistics retained. Check the report or dashboard connection.');
    p.setProperties({LAST_MESSAGE:message.getId(), LAST_SUCCESS:new Date().toISOString()});
    message.getThread().addLabel(GmailApp.getUserLabelByName('Gerlach EMS/Imported') || GmailApp.createLabel('Gerlach EMS/Imported'));
  } finally { lock.releaseLock(); }
}
