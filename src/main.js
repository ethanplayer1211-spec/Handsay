import './style.css';
import { ModelClient } from './ml/model-client';
import { TrackerClient } from './ml/tracker-client';
import { Recognizer } from './ml/recognizer';
import { matchGesture, addTake, isReady } from './ml/prototypes';
import { dictionaryUrl } from './ml/meta';
import { loadReplayClips } from './replay/clips';
import { LEFT_HAND_START, RIGHT_HAND_START, POSE_START, HAND_CONNECTIONS, POSE_CONNECTIONS, LIPS } from './ml/landmarks';
import { appendWord, readableCaption, displayScore, validateStoredGestures } from './caption.js';
import { checkTracker } from './tracker-check.js';
import { LiveCaptionGate } from './live-caption.js';
import { classifySegment } from './ml/consensus';
import { captionStyle, removeLastWord, finishSentence } from './caption-overlay.js';
import { HeadGestureDetector, headPoseFromFrame } from './head-gestures.js';
import { handSpeed, LIVE_SEGMENTER } from './ml/segmenter';
import { LiveVoiceQueue, chooseVoices, introductionText } from './voice.js';
import { LivePreview } from './ml/live-preview';
import { CaptionDisplay, CAPTION_TIMES, wordCount } from './caption-display.js';
import { frameStatus } from './ml/segmenter';
import { CameraOutput } from './camera-output.js';
import { OverlayMemory } from './ml/overlay-memory';
import { AvatarDemo } from './avatar-demo.js';
import { waitForVideo } from './media-ready.js';
import { renderPrivateVideo, privacyMode, strongerPrivacy } from './video-privacy.js';
import { renderCameraOutput } from './camera-output.js';
import { ClipRecorder } from './clip-recorder.js';
import { renderAvatarVideo } from './avatar-video.js';
import { captionContent } from './caption-surface.js';
import { automaticChoice } from './ml/recognition-choice';
import { AutomaticMessage } from './automatic-message.js';
import {gestureQuality,matchPersonalGesture} from './ml/personal-gestures';

