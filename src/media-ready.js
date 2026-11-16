/** Camera permission may take time; once granted, video itself must become ready. */
export async function waitForVideo(video, timeoutMs = 10000) {
  let timer;
  try {
    await Promise.race([
      video.play(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The camera opened but did not provide playable video. Restart it or use text')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}
