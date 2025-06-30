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
    chrome.storage.local.set({ focusModeUntil: endTime }, () => {
      updateBlockingRules();
    });
  } else if (request.type === 'stop-focus-mode') {
    chrome.storage.local.remove('focusModeUntil', () => {
      updateBlockingRules();
    });
  }
});

async function updateBlockingRules() {
  const { blockedWebsites } = await chrome.storage.sync.get(['blockedWebsites']);
  const { focusModeUntil } = await chrome.storage.local.get(['focusModeUntil']);

  const isFocusModeActive = focusModeUntil && focusModeUntil > Date.now();

  if (isFocusModeActive && blockedWebsites && blockedWebsites.length > 0) {
    const rules = [{
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        requestDomains: blockedWebsites,
        resourceTypes: ['main_frame']
      }
    }];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: rules
    });
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1]
    });
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.blockedWebsites || (namespace === 'local' && changes.focusModeUntil)) {
    updateBlockingRules();
  }
});

// Ensure rules are updated on startup
chrome.runtime.onStartup.addListener(() => {
  updateBlockingRules();
});