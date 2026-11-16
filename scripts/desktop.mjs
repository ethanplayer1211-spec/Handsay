import { app, BrowserWindow, session, shell, ipcMain } from 'electron';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';
import { configureDesktopRuntime } from '../shared/desktop-runtime.mjs';
import { DesktopSettings, desktopSettingsRequest } from '../shared/desktop-settings.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const startupCheck=process.argv.includes('--startup-check');
const paths=configureDesktopRuntime(app,{root,...(startupCheck && process.env.HANDSAY_STARTUP_CHECK_ROOT ? {runtimeRoot:process.env.HANDSAY_STARTUP_CHECK_ROOT} : {})});
app.commandLine.appendSwitch('force-renderer-accessibility');
let server,mainWindow;
app.on('second-instance',()=>{
  if(mainWindow && !mainWindow.isDestroyed()){
    if(mainWindow.isMinimized())mainWindow.restore();
    if(!startupCheck){mainWindow.show();mainWindow.focus();}
  }
  console.log('Handsay received a second launch; kept the existing instance.');
});
async function startDesktop() {
app.setAccessibilitySupportEnabled(true);
server = createApp({desktop:true});
await new Promise((resolveListen,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolveListen); });
const origin = `http://127.0.0.1:${server.address().port}`;
const trusted = url => { try { return new URL(url).origin === origin; } catch { return false; } };
const preferences=new DesktopSettings(resolve(paths.profile,'preferences.json'));
ipcMain.on('handsay:preferences',(event,request)=>{
  event.returnValue=desktopSettingsRequest(event,mainWindow?.webContents,origin,preferences,request);
});
// Avoid creating Electron's implicit default disk-backed Session.
const desktopSession=session.fromPath(paths.session,{cache:false});
desktopSession.setPermissionCheckHandler((_contents,permission,requestingOrigin,details) => {
  if (!trusted(requestingOrigin)) return false;
  if (permission === 'media') return details.mediaType === 'video';
  return permission === 'clipboard-sanitized-write' || permission === 'fullscreen';
});
desktopSession.setPermissionRequestHandler((contents,permission,callback,details) => {
  const videoOnly = permission === 'media' && details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'video';
  callback(trusted(details.requestingUrl || contents?.getURL()) && (videoOnly || permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));
});
const window = mainWindow = new BrowserWindow({width:1360,height:900,minWidth:780,minHeight:620,title:'Handsay — Interview and camera output',backgroundColor:'#f8fafd',show:false,
  webPreferences:{preload:resolve(root,'scripts/preload.cjs'),session:desktopSession,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});
window.webContents.on('preload-error',(_event,_path,error)=>{console.error('Handsay preferences preload failed:',error.message);});
window.setMenuBarVisibility(false);
window.webContents.setWindowOpenHandler(({url}) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return {action:'deny'}; });
window.webContents.on('will-navigate',(event,url) => { if (!trusted(url)) event.preventDefault(); });
await window.loadURL(origin);
if(!startupCheck){window.show();window.webContents.focus();}
window.on('closed',()=>{mainWindow=null;});
console.log(`Handsay desktop ready at ${origin}. Camera and microphone remain off until requested; microphone requests are denied.`);
if(startupCheck){
  console.log('HANDSay_STARTUP_CHECK '+JSON.stringify({origin,profile:paths.profile,session:paths.session,httpDiskCache:false}));
  setTimeout(()=>app.quit(),12000).unref();
}
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{ server?.close(); server?.closeAllConnections(); });
}
if(!paths.primary){
  console.log('Handsay is already running. Using the existing window.');app.quit();
}else{
  app.whenReady().then(startDesktop).catch(error=>{console.error(error);app.quit();});
}
