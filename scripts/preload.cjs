const {contextBridge, ipcRenderer} = require('electron');
function request(operation,key,value) {
  const reply=ipcRenderer.sendSync('handsay:preferences',{operation,key,value});
  if(!reply?.ok)throw new Error(reply?.error || 'Desktop preferences are unavailable');
  return reply.value;
}
contextBridge.exposeInMainWorld('handsayStorage',{
  getItem:key=>request('get',key),
  setItem:(key,value)=>request('set',key,value),
  removeItem:key=>request('remove',key),
});
