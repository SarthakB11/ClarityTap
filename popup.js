document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.remove('active'));
      contents.forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Notes
  const noteInput = document.getElementById('note-input');
  const saveNoteButton = document.getElementById('save-note');
  const notesList = document.getElementById('notes-list');

  saveNoteButton.addEventListener('click', () => {
    const noteText = noteInput.value;
    if (noteText) {
      chrome.storage.sync.get({notes: []}, (data) => {
        const notes = data.notes;
        notes.push(noteText);
        chrome.storage.sync.set({notes: notes}, () => {
          noteInput.value = '';
          renderNotes();
        });
      });
    }
  });

  function renderNotes() {
    chrome.storage.sync.get({notes: []}, (data) => {
      notesList.innerHTML = '';
      data.notes.forEach((note, index) => {
        const noteElement = document.createElement('div');
        noteElement.textContent = note;
        notesList.appendChild(noteElement);
      });
    });
  }

  // Tasks
  const taskInput = document.getElementById('task-input');
  const addTaskButton = document.getElementById('add-task');
  const taskList = document.getElementById('task-list');

  addTaskButton.addEventListener('click', () => {
    const taskText = taskInput.value;
    if (taskText) {
      chrome.storage.sync.get({tasks: []}, (data) => {
        const tasks = data.tasks;
        tasks.push({text: taskText, completed: false});
        chrome.storage.sync.set({tasks: tasks}, () => {
          taskInput.value = '';
          renderTasks();
        });
      });
    }
  });

  function renderTasks() {
    chrome.storage.sync.get({tasks: []}, (data) => {
      taskList.innerHTML = '';
      data.tasks.forEach((task, index) => {
        const taskElement = document.createElement('li');
        taskElement.textContent = task.text;
        taskElement.style.textDecoration = task.completed ? 'line-through' : 'none';
        
        const completeButton = document.createElement('input');
        completeButton.type = 'checkbox';
        completeButton.checked = task.completed;
        completeButton.addEventListener('change', () => {
          data.tasks[index].completed = completeButton.checked;
          chrome.storage.sync.set({tasks: data.tasks}, renderTasks);
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          data.tasks.splice(index, 1);
          chrome.storage.sync.set({tasks: data.tasks}, renderTasks);
        });

        taskElement.prepend(completeButton);
        taskElement.appendChild(deleteButton);
        taskList.appendChild(taskElement);
      });
    });
  }

  // Reminders
  const reminderInput = document.getElementById('reminder-input');
  const reminderTime = document.getElementById('reminder-time');
  const recurrenceUnit = document.getElementById('recurrence-unit');
  const setReminderButton = document.getElementById('set-reminder');
  const reminderList = document.getElementById('reminder-list');

  setReminderButton.addEventListener('click', () => {
    const reminderText = reminderInput.value;
    const reminderTimestamp = new Date(reminderTime.value).getTime();
    const recurrence = recurrenceUnit.value;

    if (reminderText && reminderTimestamp > Date.now()) {
      let periodInMinutes;
      if (recurrence === 'daily') {
        periodInMinutes = 24 * 60;
      } else if (recurrence === 'weekly') {
        periodInMinutes = 7 * 24 * 60;
      } else if (recurrence === 'monthly') {
        periodInMinutes = 30 * 24 * 60; // Approximate
      }

      chrome.alarms.create(reminderText, { 
        when: reminderTimestamp,
        periodInMinutes: periodInMinutes
      });

      chrome.storage.sync.get({reminders: []}, (data) => {
        const reminders = data.reminders;
        reminders.push({
          text: reminderText, 
          time: reminderTimestamp,
          recurrence: recurrence
        });
        chrome.storage.sync.set({reminders: reminders}, () => {
          reminderInput.value = '';
          reminderTime.value = '';
          recurrenceUnit.value = 'none';
          renderReminders();
        });
      });
    }
  });

  function renderReminders() {
    chrome.storage.sync.get({reminders: []}, (data) => {
      reminderList.innerHTML = '';
      data.reminders.forEach((reminder, index) => {
        const reminderElement = document.createElement('li');
        let recurrenceText = '';
        if (reminder.recurrence && reminder.recurrence !== 'none') {
          recurrenceText = `(Repeats ${reminder.recurrence})`;
        }
        reminderElement.textContent = `${reminder.text} - ${new Date(reminder.time).toLocaleString()} ${recurrenceText}`;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          chrome.alarms.clear(reminder.text);
          data.reminders.splice(index, 1);
          chrome.storage.sync.set({reminders: data.reminders}, renderReminders);
        });

        reminderElement.appendChild(deleteButton);
        reminderList.appendChild(reminderElement);
      });
    });
  }

  renderNotes();
  renderTasks();
  renderReminders();

  // Focus Mode
  const websiteInput = document.getElementById('website-input');
  const addWebsiteButton = document.getElementById('add-website');
  const websiteList = document.getElementById('website-list');
  const focusDurationInput = document.getElementById('focus-duration');
  const startFocusButton = document.getElementById('start-focus');
  const stopFocusButton = document.getElementById('stop-focus');
  const focusTimerDisplay = document.getElementById('focus-timer');

  addWebsiteButton.addEventListener('click', () => {
    const website = websiteInput.value;
    if (website) {
      chrome.storage.sync.get({blockedWebsites: []}, (data) => {
        const blockedWebsites = data.blockedWebsites;
        blockedWebsites.push(website);
        chrome.storage.sync.set({blockedWebsites: blockedWebsites}, () => {
          websiteInput.value = '';
          renderBlockedWebsites();
        });
      });
    }
  });

  function renderBlockedWebsites() {
    chrome.storage.sync.get({blockedWebsites: []}, (data) => {
      websiteList.innerHTML = '';
      data.blockedWebsites.forEach((website, index) => {
        const websiteElement = document.createElement('li');
        websiteElement.textContent = website;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          data.blockedWebsites.splice(index, 1);
          chrome.storage.sync.set({blockedWebsites: data.blockedWebsites}, renderBlockedWebsites);
        });

        websiteElement.appendChild(deleteButton);
        websiteList.appendChild(websiteElement);
      });
    });
  }

  startFocusButton.addEventListener('click', () => {
    const duration = parseInt(focusDurationInput.value, 10);
    if (duration > 0) {
      chrome.runtime.sendMessage({
        type: 'start-focus-mode',
        duration: duration
      });
    }
  });

  stopFocusButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stop-focus-mode' });
  });

  function updateFocusTimer() {
    chrome.storage.local.get(['focusModeUntil'], (data) => {
      const focusModeActive = data.focusModeUntil && data.focusModeUntil > Date.now();
      
      if (focusModeActive) {
        const remainingTime = Math.round((data.focusModeUntil - Date.now()) / 1000);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        focusTimerDisplay.textContent = `Focus mode active: ${minutes}m ${seconds}s remaining`;
        startFocusButton.style.display = 'none';
        stopFocusButton.style.display = 'block';
      } else {
        focusTimerDisplay.textContent = '';
        startFocusButton.style.display = 'block';
        stopFocusButton.style.display = 'none';
      }
    });
  }

  renderBlockedWebsites();
  updateFocusTimer();
  setInterval(updateFocusTimer, 1000);
});
