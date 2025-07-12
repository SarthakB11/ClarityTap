importScripts('firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js', 'firebase.js');

let user = null;

// A promise that resolves when the initial auth state is known
const authReady = new Promise(resolve => {
  const unsubscribe = firebase.auth().onAuthStateChanged(firebaseUser => {
    if (firebaseUser) {
      user = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
      };
      console.log('Auth state changed: User signed in.', user);
    } else {
      user = null;
      console.log('Auth state changed: User signed out.');
    }
    resolve();
    unsubscribe(); // We only need the very first check on startup
  });
});

// Persistent listener to keep 'user' variable updated
firebase.auth().onAuthStateChanged(firebaseUser => {
  if (firebaseUser) {
    user = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName,
      email: firebaseUser.email,
    };
  } else {
    user = null;
  }
});

// Centralized message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'check-auth-status') {
    authReady.then(() => {
      sendResponse({ user });
    });
    return true; // Indicates async response

  } else if (request.type === 'login') {
    performLogin(sendResponse);
    return true;
  
  } else if (request.type === 'set-reminder') {
    handleSetReminder(request);
    return false;
  
  } else if (request.type === 'delete-reminder') {
    handleDeleteReminder(request);
    return false;
  
  } else if (request.type === 'start-focus-mode') {
    const duration = request.duration;
    const endTime = Date.now() + duration * 60 * 1000;
    chrome.storage.local.set({ focusModeUntil: endTime }, () => {
      updateBlockingRules();
    });
    return false;
  
  } else if (request.type === 'stop-focus-mode') {
    chrome.storage.local.remove('focusModeUntil', () => {
      updateBlockingRules();
    });
    return false;
  
  } else if (request.type === 'update-blocking') {
    updateBlockingRules(request.websites);
    return false;
  }
});


function performLogin(sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error('getAuthToken failed:', chrome.runtime.lastError);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }
    
    const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
    firebase.auth().signInWithCredential(credential)
      .then(result => {
        sendResponse({ success: true, user: result.user });
      })
      .catch(error => {
        console.error('signInWithCredential failed:', error);
        sendResponse({ success: false, error: error.message });
      });
  });
}

// --- Reminders ---
async function handleSetReminder(request) {
    const { reminders } = await chrome.storage.sync.get({reminders: []});
    reminders.push(request.reminder);
    await chrome.storage.sync.set({ reminders });
    chrome.alarms.create(request.reminder.text, { when: request.reminder.time });
}

async function handleDeleteReminder(request) {
    const { reminders } = await chrome.storage.sync.get({reminders: []});
    const reminderToDelete = reminders[request.index];
    if (reminderToDelete) {
      chrome.alarms.clear(reminderToDelete.text);
      const updatedReminders = reminders.filter((_, i) => i !== request.index);
      await chrome.storage.sync.set({ reminders: updatedReminders });
    }
}

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
        const updatedReminders = reminders.filter(r => r.text !== alarm.name);
        await chrome.storage.sync.set({ reminders: updatedReminders });
      }
    }
  }
});

function calculateNextAlarm(reminder) {
  const now = new Date();
  const endDate = reminder.recurrence.endDate ? new Date(reminder.recurrence.endDate) : null;
  if (endDate && now > endDate) return null;

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

// --- Offscreen Audio ---
async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'To play alarm sounds for reminders',
  });
}

// --- Focus Mode ---
async function updateBlockingRules(websites) {
  const { focusModeUntil } = await chrome.storage.local.get(['focusModeUntil']);
  const isFocusModeActive = focusModeUntil && focusModeUntil > Date.now();

  if (!websites) {
    const data = await chrome.storage.local.get({ blockedWebsites: [] });
    websites = data.blockedWebsites.map(site => site.url);
  }

  if (isFocusModeActive && websites && websites.length > 0) {
    const rules = [{
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        requestDomains: websites,
        resourceTypes: ['main_frame']
      }
    }];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: rules
    });
    console.log("Blocking rules updated for:", websites);
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1]
    });
    console.log("Blocking rules cleared.");
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.blockedWebsites || (namespace === 'local' && changes.focusModeUntil)) {
    updateBlockingRules();
  }
});

chrome.runtime.onStartup.addListener(() => {
  updateBlockingRules();
});