const $ = id => document.getElementById(id);
// Browser storage stays unchanged. Desktop exposes only a small preferences API;
// it never persists transcripts, introduction details or room access keys.
const preferences = {
  getItem:key=>(window.handsayStorage || localStorage).getItem(key),
  setItem:(key,value)=>(window.handsayStorage || localStorage).setItem(key,value),
};
const canvas = $('landmarkCanvas');
const ctx = canvas.getContext('2d');
const overlayMemory = new OverlayMemory();
const avatarDemo = new AvatarDemo({canvas:$('avatarCanvas'), start:$('playAvatar'), pixels:$('checkAvatarPixels'), caption:$('avatarCaption'), phase:$('avatarPhase'), reference:$('avatarReference'), results:$('avatarResults'), vision:$('avatarVisionStatus')});
const video = $('cameraVideo');
const storageKey = 'handsay.gestures.v1';
let model = null, loading = null, tracker = null, recognizer = null, stream = null;
let startingCamera = false, cameraGeneration = 0, cameraActive = false, overlay = true;
let replayGeneration = 0, replaying = false, clips = [], lastSpoken = '', trainingId = null;
let trainingReplaceIndex=null;
let provisionalWord = '', samplePreview = null;
let recognitionPhase = 'idle';
const liveTiming = () => ({ ...LIVE_SEGMENTER, stillMs: Number($('finishHold').value) });
const captionDisplay = new CaptionDisplay(), viewerDisplay = new CaptionDisplay();
let singleDraftTimer, previewStyleTimer, voiceDraft = '', handsAbsentSince = null, roomVersion = 0, interviewActive = false;
let lastTypedAt = 0;
let outgoingSent = null, broadcastIntro = false;
const isEditing = () => Date.now() - lastTypedAt < 1500 && [$('cameraCaptionText'), $('draftCaption')].includes(document.activeElement);
let records = [], gestures = [], room = null, cursor = 0, roomTimer = null, roomBusy = false;
let activeView = 'conversation', toastTimer;
const liveGate = new LiveCaptionGate();
const automaticMessage=new AutomaticMessage();
let liveUndo = [], liveShareTimer, liveShareQueue = Promise.resolve(), liveShareGeneration = 0;
let captionPreview = false, overlayFinished = '', clearedSentence = '', previousHeadFrame = null, lastHandMotionAt = 0, headSuppressUntil = 0;
const headDetector = new HeadGestureDetector();
let currentCaptionStyle = captionStyle();
let introActive = false, introWelcomeWasVisible = true, availableVoices = [], activeUtterance = null, speechWatchdog;
let introShared = false;
let lastCameraFrame=null;
let avatarRecordStage='intro',avatarRecordGeneration=0;
let avatarRecordPreparing=false;
let recordingPrivacy='silhouette';
let voicePrefs = { profile: 'female', female: '', male: '', rate: 1 };
const liveVoice = new LiveVoiceQueue({
  speak: (text, end, fail) => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { fail(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    const selected = availableVoices.find(v => v.voiceURI === voicePrefs[voicePrefs.profile]);
    if (selected) { utterance.voice = selected; utterance.lang = selected.lang; } else utterance.lang = 'en-US';
    utterance.rate = voicePrefs.rate; activeUtterance = utterance;
    let watchdog;
    const finish = fn => { clearTimeout(watchdog); if (activeUtterance === utterance) activeUtterance = null; fn(); };
    utterance.onend = () => finish(end); utterance.onerror = () => finish(fail);
    watchdog = setTimeout(() => finish(fail), 90000); speechWatchdog = watchdog;
    window.speechSynthesis.resume(); window.speechSynthesis.speak(utterance);
  },
  cancel: () => { clearTimeout(speechWatchdog); activeUtterance = null; window.speechSynthesis?.cancel(); },
  status: message => { $('voiceStatus').textContent = message.length > 125 ? message.slice(0,122) + '…' : message; $('voiceStatus').title = message; $('conversationVoiceStatus').textContent = message.length > 95 ? message.slice(0,92) + '…' : message; },
  disabled: () => { voiceDraft = ''; $('liveSpeech').checked = false; $('speakOnConfirm').checked = false; $('speakOnConfirm').disabled = false; syncSessionControls(); },
});
const hash = new URLSearchParams(location.hash.slice(1));
const viewer = hash.has('view');
const viewerRoom = { id: hash.get('view'), readKey: hash.get('key') };
const callOutput = new CameraOutput({canvas:$('callOutputCanvas'),state:getCallFrameState,onState:message=>{
  $('callOutputStatus').textContent=message;syncCallOutputControls();
}});
const avatarVideoCanvas=document.createElement('canvas');avatarVideoCanvas.width=1280;avatarVideoCanvas.height=720;
const avatarRecorder=new ClipRecorder({canvas:avatarVideoCanvas,render:()=>renderAvatarVideo(avatarVideoCanvas,$('avatarCanvas'),{stage:avatarRecordStage,caption:$('avatarCaption').textContent,reference:$('avatarReference').textContent,phase:$('avatarPhase').textContent}),onState:message=>{
  $('avatarRecordStatus').textContent=message;syncRecordingControls();
}});
const cameraVideoCanvas=document.createElement('canvas');cameraVideoCanvas.width=1280;cameraVideoCanvas.height=720;
const cameraRecorder=new ClipRecorder({canvas:cameraVideoCanvas,render:()=>{
  const state=getCallFrameState();recordingPrivacy=strongerPrivacy(recordingPrivacy,state.privacy);
  renderCameraOutput(cameraVideoCanvas,{...state,privacy:recordingPrivacy});
},onState:message=>{
  $('cameraRecordStatus').textContent=message;syncRecordingControls();
}});
function syncRecordingControls() {
  const avatarBusy=avatarRecordPreparing||avatarRecorder.active||avatarRecorder.finishing;
  $('recordAvatar').disabled=avatarBusy||cameraRecorder.active||cameraRecorder.finishing;
  $('recordCamera').disabled=cameraRecorder.active||cameraRecorder.finishing||avatarBusy;
  $('stopCameraRecording').disabled=!cameraRecorder.active;
  $('playAvatar').disabled=avatarBusy;
  $('checkAvatarPixels').disabled=avatarBusy;
  $('avatarDropouts').disabled=avatarBusy;
}
function offerClip(id,result,name) {
  const link=$(id);link.hidden=!result;
  if(result){link.href=result.url;link.download=name;}
}
function getCallFrameState() {
  const display=captionDisplay.view(), live=$('callCaptionMode').value==='live';
  const sent=outgoingSent && Date.now()-outgoingSent.at<10000 ? outgoingSent.text : '';
  let text=sent,label='Sent message';
  if(live){
    text=captionContent(display);
    label=display.kind==='sent'?'Sent message':'Live draft';
  }
  return {video,videoActive:cameraActive,testPattern:$('callTestPattern').checked,
    sample:replaying || $('sourceBadge').textContent.includes('SAMPLE'),
    privacy:privacyMode($('videoPrivacy').value),landmarks:lastCameraFrame&&Date.now()-lastCameraFrame.at<800?(lastCameraFrame.displayFrame||lastCameraFrame.frame):null,
    text,label,showCaptionLabel:false,intro:introActive&&broadcastIntro?$('introCaption').textContent:'',style:currentCaptionStyle};
}
function syncCallOutputControls() {
  $('startCallOutput').disabled=callOutput.active||callOutput.starting;
  $('stopCallOutput').disabled=!callOutput.active;
  $('callOutputBadge').hidden=!callOutput.active;
  $('openCallOutput').textContent=callOutput.active?'Call camera on':'Use in calls';
  $('sendIntroToCall').disabled=!callOutput.active||broadcastIntro;
}
$('openCallOutput').onclick=async()=>{
  $('cameraOutputDialog').showModal();callOutput.setPreview(true);
  try {
    const info=await callOutput.info();
    if(!callOutput.active)$('callOutputStatus').textContent=!info.supported?'Native camera output currently supports Windows with OBS Studio.':!info.setupReady?'Run npm run setup:camera once, with OBS Studio installed.':info.active?'Another Handsay window is already using the camera output. Stop it there first.':'Ready. Start output, then choose OBS Virtual Camera in your call app.';
    if(!info.setupReady)$('startCallOutput').disabled=true;
  }catch(e){$('callOutputStatus').textContent=e.message;}
};
$('closeCameraOutput').onclick=()=>{$('cameraOutputDialog').close();callOutput.setPreview(false);};
$('cameraOutputDialog').addEventListener('close',()=>callOutput.setPreview(false));
$('startCallOutput').onclick=async()=>{try{if(await callOutput.start())enterInterview();}catch{}finally{syncCallOutputControls();}};
$('stopCallOutput').onclick=()=>callOutput.stop();
$('openRecording').onclick=()=>$('openCallOutput').onclick();
$('videoPrivacy').onchange=()=>{
  $('cameraStage').dataset.privacy=privacyMode($('videoPrivacy').value);
  if(cameraActive&&lastCameraFrame)drawFrame(lastCameraFrame.frame);
  else if(privacyMode($('videoPrivacy').value)!=='camera')renderPrivateVideo(canvas,null,$('videoPrivacy').value,{showStatus:false});
  $('privacyStatus').textContent=$('videoPrivacy').value==='camera'?'Camera image visible in preview, recordings and call output.':'Camera image hidden in preview, recordings and call output. Recognition still uses your camera locally.';
};
$('recordCamera').onclick=()=>{
  try {
    $('cameraVideoDownload').hidden=true;
    recordingPrivacy=privacyMode($('videoPrivacy').value);
    void cameraRecorder.start().then(result=>offerClip('cameraVideoDownload',result,'Handsay-private-camera.webm'));
    syncRecordingControls();
  }catch(e){$('cameraRecordStatus').textContent=e.message;syncRecordingControls();}
};
$('stopCameraRecording').onclick=()=>cameraRecorder.stop();
$('sendIntroToCall').onclick=()=>{if(!callOutput.active)return;broadcastIntro=true;$('sendIntroToCall').textContent='Introduction visible in call';syncCallOutputControls();};
async function refreshCameras() {
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try {
    const selected=$('cameraDevice').value,devices=await navigator.mediaDevices.enumerateDevices();
    const options=[new Option('System default camera','')];
    for(const device of devices.filter(d=>d.kind==='videoinput'&&!/OBS Virtual Camera|Handsay/i.test(d.label)))options.push(new Option(device.label||`Camera ${options.length}`,device.deviceId));
    $('cameraDevice').replaceChildren(...options);
    if(options.some(o=>o.value===selected))$('cameraDevice').value=selected;
  }catch{}
}
$('cameraDevice').onchange=()=>{if(cameraActive){stopCamera(false);void startCamera();}};
navigator.mediaDevices?.addEventListener?.('devicechange',refreshCameras);
window.addEventListener('hashchange', () => {
  const next = new URLSearchParams(location.hash.slice(1));
  if ((viewer || next.has('view')) && (next.get('view') !== viewerRoom.id || next.get('key') !== viewerRoom.readKey)) location.reload();
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault(); const target = viewer ? $('viewerQuestion') : $('draftCaption');
  target.focus(); target.scrollIntoView({block:'center'});
});

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000);
}
function error(message) { $('errorBanner').textContent = message; $('errorBanner').hidden = false; }
function clearError() { $('errorBanner').hidden = true; }
function refreshVoices() {
  availableVoices = window.speechSynthesis?.getVoices() ?? [];
  const choices = chooseVoices(availableVoices, voicePrefs);
  for (const profile of ['female','male']) voicePrefs[profile] = choices[profile]?.voiceURI ?? '';
  const select = $('voiceChoice'); select.replaceChildren();
  if (!availableVoices.length) {
    const option = document.createElement('option'); option.value=''; option.textContent='System default · no voice list available'; select.append(option);
  } else {
    for (const voice of availableVoices) {
      const option = document.createElement('option'); option.value=voice.voiceURI; option.textContent=`${voice.name} · ${voice.lang}${voice.localService?' · device voice':''}`; select.append(option);
    }
    select.value = voicePrefs[voicePrefs.profile];
  }
  $('voiceAvailability').textContent = !window.speechSynthesis ? 'Speech is unavailable in this browser. Captions still work.' : availableVoices.length === 0 ? 'This browser has not exposed a voice list. The system default may work; two distinct voices cannot be promised here. Try Chrome or Edge if needed.' : choices.female?.voiceURI === choices.male?.voiceURI ? (availableVoices.length === 1 ? 'One voice is available. Both preferences use it; preview to check the sound.' : 'Both preferences currently use the same voice. Select a different available voice if you want two distinct choices.') : 'Preview both preferences and choose the actual voice you like. Available voices vary by browser and device.';
  $('liveSpeech').disabled = !window.speechSynthesis;
  $('previewVoice').disabled = !window.speechSynthesis;
  $('toggleVoice').disabled = !window.speechSynthesis;
}
function saveVoicePrefs() { try { preferences.setItem('handsay.voicePrefs.v1',JSON.stringify(voicePrefs)); } catch {} }
function initVoiceSetup() {
  try {
    const saved=JSON.parse(preferences.getItem('handsay.voicePrefs.v1')||'{}');
    voicePrefs={profile:saved.profile==='male'?'male':'female',female:typeof saved.female==='string'?saved.female.slice(0,500):'',male:typeof saved.male==='string'?saved.male.slice(0,500):'',rate:[.85,1,1.15].includes(saved.rate)?saved.rate:1};
  } catch {}
  $('voicePreset').value=voicePrefs.profile; $('voiceRate').value=String(voicePrefs.rate);
  refreshVoices(); window.speechSynthesis?.addEventListener('voiceschanged',refreshVoices);
  $('introMessage').value=introductionText();
}
$('voicePreset').onchange=()=>{ liveVoice.stop('Voice preference changed. Preview the selected voice.');voicePrefs.profile=$('voicePreset').value;refreshVoices();saveVoicePrefs(); };
$('voiceChoice').onchange=()=>{ liveVoice.stop('Voice changed. Preview it before continuing.');voicePrefs[voicePrefs.profile]=$('voiceChoice').value;saveVoicePrefs(); };
$('voiceRate').onchange=()=>{ liveVoice.stop('Speaking speed changed.');voicePrefs.rate=Number($('voiceRate').value);saveVoicePrefs(); };
$('previewVoice').onclick=()=>speak('Hello. This is the voice I will use for my captions.');
$('liveSpeech').onchange=()=>{
  liveVoice.setEnabled($('liveSpeech').checked);$('speakOnConfirm').disabled=$('liveSpeech').checked;
};
$('stopVoice').onclick=()=>{ $('liveSpeech').checked=false;liveVoice.setEnabled(false);$('speakOnConfirm').disabled=false; };
$('readCaption').onclick=()=>{const text=readableCaption($('draftCaption').value)||lastSpoken;if(text)speak(text);else toast('Sign or type a caption first, then press Read caption aloud.');};
for(const id of ['guideButton'])$(id).onclick=()=>$('guideDialog').showModal();
for(const id of ['closeGuide','doneGuide'])$(id).onclick=()=>$('guideDialog').close();
$('editIntroduction').onclick=()=>{ $('settingsDialog').close(); $('introDialog').showModal(); };
$('closeIntroEditor').onclick=()=>$('introDialog').close();
$('buildIntro').onclick=()=>{$('introMessage').value=introductionText($('introName').value,$('introNeeds').value);};
async function showIntroduction() {
  if ($('settingsDialog').open) $('settingsDialog').close();
  const text=$('introMessage').value.trim().slice(0,1000);
  if(!text){toast('Write your introduction first.');$('introDialog').showModal();return;}
  if($('introDialog').open)$('introDialog').close();
  if(!introActive)introWelcomeWasVisible=!$('cameraWelcome').hidden;
  introActive=true;$('cameraWelcome').hidden=true;liveShareGeneration++;clearTimeout(liveShareTimer);recognizer?.reset();headDetector.cancelMotion();liveVoice.stop();
  introShared = false; $('sendIntroToRoom').disabled = !room; $('sendIntroToRoom').textContent = 'Send to interviewer';
  broadcastIntro=false;$('sendIntroToCall').textContent='Show in call camera';syncCallOutputControls();
  $('introCaption').textContent=text;$('introOverlay').hidden=false;renderCameraCaption();
  $('liveStatus').textContent='Introduction open. Close it to resume signing.';
  $('cameraStage').scrollIntoView({block:'center'});
  $('closeIntro').focus({preventScroll:true});
  if($('speakIntro').checked)speak(text);
  if($('shareIntro').checked) await shareIntroduction();
}
async function shareIntroduction() {
  if (!room || introShared) { if (!room) toast('Invite an interviewer before sending your introduction.'); return; }
  const active = room, entry = addRecord('caption', $('introCaption').textContent);
  $('sendIntroToRoom').disabled = true;
  try {
    await liveShareQueue; const sent = await postRoom('caption',entry.text,entry.clientId,active);
    entry.shared = true; entry.seq = sent.seq; entry.roomId = active.id; introShared = true;
    $('sendIntroToRoom').textContent = 'Introduction sent'; renderRecords();
  } catch(e) { entry.retry = true; renderRecords(); $('sendIntroToRoom').disabled = false; error(`Introduction shown locally but not delivered: ${e.message}`); }
}
$('sendIntroToRoom').onclick = shareIntroduction;
function hideIntroduction() {
  broadcastIntro=false;
  introActive=false;$('introOverlay').hidden=true;$('cameraWelcome').hidden=cameraActive||!introWelcomeWasVisible;liveVoice.stop('Introduction closed. Ready to continue.');recognizer?.reset();renderCameraCaption();
  $('liveStatus').textContent=$('liveEnabled').checked?'Live captions on. Watch the forming word as you sign; pause briefly to check it.':'Live captions paused.';
}
for(const id of ['introduceMyself','showIntroFromEditor','cameraIntroButton'])$(id).onclick=showIntroduction;
$('closeIntro').onclick=hideIntroduction;
$('repeatIntro').onclick=()=>speak($('introCaption').textContent);
$('startSetupCamera').onclick=()=>{ if(introActive)hideIntroduction();if(cameraActive)$('cameraStage').scrollIntoView({block:'center'});else void startCamera(); };
$('setupHeadControls').onclick=()=>{$('headEnabled').closest('details').open=true;$('headEnabled').scrollIntoView({block:'center'});$('headEnabled').focus();};
function renderCameraCaption() {
  if (introActive) { $('cameraCaptions').hidden = true; return; }
  const display = captionDisplay.view();
  provisionalWord = display.preview;
  const editingOverlay = isEditing() && document.activeElement === $('cameraCaptionText');
  const text = captionContent(display,editingOverlay ? $('cameraCaptionText').textContent : null) || (captionPreview ? 'Caption style preview' : '');
  $('cameraCaptions').hidden = !text;
  const sampleSource = $('sourceBadge').textContent.includes('SAMPLE');
  $('cameraCaptionLabel').textContent = sampleSource ? 'Recorded demo · not your message' : '';
  $('cameraCaptionLabel').hidden = !sampleSource;
  $('cameraCaptionText').hidden = !text;
  $('cameraProvisional').hidden = true;
  $('cameraProvisional').textContent = '';
  const cameraVisible = startingCamera || (!!stream && !video.hidden);
  $('cameraStage').dataset.textOnly = String(!cameraActive && !cameraVisible && !replaying && !sampleSource);
  $('cameraWelcome').hidden = cameraActive || cameraVisible || replaying || sampleSource || !!(text || provisionalWord);
  const liveText = captionContent(display);
  if ($('liveCaptionText').textContent !== liveText) $('liveCaptionText').textContent = liveText;
  $('liveProvisional').hidden = true;
  $('liveProvisional').textContent = '';
  if (!editingOverlay) {
    if ($('cameraCaptionText').textContent !== text) $('cameraCaptionText').textContent = text;
    $('cameraCaptionText').scrollTop = $('cameraCaptionText').scrollHeight;
  }
}
function setRecognitionPhase(phase, progress = 0) {
  recognitionPhase = phase;
  const messages = { moving: 'Following your movement · keep signing', holding: 'Hand settled · checking this sign', recovering: 'Brief tracking gap · keeping your sign', checking: 'Checking the complete sign…', idle: '' };
  $('cameraRecognitionHint').textContent = '';
  $('cameraRecognitionHint').hidden = true;
  $('finishProgress').hidden = phase !== 'holding';
  $('finishProgress').value = progress;
  $('finishSign').disabled = !cameraActive || !['moving', 'holding', 'recovering'].includes(phase) || introActive;
  if (phase !== 'idle') $('recognitionState').textContent = messages[phase];
}
function clearProvisional() {
  captionDisplay.clearPreview();
  provisionalWord = '';
  $('liveProvisional').hidden = true;
  $('liveProvisional').textContent = '';
  renderCameraCaption();
}
function presentPreview(result, source = 'camera') {
  if (!$('liveEnabled').checked || trainingId || introActive || isEditing()) { clearProvisional(); return; }
  // Brief tracking gaps and segment completion must not erase a readable word.
  // Source/reset/new-sign events clear the entire candidate explicitly.
  if (!result) { if (source === 'sample') clearProvisional(); return; }
  let text = '';
  if (source!=='sample'&&$('recognitionMode').value === 'personal') {
    const match = matchGesture(result.inference.embedding, gestures, { minSimilarity: .8, margin: .20 });
    if (match.kind === 'match') text = match.gesture.name;
  } else {
    const [best, next] = result.decision.top;
    if (result.decision.kind === 'sign' && best?.probability >= .55 && best.probability - (next?.probability ?? 0) >= .15) text = model.labels[best.index].label;
  }
  captionDisplay.considerPreview(text);
  $('liveStatus').textContent = `${source === 'sample' ? 'Recorded sample · ' : ''}${text ? 'Preview only. A short natural pause checks the word. Continue with the next supported sign; your message stays together.' : 'Still checking. Brief tracking gaps keep your place. Only supported signs or trained personal phrases can be recognized.'}`;
  renderCameraCaption();
}
function setSource(label, hint) {
  $('sourceBadge').textContent = label;
  $('sourceBadge').dataset.live = String(label === 'LIVE CAMERA');
  $('sourceHelp').textContent = hint;
}
function applyCaptionStyle(save = true) {
  currentCaptionStyle = captionStyle({ font: $('captionFont').value, size: Number($('captionSize').value), color: $('captionColor').value, design: $('captionDesign').value, position: $('captionPosition').value, align: $('captionAlign').value, bold: $('captionBold').checked });
  const el = $('cameraCaptions'), s = currentCaptionStyle;
  const fonts = { sans: 'Arial, sans-serif', serif: 'Georgia, serif', mono: 'Consolas, monospace' };
  el.style.setProperty('--caption-font', fonts[s.font]); el.style.setProperty('--caption-size', s.size + 'px');
  el.style.setProperty('--caption-color', s.color); el.style.setProperty('--caption-weight', s.bold ? '700' : '400');
  el.style.setProperty('--caption-align', s.align); el.dataset.position = s.position; el.dataset.design = s.design;
  $('captionSizeValue').textContent = s.size + ' px';
  if (save) { try { preferences.setItem('handsay.captionStyle.v1', JSON.stringify(s)); } catch { toast('Style changed for this session; browser storage was unavailable.'); } }
}
function loadCaptionStyle() {
  try { currentCaptionStyle = captionStyle(JSON.parse(preferences.getItem('handsay.captionStyle.v1') || '{}')); } catch { currentCaptionStyle = captionStyle(); }
  const fields = {font:'captionFont',size:'captionSize',color:'captionColor',design:'captionDesign',position:'captionPosition',align:'captionAlign'};
  for (const [key, id] of Object.entries(fields)) $(id).value = String(currentCaptionStyle[key]);
  $('captionBold').checked = currentCaptionStyle.bold; applyCaptionStyle(false);
}
for (const id of ['captionFont','captionSize','captionColor','captionDesign','captionPosition','captionAlign','captionBold']) $(id).addEventListener('input', () => applyCaptionStyle());
$('resetCaptionStyle').onclick = () => {
  const style = captionStyle();
  for (const [key, id] of Object.entries({font:'captionFont',size:'captionSize',color:'captionColor',design:'captionDesign',position:'captionPosition',align:'captionAlign'})) $(id).value = String(style[key]);
  $('captionBold').checked = style.bold; applyCaptionStyle(); toast('Caption appearance reset.');
};
$('previewCaptionStyle').onclick = () => {
  $('settingsDialog').close();
  if ($('draftCaption').value.trim() || overlayFinished) {
    if ($('draftCaption').value.trim()) captionDisplay.setDraft(readableCaption($('draftCaption').value)); else captionDisplay.showSent(overlayFinished);
    renderCameraCaption(); toast('Showing your message in the selected style.'); return;
  }
  captionPreview = !captionPreview; $('previewCaptionStyle').textContent = captionPreview ? 'Hide preview' : 'Preview style'; renderCameraCaption();
  clearTimeout(previewStyleTimer); if (captionPreview) previewStyleTimer = setTimeout(() => { captionPreview = false; $('previewCaptionStyle').textContent = 'Preview style'; renderCameraCaption(); }, 5000);
};
$('cameraCaptionText').addEventListener('input', () => {
  automaticMessage.reset();
  lastTypedAt = Date.now();
  recognizer?.reset();
  clearTimeout(singleDraftTimer); voiceDraft = ''; captionDisplay.clearPreview();
  liveVoice.stop('Text edited. Use Read caption aloud to speak the corrected text.');
  const value = $('cameraCaptionText').innerText.slice(0,1000);
  leaveRecordedDemo();
  $('draftCaption').value = value; liveUndo = []; captionPreview = false; overlayFinished = ''; updateDraft(); scheduleLiveShare();
});
$('cameraCaptionText').addEventListener('blur', renderCameraCaption);
for (const id of ['cameraCaptionText','draftCaption']) $(id).addEventListener('focus', () => { lastTypedAt = Date.now(); });
$('fullscreenCamera').onclick = async () => {
  const card = $('cameraStage').closest('.camera-card');
  if (card.classList.contains('camera-focus') || document.fullscreenElement) { await exitCameraFocus(); return; }
  try {
    await card.requestFullscreen();
  } catch { card.classList.add('camera-focus'); document.body.style.overflow = 'hidden'; }
  $('exitCameraFocus').hidden = false;
};
async function exitCameraFocus() {
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} }
  $('cameraStage').closest('.camera-card').classList.remove('camera-focus');
  document.body.style.overflow = ''; $('exitCameraFocus').hidden = true;
}
$('exitCameraFocus').onclick = exitCameraFocus;
document.addEventListener('keydown', event => { if (event.key === 'Escape') void exitCameraFocus(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !$('cameraStage').closest('.camera-card').classList.contains('camera-focus')) $('exitCameraFocus').hidden = true; });
function setHeadStatus(message) {
  if ($('headStatus').textContent !== message) $('headStatus').textContent = message;
  $('headCameraHint').hidden = !$('headEnabled').checked;
  if ($('headCameraHint').textContent !== message) $('headCameraHint').textContent = message;
}
$('headEnabled').onchange = () => {
  headDetector.reset(); previousHeadFrame = null; headSuppressUntil = 0; recognizer?.reset();
  $('calibrateHead').disabled = !$('headEnabled').checked;
  setHeadStatus($('headEnabled').checked ? 'Head controls on. Start the camera, then calibrate while facing forward.' : 'Head controls off.');
};
$('calibrateHead').onclick = () => {
  if (!cameraActive) { toast('Start your webcam first. Head controls do not run on recorded samples.'); return; }
  if (trainingId) { toast('Finish or cancel personal gesture recording before calibrating head controls.'); return; }
  headDetector.calibrate(); previousHeadFrame = null; lastHandMotionAt = performance.now(); recognizer?.reset();
  $('settingsDialog').close();
  setHeadStatus('Calibrating: look straight ahead and stay still for 1.2 seconds.');
};
$('shakeAction').onchange = () => { headDetector.cancelMotion(); setHeadStatus(headDetector.base ? 'Shake action changed. Return to neutral before using it.' : 'Shake action changed. Calibrate your neutral head position before using it.'); };
$('restoreSentence').onclick = () => {
  if ($('draftCaption').value.trim()) { toast('Clear the current draft before restoring the cancelled sentence.'); return; }
  $('draftCaption').value = clearedSentence; clearedSentence = ''; $('restoreSentence').hidden = true;
  liveUndo = []; liveGate.reset(); updateDraft(); scheduleLiveShare();
};
function processHeadControls(tracked) {
  if (introActive || $('avatarDialog').open) { headDetector.cancelMotion(); return true; }
  if (!$('headEnabled').checked) return false;
  if (previousHeadFrame && handSpeed(previousHeadFrame, { frame: tracked.frame, t: tracked.t }) > .45) lastHandMotionAt = tracked.t;
  previousHeadFrame = { frame: tracked.frame, t: tracked.t };
  const editing = isEditing();
  const allowed = !!$('draftCaption').value.trim() && !trainingId && !editing && tracked.t - lastHandMotionAt > 800;
  const event = headDetector.push(headPoseFromFrame(tracked.frame, video.videoWidth / video.videoHeight), tracked.t, allowed);
  setHeadStatus(event.message);
  if (event.kind === 'nod' || event.kind === 'shake') {
    headSuppressUntil = tracked.t + 1000; recognizer?.reset();
    if (event.kind === 'nod') { void finishCaption(true); setHeadStatus('Nod: sentence finished. Return to neutral.'); }
    else if ($('shakeAction').value === 'sentence') { clearCaptionSentence(); setHeadStatus('Head shake: current sentence cleared. You can restore it below.'); }
    else { undoCaptionWord(); setHeadStatus('Head shake: last word removed. Return to neutral.'); }
  }
  return headDetector.calibrating || headDetector.phase !== 'idle' || tracked.t < headSuppressUntil;
}
function showTab(name) {
  activeView = name;
  for (const n of ['conversation', 'teach', 'vocabulary']) {
    $(n + 'Panel').hidden = n !== name;
    $(n + 'Tab').classList.toggle('active', n === name);
    $(n + 'Tab').setAttribute('aria-selected', String(n === name));
    $(n + 'Tab').tabIndex = n === name ? 0 : -1;
  }
  if (name === 'vocabulary') renderVocabulary();
}
for (const name of ['conversation', 'teach', 'vocabulary']) $(name + 'Tab').onclick = () => showTab(name);
document.querySelector('[role="tablist"]').addEventListener('keydown', e => {
  const names = ['conversation', 'teach', 'vocabulary'];
  const index = names.indexOf(activeView);
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    showTab(names[next]); $(names[next] + 'Tab').focus();
  }
});
$('backConversation').onclick = () => showTab('conversation');
for (const id of ['aboutButton', 'footerAbout']) $(id).onclick = () => $('aboutDialog').showModal();
$('closeAbout').onclick = () => $('aboutDialog').close();
$('checkDevice').onclick = async () => {
  $('checkDevice').disabled = true;
  $('deviceStatus').textContent = 'Checking the tracking engine on a blank test image. No camera is requested…';
  try {
    const loaded = await ensureModel();
    const result = await checkTracker(loaded.meta.featureSet);
    $('deviceStatus').textContent = `Tracking engine ready (${result.delegate}; 3 blank test frames; ${Math.round(result.ms)} ms average after warm-up). No webcam was opened. This checks compatibility, not signing accuracy or live-camera speed.`;
  } catch (e) { $('deviceStatus').textContent = `Tracking check failed: ${e.message}. Recorded samples and typed captions may still work.`; }
  finally { $('checkDevice').disabled = false; }
};
$('aboutDialog').addEventListener('click', e => { if (e.target === $('aboutDialog')) $('aboutDialog').close(); });

