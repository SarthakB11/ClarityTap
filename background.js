chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { reminders } = await chrome.storage.sync.get(['reminders']);
  const reminder = reminders.find(r => r.text === alarm.name);

  if (reminder) {
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      title: 'ClarityTap Reminder',
      message: alarm.name,
      priority: 2
    });

    await createOffscreen();
    chrome.runtime.sendMessage({
      type: 'play-audio',
      url: 'audio/alarm.mp3'
    });

    if (reminder.recurrence && reminder.recurrence.type !== 'none') {
      const nextAlarmTime = calculateNextAlarm(reminder);
      if (nextAlarmTime) {
        chrome.alarms.create(reminder.text, { when: nextAlarmTime });
      } else {
        // If no next alarm, remove it from storage
        const updatedReminders = reminders.filter(r => r.text !== alarm.name);
        await chrome.storage.sync.set({ reminders: updatedReminders });
      }
    }
  }
});

function calculateNextAlarm(reminder) {
  const now = new Date();
  const endDate = reminder.recurrence.endDate ? new Date(reminder.recurrence.endDate) : null;

  if (endDate && now > endDate) {
    return null;
  }

  let nextAlarm = new Date(reminder.time);

  switch (reminder.recurrence.type) {
    case 'daily':
      nextAlarm.setDate(nextAlarm.getDate() + 1);
      break;
    case 'weekly':
      const currentDay = nextAlarm.getDay();
      const selectedDays = reminder.recurrence.days.sort((a, b) => a - b);
      let nextDay = selectedDays.find(day => day > currentDay);
      if (nextDay === undefined) {
        nextDay = selectedDays[0];
        nextAlarm.setDate(nextAlarm.getDate() + (7 - currentDay + nextDay));
      } else {
        nextAlarm.setDate(nextAlarm.getDate() + (nextDay - currentDay));
      }
      break;
    case 'monthly':
      nextAlarm.setMonth(nextAlarm.getMonth() + 1);
      break;
    default:
      return null;
  }

  return nextAlarm.getTime();
}


async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'To play alarm sounds for reminders',
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'set-reminder') {
    const { reminders } = await chrome.storage.sync.get({reminders: []});
    reminders.push(request.reminder);
    await chrome.storage.sync.set({ reminders });
    chrome.alarms.create(request.reminder.text, { when: request.reminder.time });
  } else if (request.type === 'delete-reminder') {
    const { reminders } = await chrome.storage.sync.get({reminders: []});
    const reminderToDelete = reminders[request.index];
    if (reminderToDelete) {
      chrome.alarms.clear(reminderToDelete.text);
      const updatedReminders = reminders.filter((_, i) => i !== request.index);
      await chrome.storage.sync.set({ reminders: updatedReminders });
    }
  } else if (request.type === 'start-focus-mode') {
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
        urlFilter: `*://${blockedWebsites.join('/*, *://')}`,
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
