chrome.alarms.onAlarm.addListener(async (alarm) => {
  chrome.notifications.create(alarm.name, {
    type: 'basic',
    
    title: 'ClarityTap Reminder',
    message: alarm.name,
    priority: 2
  });

  // Play a sound using the offscreen API
  await createOffscreen();
  chrome.runtime.sendMessage({
    type: 'play-audio',
    url: 'audio/alarm.mp3'
  });
});

async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'To play alarm sounds for reminders',
  });
}