async function ensureModel() {
  if (model?.client.closed) { model = null; loading = null; }
  if (model) return model;
  if (!loading) {
    $('modelBanner').textContent = 'Loading the ASL research model. Your camera is off.';
    loading = ModelClient.load().then(loaded => {
      model = loaded;
      $('modelBanner').textContent = 'ASL model ready · 250 isolated signs · Live captions with an error filter.';
      renderVocabulary(); return model;
    }).catch(e => {
      loading = null;
      $('modelBanner').textContent = 'The sign model could not load. Try a sample or start the camera to retry. Typed captions still work.';
      throw e;
    });
  }
  return loading;
}

function drawFrame(frame, sample = false) {
  const visual = sample ? { frame, held: [] } : overlayMemory.view(frame, performance.now());
  frame = visual.frame;
  if(!sample&&lastCameraFrame)lastCameraFrame.displayFrame=frame;
  const box = $('cameraStage');
  canvas.width = Math.round(box.clientWidth * Math.min(devicePixelRatio || 1, 2));
  canvas.height = Math.round(box.clientHeight * Math.min(devicePixelRatio || 1, 2));
  if(!sample && privacyMode($('videoPrivacy').value)!=='camera') {renderPrivateVideo(canvas,frame,$('videoPrivacy').value,{showStatus:false});return;}
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!overlay && !sample) return;
  const sourceW = sample ? canvas.width : video.videoWidth;
  const sourceH = sample ? canvas.height : video.videoHeight;
  const scale = Math.min(canvas.width / sourceW, canvas.height / sourceH);
  const width = sourceW * scale, height = sourceH * scale;
  const ox = (canvas.width - width) / 2, oy = (canvas.height - height) / 2;
  const point = i => ({ x: frame[i * 3] * width + ox, y: frame[i * 3 + 1] * height + oy });
  const line = (a, b, color, stroke = 2) => {
    const p = point(a), q = point(b);
    if (![p.x, p.y, q.x, q.y].every(Number.isFinite)) return;
    ctx.strokeStyle = color; ctx.lineWidth = stroke; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  };
  for (const [a, b] of POSE_CONNECTIONS) line(POSE_START + a, POSE_START + b, '#a6c5b377', 2);
  for (const start of [LEFT_HAND_START, RIGHT_HAND_START]) {
    const held = visual.held.includes(start);
    ctx.setLineDash(held ? [4, 4] : []);
    const color = held ? '#e0a35a99' : start === LEFT_HAND_START ? '#bff2b1' : '#b1dce8';
    for (const [a, b] of HAND_CONNECTIONS) line(start + a, start + b, color, 2.4);
    for (let i = 0; i < 21; i++) {
      const p = point(start + i); if (!Number.isFinite(p.x + p.y)) continue;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, i % 4 === 0 ? 3.5 : 2.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#b7c9afaa';
  for (const i of LIPS) {
    const p = point(i); if (!Number.isFinite(p.x + p.y)) continue;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
}

function stopCamera(announce = true) {
  lastCameraFrame=null;
  overlayMemory.reset();
  clearProvisional();
  if (cameraActive && !introActive) liveVoice.stop('Camera stopped; queued live voice stopped.');
  cameraGeneration++; cameraActive = false; startingCamera = false; $('startCamera').disabled = false;
  tracker?.dispose(); tracker = null;
  recognizer?.reset(); recognizer = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  video.srcObject = null; video.hidden = true;
  $('startSetupCamera').textContent='Start conversation →';
  headDetector.reset(); previousHeadFrame = null;
  if ($('headEnabled').checked) setHeadStatus('Camera stopped. Recalibrate after starting it again.');
  $('stopCamera').disabled = false; $('stopCamera').textContent = 'Start live camera';
  if (!replaying) {
    $('cameraWelcome').hidden = false;
    setSource('CAMERA OFF', 'Camera is off. Start live camera for your own signs. Recorded samples only replay a demonstration.');
    $('trackingStatus').textContent = 'Camera off';
    $('trackingStats').textContent = '0 physical sensors · webcam vision';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (trainingId && announce) toast('Camera stopped. Start it again to record your gesture.');
  syncSessionControls();
}

async function startCamera() {
  if (introActive) hideIntroduction();
  if (startingCamera || cameraActive) return;
  startingCamera = true; $('startCamera').disabled = true; clearError();
  cancelReplay(); const generation = ++cameraGeneration;
  $('stopCamera').textContent = 'Cancel camera start';
  setSource('STARTING CAMERA', 'Allow camera access in your browser. You can cancel and use text instead.');
  $('trackingStatus').textContent = 'Waiting for camera access…';
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires localhost or HTTPS. Use a secure public URL when deploying.');
    // Starts only after an explicit click. No audio is requested.
    const selected=$('cameraDevice').value;
    const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 640 }, facingMode: 'user',...(selected?{deviceId:{exact:selected}}:{}) }, audio: false });
    if(media.getVideoTracks().some(t=>/OBS Virtual Camera|Handsay/i.test(t.label))){media.getTracks().forEach(t=>t.stop());throw new Error('The virtual output was selected as input. Choose your physical webcam in Settings to avoid a video loop');}
    if (generation !== cameraGeneration || document.hidden) { media.getTracks().forEach(t => t.stop()); return; }
    stream = media; video.srcObject = stream; await waitForVideo(video);
    if (generation !== cameraGeneration) { media.getTracks().forEach(track => track.stop()); return; }
    media.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if (generation !== cameraGeneration)return;stopCamera(false);error('The input camera disconnected. You can keep communicating with typed messages.');},{once:true}));
    void refreshCameras();
    video.hidden = false; $('cameraWelcome').hidden = true;
    setSource('LOADING TRACKING', 'Your webcam is starting. Preparing local recognition…'); $('trackingStatus').textContent = 'Preparing face, body and hand tracking…';
    $('stopCamera').disabled = false; $('stopCamera').textContent = 'Stop camera';
    const loaded = await ensureModel();
    if (generation !== cameraGeneration) return;
    const created = await TrackerClient.create(loaded.meta.featureSet);
    if (generation !== cameraGeneration || document.hidden) { created.dispose(); return; }
    tracker = created; cameraActive = true;
    $('startSetupCamera').textContent='Camera on · go to captions →';
    recognizer = new Recognizer(loaded.meta, loaded.labels, input => loaded.client.infer(input), onRecognition, true, false, liveTiming());
    setSource('LIVE CAMERA', 'Sign supported words with a short natural pause between them. Brief tracking gaps keep your place. Your draft builds as you continue. Whole phrases need My gestures or text.');
    tracker.start(video, frame => {
      lastCameraFrame={frame:frame.frame,at:Date.now()};
      drawFrame(frame.frame);
      $('trackingStats').textContent = `Up to 543 landmarks · ${Math.round(frame.ms)} ms tracking`;
      const status = frameStatus(frame.frame, frame.poses);
      if (status === 'nothing' || status === 'no-hands') {
        handsAbsentSince ??= frame.t;
        if (frame.t - handsAbsentSince >= 500) liveGate.release();
      } else handsAbsentSince = null;
      if (!processHeadControls(frame)) recognizer?.push(frame);
      else recognizer?.reset();
    }, message => { stopCamera(false); $('trackingStatus').textContent = 'Tracking stopped · camera off'; error(`${message}. Your draft is kept. Restart the camera, or type and send a message.`); });
    enterInterview();
    $('cameraStage').scrollIntoView({block:'center'});
    toast('Camera live. Use a short pause between supported signs. You can continue while the previous word is checked.');
  } catch (e) {
    if (generation === cameraGeneration) {
      stopCamera(false);
      const denied = e.name === 'NotAllowedError';
      error(denied ? 'Camera permission was declined. You can continue by typing your message. To try signs, allow camera access in your browser and turn the camera on again.' : e.name === 'NotFoundError' ? 'No camera was found. Type a message to continue the interview.' : `Camera could not start: ${e.message}. You can still type and send messages.`);
    }
  } finally { if (generation === cameraGeneration) { startingCamera = false; $('startCamera').disabled = false; syncSessionControls(); } }
}
$('startCamera').onclick = startCamera;
$('stopCamera').onclick = () => cameraActive || stream || startingCamera ? stopCamera() : startCamera();
$('overlayButton').onclick = () => {
  overlay = !overlay; $('overlayButton').textContent = `Landmarks ${overlay ? 'on' : 'off'}`;
  $('overlayButton').setAttribute('aria-pressed', String(overlay));
  if (!overlay) ctx.clearRect(0, 0, canvas.width, canvas.height);
};

