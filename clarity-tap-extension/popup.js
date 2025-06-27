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
  const setReminderButton = document.getElementById('set-reminder');
  const reminderList = document.getElementById('reminder-list');

  setReminderButton.addEventListener('click', () => {
    const reminderText = reminderInput.value;
    const reminderTimestamp = new Date(reminderTime.value).getTime();
    if (reminderText && reminderTimestamp > Date.now()) {
      chrome.alarms.create(reminderText, { when: reminderTimestamp });
      chrome.storage.sync.get({reminders: []}, (data) => {
        const reminders = data.reminders;
        reminders.push({text: reminderText, time: reminderTimestamp});
        chrome.storage.sync.set({reminders: reminders}, () => {
          reminderInput.value = '';
          reminderTime.value = '';
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
        reminderElement.textContent = `${reminder.text} - ${new Date(reminder.time).toLocaleString()}`;
        
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
});
