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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'start-focus-mode') {
    const duration = request.duration;
    const endTime = Date.now() + duration * 60 * 1000;
    chrome.storage.local.set({ focusModeUntil: endTime });
    updateBlockingRules();
  }
});

async function updateBlockingRules() {
  const { blockedWebsites, focusModeUntil } = await new Promise(resolve => 
    chrome.storage.sync.get(['blockedWebsites', 'focusModeUntil'], resolve)
  );

  const rules = [];
  if (focusModeUntil && focusModeUntil > Date.now() && blockedWebsites && blockedWebsites.length > 0) {
    rules.push({
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: `*://${blockedWebsites.join('|')}/*`,
        resourceTypes: ['main_frame']
      }
    });
  }

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: rules
  });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.blockedWebsites || changes.focusModeUntil) {
    updateBlockingRules();
  }
});