function onRecognition(event) {
  if (event.type === 'reset') {
    clearProvisional();
  } else if (event.type === 'phase') {
    setRecognitionPhase(event.phase, event.progress);
  } else if (event.type === 'preview') {
    presentPreview(event.result);
  } else if (event.type === 'status') {
    const messages = { nothing: 'Step into view, with your face and hands visible', 'no-hands': 'Bring your hands into view', partial: 'Keep both shoulders in view', crowded: 'Please keep one signer in view', ok: 'Live tracking · reading your signs' };
    $('trackingStatus').textContent = messages[event.status] ?? 'Tracking';
  } else if (event.type === 'signing') {
    clearTimeout(singleDraftTimer);
    if(!trainingId&&automaticMessage.begin(event.t,$('draftCaption').value)){
      $('draftCaption').value='';voiceDraft='';liveUndo=[];liveGate.reset();
      captionDisplay.clearLive();liveVoice.stop('New phrase. Ready for the next message.');updateDraft();scheduleLiveShare();
    }
    captionDisplay.beginSign(); renderCameraCaption();
    $('recognitionState').textContent = trainingId ? 'Recording your gesture…' : 'Reading movement…';
  } else if (event.type === 'result') {
    if (trainingId) saveTrainingTake(event.result);
    else if (!event.current) {
      // The next sign is already in progress. Append the completed earlier word
      // without erasing the new preview or changing its capture status.
      const state = $('recognitionState').textContent;
      presentResult(event.result, 'camera', false);
      $('recognitionState').textContent = state; renderCameraCaption();
    }
    else presentResult(event.result, 'camera');
  } else if (event.type === 'error') { if (model?.client.closed) stopCamera(false); else if (event.current !== false) { setRecognitionPhase('idle'); clearProvisional(); } error(`Recognition failed: ${event.message}. Your draft is kept. Restart the camera, or type your message to continue.`); }
  else if (event.type === 'discarded') { clearProvisional(); $('recognitionState').textContent = 'Try a slightly longer, clear sign'; scheduleSingleWordExpiry(); }
}

function presentResult(result, source, current = true) {
  const { decision, inference } = result;
  const target = $('suggestions'); target.replaceChildren();
  const mode=source==='sample'?'asl':$('recognitionMode').value,personal=mode==='personal',combined=mode.startsWith('combined');
  let candidates = [];
  if (personal||combined) {
    const match = matchPersonalGesture(inference.embedding,gestures,{minimum:.70,margin:.08});
    if (match.kind === 'match' && !result.partial) candidates = [{ text: match.gesture.name, score: `Similarity ${match.similarity.toFixed(2)} · personal shortcut` }];
    $('recognitionState').textContent = candidates.length ? 'Personal gesture suggestion' : match.kind === 'empty' ? 'Teach 3 takes of a gesture first' : 'Not sure — please try again';
    $('suggestionNote').textContent = 'Personal gestures use phrases you chose. Similarity is not an accuracy estimate.';
    if(combined){
      candidates.push(...decision.top.map(g=>({text:model.labels[g.index].label,score:displayScore(g.probability),uncertain:decision.kind!=='sign'})));
      candidates=candidates.filter((candidate,index,list)=>list.findIndex(other=>other.text.toLowerCase()===candidate.text.toLowerCase())===index);
      $('recognitionState').textContent='ASL and personal shortcut suggestions';
      $('suggestionNote').textContent=mode==='combined-priority'?'Both are enabled. Verified personal shortcuts take priority. Choose only what you intended.':'Both are enabled. A strong disagreement requires your choice; similarity and model score are different measures.';
    }
  } else {
    candidates = decision.top.map(g => ({ text: model.labels[g.index].label, score: displayScore(g.probability), uncertain: decision.kind !== 'sign' }));
    $('recognitionState').textContent = decision.kind === 'sign' ? 'Choose a word to add' : 'Not sure — review or try again';
    $('suggestionNote').textContent = source === 'sample' ? 'Recorded dataset landmarks · real model inference · no live camera. Scores are not measured accuracy.' : 'Isolated ASL suggestions. Scores are not measured accuracy. Choose only the word you intended.';
  }
  if (result.partial) {
    $('recognitionState').textContent = 'Framing unclear — try again';
    candidates = []; $('suggestionNote').textContent = 'Keep face, shoulders and hands visible. No word was added.';
  }
  if(result.segment.trackingIssue) {
    $('recognitionState').textContent='Hand tracking changed sides · review the word';
    $('suggestionNote').textContent='The tracker changed hand identity during this sign. Automatic text and voice are held back. Choose a suggestion only if it matches what you meant.';
  }
  for (const candidate of candidates) {
    const button = document.createElement('button'); button.className = 'suggestion' + (candidate.uncertain ? ' uncertain' : '');
    const word = document.createElement('span'); word.className = 'word'; word.textContent = candidate.text;
    const meta = document.createElement('span'); meta.className = 'score'; meta.textContent = candidate.score;
    const plus = document.createElement('span'); plus.className = 'plus'; plus.textContent = '+'; plus.setAttribute('aria-hidden', 'true');
    button.append(word, meta, plus);
    button.setAttribute('aria-label', `Add ${candidate.text} to your draft`);
    button.onclick = () => {
      clearTimeout(singleDraftTimer);
      clearProvisional(); recognizer?.reset();
      automaticMessage.reset();liveUndo = []; $('draftCaption').value = appendWord($('draftCaption').value, candidate.text); updateDraft(); scheduleLiveShare();
      addVoiceWord(candidate.text);
      button.classList.add('chosen'); toast(`Added “${candidate.text}” to your draft. Review before confirming.`);
    };
    target.append(button);
    if (source === 'sample') { button.disabled = true; button.setAttribute('aria-label', `Demo prediction: ${candidate.text}`); plus.textContent = ''; }
  }
  if (!candidates.length) {
    const p = document.createElement('p'); p.className = 'empty-suggestions'; p.textContent = 'Nothing certain enough to suggest. Try again, or type your caption.'; target.append(p);
  }
  if (source === 'sample') {
    clearProvisional();
    $('recognitionState').textContent = 'Demo result · read only';
    const best = result.decision.top[0];
    if (best && result.decision.kind === 'sign') captionDisplay.setDraft(model.labels[best.index].label);
    $('liveStatus').textContent = 'Demo complete. Your message, voice and interviewer room were not changed.';
    renderCameraCaption();
  } else {
    if (current) clearProvisional();
    const accepted = updateAutomaticCaption(result, source);
    if (current && !accepted && !result.partial && !isEditing() && !introActive && $('liveEnabled').checked) {
      const [best, next] = decision.top;
      const review = personal ? candidates[0]?.text : best?.probability >= .35 && best.probability - (next?.probability ?? 0) >= .08 ? model.labels[best.index].label : '';
      if (review) {
        captionDisplay.setPreview(review, true);
        $('recognitionState').textContent = 'Possible word · choose only if correct';
      } else $('recognitionState').textContent = 'No clear match · try again or type';
    }
    scheduleSingleWordExpiry(); renderCameraCaption();
  }
}

function updateAutomaticCaption(result, source) {
  if (source !== 'camera') return;
  if (!$('liveEnabled').checked || trainingId || introActive) return;
  if (isEditing()) { $('liveStatus').textContent = 'Editing text: recognition resumes when you stop typing.'; return; }
  if(!automaticMessage.owns($('draftCaption').value)){$('liveStatus').textContent='Your edited message is kept. Choose a suggestion to add to it.';return;}
  const resolved=automaticChoice(result,model.labels,gestures,$('recognitionMode').value,$('liveProfile').value);
  if(!resolved.choice){$('liveStatus').textContent=resolved.reason;return;}
  const {text,probability,runnerUp,verification,personal,personalMargin}=resolved.choice;
  const times=result.segment.timestamps;
  const timing={startAt:times[0],endAt:times.at(-1),personal};
  const plan=automaticMessage.propose($('draftCaption').value,text,timing);
  if(!plan.applied){$('liveStatus').textContent=plan.reason;return;}
  const accepted = liveGate.accept({ text, probability, runnerUp, verification, personal,personalMargin, partial: result.partial, trackingIssue: result.segment?.trackingIssue, durationMs: result.segment?.durationMs, at: performance.now(), profile: $('liveProfile').value });
  $('liveStatus').textContent = `${source === 'sample' ? 'Recorded sample · ' : ''}${accepted.reason}`;
  if (!accepted.accepted) return;
  const change=automaticMessage.append($('draftCaption').value,text,timing);
  if(!change.applied){$('liveStatus').textContent=change.reason;return;}
  if(change.boundary){liveUndo=[];voiceDraft='';liveVoice.stop('New message.');}
  liveUndo.push({ before:change.before, word:text }); $('draftCaption').value=change.text;overlayFinished='';updateDraft();
  scheduleSingleWordExpiry();
  if (source === 'camera') scheduleLiveShare();
  addVoiceWord(text);
  $('recognitionState').textContent = 'Added to your message · review before sending';
  return true;
}

function addVoiceWord(text) {
  if (!liveVoice.enabled) return;
  liveVoice.add(text); voiceDraft = appendWord(voiceDraft, text);
}
function scheduleSingleWordExpiry() {
  clearTimeout(singleDraftTimer);
  const expected = $('draftCaption').value;
  if (wordCount(expected) !== 1 || !liveUndo.length) return;
  singleDraftTimer = setTimeout(() => {
    if ($('draftCaption').value !== expected || [$('cameraCaptionText'), $('draftCaption')].includes(document.activeElement)) return;
    $('draftCaption').value = ''; voiceDraft = ''; liveUndo = [];automaticMessage.reset();
    updateDraft(); scheduleLiveShare();
    $('liveStatus').textContent = 'Single word cleared. Sign a short phrase, or type and send a message.';
  }, CAPTION_TIMES.singleDraft);
}

function scheduleLiveShare() {
  clearTimeout(liveShareTimer);
  liveShareGeneration++;
  if (!room || !$('shareLive').checked) return;
  const text = readableCaption($('draftCaption').value), generation = liveShareGeneration, targetRoom = room;
  liveShareTimer = setTimeout(() => {
    liveShareQueue = liveShareQueue.then(async () => {
      if (generation !== liveShareGeneration || room !== targetRoom || !$('shareLive').checked) return;
      try { await postRoom('live', text, crypto.randomUUID(), targetRoom); }
      catch (e) { $('liveStatus').textContent = `Live text is local; sharing failed: ${e.message}`; }
    });
  }, 200);
}
$('liveEnabled').onchange = () => {
  clearProvisional(); samplePreview?.reset();
  if (!$('liveEnabled').checked) liveVoice.stop('Live captions paused; queued voice stopped.');
  liveGate.reset(); recognizer?.reset();
  $('liveStatus').textContent = $('liveEnabled').checked ? 'Live captions on. Watch the forming word as you sign; pause briefly to check it.' : 'Paused. You can still choose words manually.';
};
$('liveProfile').onchange = () => { liveGate.reset(); $('liveStatus').textContent = 'Filter changed. Thresholds reduce some mistakes; they do not guarantee correctness.'; };
$('finishHold').onchange = () => {
  clearProvisional(); recognizer?.setTiming(liveTiming());
  $('liveStatus').textContent = `Finish-pose wait: ${Number($('finishHold').value) / 1000} seconds. The error filter is unchanged.`;
};
$('finishSign').onclick = () => {
  if (cameraActive && ['moving', 'holding', 'recovering'].includes(recognitionPhase)) recognizer?.flush();
};
$('teachPhrase').onclick = () => { showTab('teach'); $('gesturePhrase').focus(); };
$('undoLive').onclick = undoCaptionWord;
function undoCaptionWord() {
  automaticMessage.reset();
  clearTimeout(singleDraftTimer); voiceDraft = '';
  if (!$('draftCaption').value.trim()) return;
  liveVoice.stop('Word removed; queued voice stopped. Words already heard cannot be recalled.');
  const removed = removeLastWord($('draftCaption').value);
  const change = liveUndo.pop() ?? { before: removed.text, word: removed.word };
  overlayFinished = ''; captionPreview = false;
  $('draftCaption').value = change.before; liveGate.undo(change.word); updateDraft(); scheduleLiveShare();
  recognizer?.reset();
  $('liveStatus').textContent = `Removed “${change.word}”. It will be held back until another word or a reset.`;
}
$('shareLive').onchange = () => {
  liveShareGeneration++; clearTimeout(liveShareTimer);
  $('liveStatus').textContent = $('shareLive').checked ? 'Live text sharing enabled for an active room. Automatic captions may contain errors.' : 'Live text sharing off. Confirmed captions can still be shared.';
  if ($('shareLive').checked) scheduleLiveShare();
  else if (room) { const targetRoom = room; liveShareQueue = liveShareQueue.then(() => postRoom('live', '', crypto.randomUUID(), targetRoom)).catch(e => error(`Could not clear the interviewer draft: ${e.message}`)); }
};

async function openSamples() {
  clearError(); $('sampleControls').hidden = false;
  try {
    if (!clips.length) {
      clips = await loadReplayClips();
      $('sampleSelect').replaceChildren();
      for (const clip of clips) { const o = document.createElement('option'); o.value = clip.id; o.textContent = clip.title; $('sampleSelect').append(o); }
    }
    $('sampleCredit').textContent = `${clips[0]?.credit ?? ''}. Landmark replay, not a live signer. Samples were selected upstream and do not establish app accuracy.`;
  } catch (e) { error(`Samples could not load: ${e.message}`); }
}
function cancelReplay() {
  if ($('sourceBadge').textContent.includes('SAMPLE')) captionDisplay.clear();
  samplePreview?.reset(); samplePreview = null; clearProvisional();
  replayGeneration++; replaying = false; $('playSample').disabled = false;
  if (!cameraActive) {
    ctx.clearRect(0,0,canvas.width,canvas.height);lastCameraFrame=null;
    $('cameraWelcome').hidden = false; setSource('CAMERA OFF', 'Start live camera to recognize your own signs.');
    $('trackingStatus').textContent='Camera off · text is ready';$('trackingStats').textContent='Local recognition';
  }
}
function leaveRecordedDemo(){
  if(!$('sourceBadge').textContent.includes('SAMPLE'))return;
  cancelReplay();$('suggestions').replaceChildren();$('recognitionState').textContent='Waiting for a sign';
  $('suggestionNote').textContent='Choose only the words you intended.';
  $('liveStatus').textContent='Camera off. Type your message, or start the camera.';
}
async function playSample() {
  if ($('settingsDialog').open) $('settingsDialog').close();
  if (introActive) hideIntroduction();
  await openSamples();
  const clip = clips.find(c => c.id === $('sampleSelect').value); if (!clip) return;
  if (trainingId) { toast('Finish or cancel gesture recording before playing a sample.'); return; }
  stopCamera(false); cancelReplay(); const generation = ++replayGeneration;
  captionDisplay.clear();
  replaying = true; $('playSample').disabled = true; clearError();
  $('cameraWelcome').hidden = true; setSource('RECORDED SAMPLE', 'Demonstration only: these are recorded landmarks. Click Start live camera to translate your own supported signs.');
  $('cameraStage').scrollIntoView({block:'center'});
  $('trackingStatus').textContent = `Playing recorded landmarks: ${clip.title}`;
  $('recognitionState').textContent = 'Running ASL model…';
  $('suggestions').replaceChildren();
  try {
    const loaded = await ensureModel();
    if (generation !== replayGeneration) return;
    const segment = { frames: clip.frames, fps: clip.fps, durationMs: (clip.frames.length - 1) * 1000 / clip.fps, timestamps: clip.frames.map((_, i) => i * 1000 / clip.fps) };
    let queue = Promise.resolve();
    const infer = input => { const task = queue.then(() => loaded.client.infer(input)); queue = task.catch(() => undefined); return task; };
    const preview = new LivePreview(loaded.meta, loaded.labels, infer, result => {
      if (generation === replayGeneration) presentPreview(result, 'sample');
    }, message => { if (generation === replayGeneration) error(`Live preview failed: ${message}`); });
    samplePreview = preview;
    for (let i = 0; i < clip.frames.length; i++) {
      if (generation !== replayGeneration) return;
      drawFrame(clip.frames[i], true);
      preview.push({ frame: clip.frames[i], t: i * 1000 / clip.fps, poses: 1 });
      $('trackingStats').textContent = `Recorded landmarks · frame ${i + 1} / ${clip.frames.length}`;
      await new Promise(resolve => setTimeout(resolve, 1000 / clip.fps));
    }
    preview.reset();
    const result = await classifySegment(loaded.meta, loaded.labels, infer, segment, false, true);
    if (generation !== replayGeneration) return;
    presentResult(result, 'sample');
    $('trackingStatus').textContent = `Recorded sample complete · reference: ${clip.title}`;
    setSource('SAMPLE FINISHED · CAMERA OFF', 'This sample has finished. Start live camera for your own signing; the sample does not watch your hands.');
  } catch (e) { if (generation === replayGeneration) error(`Sample inference failed: ${e.message}`); }
  finally { if (generation === replayGeneration) { replaying = false; $('playSample').disabled = false; } }
}
$('trySample').onclick = () => playSample(); $('replayButton').onclick = () => playSample(); $('playSample').onclick = playSample;
$('openAvatar').onclick = () => {
  if($('settingsDialog').open)$('settingsDialog').close();
  $('avatarDialog').showModal(); recognizer?.reset();
  liveVoice.stop('Silhouette test open. Live recognition is paused; your message is kept.');
};
$('closeAvatar').onclick = () => $('avatarDialog').close();
$('avatarDialog').addEventListener('close', () => {
  avatarRecordGeneration++;if(avatarRecorder.active)void avatarRecorder.stop();
  avatarDemo.stop(); recognizer?.reset();
  liveVoice.stop('Silhouette test closed. Your message was kept.');
  $('liveStatus').textContent = cameraActive ? 'Live signing resumed. Use short natural pauses between supported signs.' : 'Test closed. Start the camera for your own signs, or continue typing.';
});
async function avatarInputs() {
  const loaded = await ensureModel();
  const avatarClips = clips.length ? clips : await loadReplayClips();
  return {loaded, selected:['hello','police','giraffe'].map(sign=>avatarClips.find(c=>c.sign===sign)).filter(Boolean)};
}
$('playAvatar').onclick = async () => {
  if(avatarRecordPreparing||avatarRecorder.active||avatarRecorder.finishing)return;
  try { const {loaded,selected} = await avatarInputs(); if ($('avatarDialog').open) await avatarDemo.play(loaded,selected,$('avatarDropouts').checked); }
  catch(e) { $('avatarPhase').textContent = `Demo could not run: ${e.message}`; }
};
$('checkAvatarPixels').onclick = async () => {
  if(avatarRecordPreparing||avatarRecorder.active||avatarRecorder.finishing)return;
  try { const {loaded,selected} = await avatarInputs(); if ($('avatarDialog').open) await avatarDemo.checkPixels(loaded,selected[0]); }
  catch(e) { $('avatarVisionStatus').textContent = `Image check could not run: ${e.message}`; }
};
$('stopAvatar').onclick = () => { avatarDemo.stop(); $('avatarPhase').textContent = 'Stopped. Your interview message was not changed.'; };
$('recordAvatar').onclick=async()=>{
  if(avatarRecordPreparing||avatarRecorder.active||avatarRecorder.finishing)return;
  avatarRecordPreparing=true;syncRecordingControls();
  const generation=++avatarRecordGeneration;
  try {
    const {loaded,selected}=await avatarInputs();
    if(!$('avatarDialog').open||generation!==avatarRecordGeneration)return;
    $('avatarVideoDownload').hidden=true;avatarRecordStage='intro';
    const ready=avatarRecorder.start();
    void ready.then(result=>offerClip('avatarVideoDownload',result,'Handsay-avatar-demo.webm'));
    await new Promise(resolve=>setTimeout(resolve,3000));
    if(generation!==avatarRecordGeneration||!avatarRecorder.active)return;
    avatarRecordStage='demo';await avatarDemo.play(loaded,selected,$('avatarDropouts').checked);syncRecordingControls();
    if(generation!==avatarRecordGeneration||!avatarRecorder.active)return;
    await new Promise(resolve=>setTimeout(resolve,1500));
    avatarRecordStage='outro';await new Promise(resolve=>setTimeout(resolve,4000));
    if(generation===avatarRecordGeneration)await avatarRecorder.stop();
  }catch(e){$('avatarRecordStatus').textContent=e.message;if(avatarRecorder.active)await avatarRecorder.stop();}
  finally{avatarRecordPreparing=false;syncRecordingControls();}
};
const stopAvatarPlayback=$('stopAvatar').onclick;
$('stopAvatar').onclick=()=>{avatarRecordGeneration++;stopAvatarPlayback();if(avatarRecorder.active)void avatarRecorder.stop();};
$('recognitionMode').onchange = () => {
  samplePreview?.reset(); clearProvisional();
  recognizer?.reset(); liveGate.reset(); $('suggestions').replaceChildren(); $('recognitionState').textContent = 'Waiting for a new sign';
  updateRecognitionModeHint();
  try{preferences.setItem('handsay.recognition.v1',JSON.stringify({mode:$('recognitionMode').value}));}
  catch{toast('Mode changed for this session. This device could not save the preference.');}
  if ($('recognitionMode').value === 'personal' && !gestures.some(isReady)) toast('Teach at least one personal gesture three times before recognizing it.');
};
function updateRecognitionModeHint(){
  const mode=$('recognitionMode').value;
  $('recognitionModeBadge').textContent=mode==='asl'?'ASL words':mode==='personal'?'Personal gestures':'ASL + gestures';
  if(mode!=='asl'&&!gestures.some(g=>gestureQuality(g).state!=='more-takes')){
    $('recognitionModeHint').textContent=mode==='personal'?'No personal gesture is ready yet. Open My gestures and record 3–5 examples, or choose ASL in Settings.':'ASL is on. Record 3–5 examples in My gestures to add your own shortcuts.';return;
  }
  $('recognitionModeHint').textContent=mode==='asl'?'Recognizing individual ASL words. For whole phrases, type or teach a personal gesture.':mode==='personal'?'Recognizing your saved gestures. Each shortcut says the phrase you assigned; it is not an ASL translation.':mode==='combined-priority'?'ASL and personal gestures are enabled. Verified shortcuts take priority and start separate messages.':'ASL and personal gestures are enabled. Conflicting results wait for your choice.';
}
function loadRecognitionMode(){
  try{const data=JSON.parse(preferences.getItem('handsay.recognition.v1')||'null');if(data&&['asl','personal','combined','combined-priority'].includes(data.mode))$('recognitionMode').value=data.mode;}
  catch{toast('Saved recognition preference is unavailable. ASL mode is selected.');}
  updateRecognitionModeHint();
}

function updateDraft() {
  const text = $('draftCaption').value; $('draftCount').textContent = `${text.length} / 1000`; $('confirmCaption').disabled = !text.trim();
  captionDisplay.setDraft(readableCaption(text));
  $('undoLive').disabled = !text.trim();
  renderCameraCaption();
}
$('draftCaption').oninput = () => { leaveRecordedDemo();automaticMessage.reset();lastTypedAt = Date.now();recognizer?.reset(); clearTimeout(singleDraftTimer); voiceDraft = ''; captionDisplay.clearPreview(); liveVoice.stop('Text edited. Send the message to speak the corrected text.'); liveUndo = []; overlayFinished = ''; captionPreview = false; updateDraft(); scheduleLiveShare(); };
$('clearDraft').onclick = clearCaptionSentence;
function clearCaptionSentence() {
  leaveRecordedDemo();
  automaticMessage.reset();
  clearTimeout(singleDraftTimer); voiceDraft = ''; captionDisplay.clear();
  samplePreview?.reset(); clearProvisional();
  liveVoice.stop('Sentence cleared; queued voice stopped.');
  clearedSentence = $('draftCaption').value;
  $('restoreSentence').hidden = !clearedSentence.trim();
  $('draftCaption').value = ''; overlayFinished = ''; captionPreview = false; liveUndo = []; liveGate.reset(); recognizer?.reset(); updateDraft(); scheduleLiveShare();
}
function speak(text) {
  liveVoice.say(text);
}
function showLastCaption(text, speech = false) {
  lastSpoken = text; $('lastCaption').textContent = text;
  $('lastCaption').closest('section').classList.add('has-caption'); $('speakLast').disabled = false;
  if (speech) speak(text);
}
function addRecord(type, text, options = {}) {
  const entry = { type, text, at: options.at ?? Date.now(), shared: !!options.shared, seq: options.seq ?? null, roomId: options.roomId ?? null, clientId: options.clientId ?? crypto.randomUUID() };
  records.push(entry); renderRecords();
  if (type === 'caption') { if (viewer) { viewerDisplay.showSent(text, entry.at); renderViewerCaption(); } else showLastCaption(text, !!options.speech); }
  if (type === 'question' && !viewer) { $('latestQuestion').textContent = text; $('latestQuestion').hidden = false; }
  return entry;
}
function renderRecords() {
  const target = viewer ? $('viewerTranscript') : $('transcript'); target.replaceChildren();
  if (!records.length) { const p = document.createElement('p'); p.className = 'empty-transcript'; p.textContent = 'Confirmed captions and interviewer questions appear here.'; target.append(p); }
  for (const record of records) {
    const row = document.createElement('div'); row.className = `transcript-entry ${record.type}`;
    const meta = document.createElement('div'); meta.className = 'entry-meta';
    meta.textContent = `${record.type === 'question' ? 'INTERVIEWER' : 'SIGNER'} · ${new Date(record.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${!viewer && room && !record.shared ? ' · local only' : ''}`;
    const p = document.createElement('p'); p.textContent = record.text; row.append(meta, p); target.append(row);
    if (!viewer && record.retry) {
      const retry = document.createElement('button'); retry.className = 'text-button'; retry.textContent = 'Retry delivery';
      retry.onclick = async () => {
        if (!room) { $('inviteDialog').showModal(); return; }
        retry.disabled = true;
        try { const active = room; const sent = await postRoom(record.type, record.text, record.clientId); record.shared = true; record.seq = sent.seq; record.roomId = active.id; record.retry = false; renderRecords(); clearError(); }
        catch (e) { retry.disabled = false; error(`Message still not delivered: ${e.message}`); }
      };
      row.append(retry);
    }
  }
  target.scrollTop = target.scrollHeight; $('downloadTranscript').disabled = !records.length;
}
$('confirmCaption').onclick = () => finishCaption(false);
async function finishCaption(sentence = false) {
  leaveRecordedDemo();
  const raw = readableCaption($('draftCaption').value);
  automaticMessage.reset();
  const text = sentence ? finishSentence(raw) : raw; if (!text) return;
  clearTimeout(singleDraftTimer);
  liveShareGeneration++; clearTimeout(liveShareTimer);
  if (liveVoice.enabled && readableCaption(voiceDraft) === raw) liveVoice.flush();
  else if (liveVoice.enabled || $('speakOnConfirm').checked) speak(text);
  voiceDraft = '';
  const entry = addRecord('caption', text);
  outgoingSent={text,at:Date.now()};
  const targetRoom = room;
  overlayFinished = text; captionPreview = false; recognizer?.reset();
  $('draftCaption').value = ''; liveUndo = []; liveGate.reset(); updateDraft();
  document.querySelector('.output-column').scrollTop = 0;
  captionDisplay.showSent(text); renderCameraCaption();
  if (targetRoom) {
    try { await liveShareQueue; const sent = await postRoom('caption', text, entry.clientId, targetRoom); entry.shared = true; entry.seq = sent.seq; entry.roomId = targetRoom.id; renderRecords(); }
    catch (e) { entry.retry = true; renderRecords(); error(`Message saved here but not delivered: ${e.message}. Use Retry beside it in Conversation.`); }
  }
}
$('speakLast').onclick = () => speak(lastSpoken);
$('questionForm').onsubmit = async e => {
  e.preventDefault(); const text = $('questionInput').value.trim(); if (!text) return;
  const entry = addRecord('question', text); $('questionInput').value = '';
  if (room) {
    try { const sent = await postRoom('question', text, entry.clientId); entry.shared = true; entry.seq = sent.seq; renderRecords(); }
    catch (e) { error(`Question saved locally but was not shared: ${e.message}`); }
  }
};
$('downloadTranscript').onclick = () => {
  const text = records.map(r => `[${new Date(r.at).toLocaleTimeString()}] ${r.type === 'caption' ? 'Signer' : 'Interviewer'}: ${r.text}`).join('\n\n');
  const blob = new Blob([`Handsay — user-confirmed conversation\n${new Date().toLocaleString()}\n\n${text}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'handsay-conversation.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function loadGestures() {
  try { const value = preferences.getItem(storageKey); gestures = value ? validateStoredGestures(JSON.parse(value)) : []; }
  catch { gestures = []; error('The saved gesture library could not be read. Your existing data has not been overwritten.'); }
  renderGestures();
}
function persistGestures(next) {
  const raw = next.map(g => ({ ...g, takes: g.takes.map(t => Array.from(t)) }));
  preferences.setItem(storageKey, JSON.stringify(raw)); gestures = next; renderGestures();updateRecognitionModeHint();
}
function renderGestures() {
  const target = $('gestureList'); target.replaceChildren();
  if (!gestures.length) { const p = document.createElement('p'); p.className = 'small-note'; p.textContent = 'Your personal phrase library is empty.'; target.append(p); }
  for (const g of gestures) {
    const card = document.createElement('div'); card.className = 'gesture-card';
    const title = document.createElement('strong'); title.textContent = g.name;
    const quality=gestureQuality(g,gestures);
    const count = document.createElement('p'); count.className = 'take-status'; count.textContent = `${g.takes.length} / 5 takes · ${quality.label}`;
    const actions = document.createElement('div'); actions.className = 'gesture-actions';
    const record = document.createElement('button'); record.className = 'button secondary small';
    record.textContent = trainingId === g.id ? 'Cancel recording' : g.takes.length>=5?'Replace weakest take':'Record next gesture';
    record.onclick = () => {
      if (trainingId === g.id) { trainingId = null;trainingReplaceIndex=null; $('teachStatus').textContent = 'Recording cancelled. Your saved examples were kept.'; renderGestures(); return; }
      if (!cameraActive) { toast('Start the camera in Conversation first.'); showTab('conversation'); return; }
      trainingId = g.id;trainingReplaceIndex=g.takes.length>=5?quality.weakestIndex:null; recognizer?.reset(); cancelReplay();
      $('teachStatus').textContent = `Ready to record “${g.name}”. Make the gesture, then pause.`;
      renderGestures(); showTab('conversation'); toast(`Recording next gesture for “${g.name}”. Make the motion, then pause.`);
    };
    const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = 'Remove';
    remove.onclick = () => {
      try { persistGestures(gestures.filter(item => item.id !== g.id)); if (trainingId === g.id) {trainingId = null;trainingReplaceIndex=null;} toast('Gesture removed from this browser.'); }
      catch { error('Could not update browser storage.'); }
    };
    actions.append(record, remove); card.append(title, count, actions); target.append(card);
  }
}
$('addGesture').onclick = () => {
  const name = $('gesturePhrase').value.trim();
  if (!name) { toast('Enter the phrase you want your gesture to say.'); return; }
  if (gestures.length >= 8) { toast('The prototype supports up to 8 personal gestures.'); return; }
  if (gestures.some(g => g.name.toLowerCase() === name.toLowerCase())) { toast('That phrase is already in your library.'); return; }
  try { persistGestures([...gestures, { id: crypto.randomUUID(), name, takes: [] }]); $('gesturePhrase').value = ''; }
  catch { error('This browser could not save a gesture. Check that browser storage is available.'); }
};
function saveTrainingTake(result) {
  const gesture = gestures.find(g => g.id === trainingId);
  if (!gesture) { trainingId = null;trainingReplaceIndex=null; return; }
  if (result.segment.trackingIssue) { toast('Hand tracking changed sides. Please repeat that take; it was not saved.'); return; }
  if (result.partial) { toast('Keep your shoulders in view and try again. That take was not saved.'); return; }
  try {
    const replacing=trainingReplaceIndex!==null;
    const saved = replacing?{...gesture,takes:gesture.takes.map((take,index)=>index===trainingReplaceIndex?result.inference.embedding:take)}:addTake(gesture, result.inference.embedding);
    persistGestures(gestures.map(g => g.id === gesture.id ? saved : g)); trainingId = null;trainingReplaceIndex=null;
    $('teachStatus').textContent = `${replacing?'Replaced weakest take':'Saved take '+saved.takes.length} for “${saved.name}”. ${gestureQuality(saved,gestures).label}`;
    renderGestures(); showTab('teach'); toast(`${replacing?'Weakest take replaced.':'Take '+saved.takes.length+' saved.'} ${gestureQuality(saved,gestures).label}`);
  } catch { error('The gesture could not be saved in this browser.'); }
}

function renderVocabulary() {
  if (!model) return;
  const query = $('vocabularySearch').value.trim().toLowerCase();
  const labels = model.labels.filter(l => l.shipped && `${l.label} ${l.sign}`.toLowerCase().includes(query));
  $('vocabularyCount').textContent = `${labels.length} signs shown · Dictionary links open an external site`;
  const target = $('vocabularyGrid'); target.replaceChildren();
  for (const label of labels) {
    const card = document.createElement('div'); card.className = 'vocab-card';
    const title = document.createElement('strong'); title.textContent = label.label;
    const link = document.createElement('a'); link.href = dictionaryUrl(label); link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'See the sign ↗';
    card.append(title, link); target.append(card);
  }
}
$('vocabularySearch').oninput = renderVocabulary;

async function request(path, options = {}) {
  const res = await fetch(path, { ...options, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  const data = await res.json(); if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status }); return data;
}
function currentRoom() { return viewer ? viewerRoom : room; }
function roomKey() { return viewer ? viewerRoom.readKey : room?.writeKey; }
async function postRoom(type, text, clientId = crypto.randomUUID(), active = currentRoom()) {
  if (!active || active !== currentRoom()) throw new Error('The interviewer room changed. Reconnect before retrying.');
  return request(`/api/rooms/${active.id}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${active.writeKey ?? active.readKey}` }, body: JSON.stringify({ type, text, clientId }) });
}
async function pollRoom() {
  if (roomBusy || !currentRoom()) return;
  roomBusy = true; const id = currentRoom().id;
  try {
    const data = await request(`/api/rooms/${id}?after=${cursor}`, { headers: { Authorization: `Bearer ${roomKey()}` } });
    if (currentRoom()?.id !== id) return;
    for (const event of data.events) {
      cursor = Math.max(cursor, event.seq);
      if (event.type === 'live') {
        if (viewer) { if (event.text) viewerDisplay.setDraft(event.text, event.at); else viewerDisplay.clearLive(); renderViewerCaption(); }
        continue;
      }
      const existing = records.find(r => (r.roomId === id && r.seq === event.seq) || (event.clientId && r.clientId === event.clientId));
      if (existing) { existing.shared = true; existing.seq = event.seq; existing.roomId = id; renderRecords(); continue; }
      addRecord(event.type, event.text, { at: event.at, shared: true, seq: event.seq, roomId: id, clientId: event.clientId });
      if (!viewer && event.type === 'question') toast('A new interviewer question arrived.');
    }
    const status = viewer ? (data.signerConnected ? 'Connected to the signer' : 'Signer is away · waiting to reconnect') : (data.viewerConnected ? 'Interviewer connected' : 'Link ready · waiting for interviewer');
    $(viewer ? 'viewerConnection' : 'roomStatus').textContent = status;
    if (!viewer) { $('inviteBadge').textContent = data.viewerConnected ? 'Interviewer connected' : 'Invite interviewer'; $('inviteBadge').dataset.connected = String(!!data.viewerConnected); syncSessionControls(); }
  } catch (e) {
    $(viewer ? 'viewerConnection' : 'roomStatus').textContent = `Not connected: ${e.message}`;
    if (e.status === 404 || e.status === 401) {
      if (viewer) {
        viewerDisplay.clear(); renderViewerCaption();
        $('viewerConnection').textContent = 'This interview link has ended or is unavailable. Ask the signer for a new link.';
        $('viewerQuestion').disabled = true; $('viewerQuestionForm').querySelector('button').disabled = true;
        clearInterval(roomTimer);
      } else {
        $('disconnectRoom').onclick();
        $('roomStatus').textContent = 'The previous room is unavailable. Create a new interviewer link.';
      }
    }
  } finally { roomBusy = false; }
}
function startPolling() { clearInterval(roomTimer); roomTimer = setInterval(pollRoom, 1500); void pollRoom(); }
$('createRoom').onclick = async () => {
  $('createRoom').disabled = true;
  try {
    const version = ++roomVersion;
    const created = await request('/api/rooms', { method: 'POST' });
    if (version !== roomVersion) return;
    room = created; cursor = 0;
    liveShareGeneration++;
    const url = new URL(location.href); url.hash = new URLSearchParams({ view: room.id, key: room.readKey }).toString();
    $('roomLink').value = url.href; $('roomDetails').hidden = false; $('createRoom').hidden = true;
    try { sessionStorage.setItem('handsay.room.v1', JSON.stringify(room)); } catch {}
    startPolling(); renderRecords(); toast('Live room created. New confirmed captions will be shared. Previous text stays local.');
    enterInterview();
  } catch (e) { error(`Could not create a room: ${e.message}`); }
  finally { $('createRoom').disabled = false; }
};
$('copyRoom').onclick = async () => {
  try { await navigator.clipboard.writeText($('roomLink').value); toast('Interviewer link copied. Anyone with it can read this room.'); }
  catch { $('roomLink').focus(); $('roomLink').select(); toast('Select and copy the interviewer link.'); }
};
$('disconnectRoom').onclick = () => {
  roomVersion++; clearInterval(roomTimer); liveShareGeneration++; clearTimeout(liveShareTimer); room = null; cursor = 0; $('roomDetails').hidden = true; $('createRoom').hidden = false;
  try { sessionStorage.removeItem('handsay.room.v1'); } catch {}
  $('inviteBadge').textContent = 'Invite interviewer'; $('inviteBadge').dataset.connected = 'false';
  toast('Sharing disconnected. Existing room text expires after two hours.'); renderRecords();
  syncSessionControls();
};
$('viewerQuestionForm').onsubmit = async e => {
  e.preventDefault(); const text = $('viewerQuestion').value.trim(); if (!text) return;
  const button = $('viewerQuestionForm').querySelector('button'); button.disabled = true;
  try { await postRoom('question', text); $('viewerQuestion').value = ''; await pollRoom(); }
  catch (err) { $('viewerConnection').textContent = `Question not sent: ${err.message}`; }
  finally { button.disabled = false; }
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !callOutput.active && !cameraRecorder.active) { stopCamera(false); cancelReplay(); trainingId = null; renderGestures(); }
});
window.addEventListener('pagehide', event => { avatarRecorder.dispose();cameraRecorder.dispose();callOutput.dispose();stopCamera(false); if (!event.persisted) model?.client.dispose(); clearInterval(roomTimer); liveVoice.stop(); });
window.addEventListener('pageshow', event => { if (event.persisted && currentRoom()) startPolling(); });

function renderViewerCaption() {
  const display = viewerDisplay.view();
  const text = captionContent(display);
  if ($('viewerCaption').textContent !== text) $('viewerCaption').textContent = text;
  $('viewerCaptionKind').textContent = display.kind === 'sent' ? 'Sent by the signer' : display.kind === 'draft' ? 'Live draft · may change' : 'Live captions';
}
function enterInterview() {
  interviewActive = true; document.body.classList.add('in-interview');
  $('setupPanel').hidden = true; $('sessionLabel').textContent = 'Caption workspace';
  syncSessionControls();
}
function syncSessionControls() {
  $('confirmCaption').textContent = room ? 'Send message' : 'Show message';
  $('deliveryHint').textContent = !room ? 'Visible on this device. Invite your interviewer to share messages.' : $('inviteBadge').dataset.connected === 'true' ? 'Interviewer connected. Sent messages appear on their screen.' : 'Link ready. Sent messages will be available when your interviewer joins.';
  $('toggleCaptions').setAttribute('aria-pressed', String($('liveEnabled').checked));
  $('toggleCaptions').textContent = $('liveEnabled').checked ? 'Captions on' : 'Captions paused';
  const voiceOn = $('speakOnConfirm').checked || $('liveSpeech').checked;
  $('toggleVoice').setAttribute('aria-pressed', String(voiceOn));
  $('toggleVoice').textContent = voiceOn ? 'Voice on' : 'Voice off';
  $('endInterview').disabled = !interviewActive && !room && !cameraActive;
}
$('useKeyboard').onclick = () => { enterInterview(); $('draftCaption').focus(); };
$('openSettings').onclick = () => $('settingsDialog').showModal();
$('closeSettings').onclick = () => $('settingsDialog').close();
$('inviteButton').onclick = () => $('inviteDialog').showModal();
$('closeInvite').onclick = () => $('inviteDialog').close();
$('toggleCaptions').onclick = () => { $('liveEnabled').checked = !$('liveEnabled').checked; $('liveEnabled').onchange(); syncSessionControls(); };
$('toggleVoice').onclick = () => {
  const enabled = !($('speakOnConfirm').checked || $('liveSpeech').checked);
  $('liveSpeech').checked = false; liveVoice.setEnabled(false);
  $('speakOnConfirm').disabled = false; $('speakOnConfirm').checked = enabled;
  syncSessionControls(); toast(enabled ? 'Voice on. Sent messages will be read aloud.' : 'Voice off. Your captions still appear.');
};
$('liveEnabled').addEventListener('change', syncSessionControls);
$('liveSpeech').addEventListener('change', syncSessionControls);
$('speakOnConfirm').addEventListener('change', syncSessionControls);
$('endInterview').onclick = () => $('endDialog').showModal();
$('cancelEnd').onclick = () => $('endDialog').close();
$('confirmEnd').onclick = async () => {
  $('confirmEnd').disabled = true;
  // Release the physical camera and voice before waiting on any network/helper.
  const stoppingOutput = callOutput.stop();outgoingSent=null;broadcastIntro=false;
  if(cameraRecorder.active)void cameraRecorder.stop();
  stopCamera(false); cancelReplay(); liveVoice.stop();
  if (introActive) hideIntroduction();
  avatarDemo.stop();
  if ($('avatarDialog').open) $('avatarDialog').close();
  liveShareGeneration++; clearTimeout(liveShareTimer);
  await stoppingOutput;
  const active = room;
  if (active) {
    try { await liveShareQueue; await request(`/api/rooms/${active.id}/end`, { method: 'POST', headers: { Authorization: `Bearer ${active.writeKey}` } }); }
    catch (e) { error(`Camera stopped, but the shared room could not close: ${e.message}. Retry End interview.`); $('confirmEnd').disabled = false; $('endDialog').close(); return; }
  }
  $('disconnectRoom').onclick();
  interviewActive = false; $('setupPanel').hidden = false; document.body.classList.remove('in-interview');
  $('sessionLabel').textContent = 'Session ended';
  clearCaptionSentence(); captionDisplay.clear(); renderCameraCaption();
  $('endDialog').close(); $('confirmEnd').disabled = false; syncSessionControls();
  toast('Interview ended. Your conversation remains here to download.');
};
for (const button of document.querySelectorAll('[data-phrase]')) button.onclick = () => {
  enterInterview(); clearTimeout(singleDraftTimer); voiceDraft = '';
  $('draftCaption').value = button.dataset.phrase; updateDraft(); void finishCaption();
};
$('draftCaption').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void finishCaption(); }
});
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeToggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  $('themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  try { preferences.setItem('handsay.theme.v1', theme); } catch {}
}
let initialTheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
try { const saved = preferences.getItem('handsay.theme.v1'); if (['light','dark'].includes(saved)) initialTheme = saved; } catch {}
setTheme(initialTheme);
$('themeToggle').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
setInterval(() => { if (viewer) renderViewerCaption(); else renderCameraCaption(); }, 200);

if (viewer) {
  $('inviteButton').hidden = true; $('guideButton').hidden = true;
  $('sessionLabel').textContent = 'Interviewer view';
  document.querySelector('.skip-link').href = '#viewerQuestion'; document.querySelector('.skip-link').textContent = 'Skip to your question';
  $('setupPanel').hidden=true;
  document.querySelector('.intro').hidden = true; document.querySelector('.workspace-nav').hidden = true;
  $('modelBanner').hidden = true;
  for (const name of ['conversation', 'teach', 'vocabulary']) $(name + 'Panel').hidden = true;
  $('viewerPanel').hidden = false;
  if (!/^[a-f0-9]{24}$/.test(viewerRoom.id ?? '') || !/^[A-Za-z0-9_-]{32}$/.test(viewerRoom.readKey ?? '')) $('viewerConnection').textContent = 'The room link is incomplete or invalid.';
  else startPolling();
} else {
  void refreshCameras();
  loadGestures(); loadCaptionStyle(); loadRecognitionMode(); initVoiceSetup(); showTab('conversation'); updateDraft();
  try {
    const saved = JSON.parse(sessionStorage.getItem('handsay.room.v1') || 'null');
    if (saved && /^[a-f0-9]{24}$/.test(saved.id) && /^[A-Za-z0-9_-]{32}$/.test(saved.writeKey) && /^[A-Za-z0-9_-]{32}$/.test(saved.readKey) && saved.expiresAt > Date.now()) {
      room = saved;
      const url = new URL(location.href); url.hash = new URLSearchParams({view:room.id,key:room.readKey}).toString();
      $('roomLink').value = url.href; $('roomDetails').hidden = false; $('createRoom').hidden = true;
      startPolling(); enterInterview();
    }
  } catch {}
  syncSessionControls();
  ensureModel().catch(e => error(`Sign recognition unavailable: ${e.message}. Typed captions still work.`));
}

