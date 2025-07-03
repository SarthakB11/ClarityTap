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

  const mainQuill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }]
      ]
    }
  });

  let modalQuill;

  // Custom Confirm Modal
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmYesButton = document.getElementById('confirm-yes-button');
  const confirmNoButton = document.getElementById('confirm-no-button');

  function showConfirm(message, callback) {
    confirmMessage.textContent = message;
    customConfirmModal.style.display = 'flex';

    confirmYesButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      callback(true);
    };

    confirmNoButton.onclick = () => {
      customConfirmModal.style.display = 'none';
      callback(false);
    };
  }

  // Notes
  const saveNoteButton = document.getElementById('save-note');
  const notesList = document.getElementById('notes-list');

  saveNoteButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to save this note?', (confirmed) => {
      if (confirmed) {
        const noteContent = mainQuill.root.innerHTML;
        if (noteContent) {
          chrome.storage.sync.get({notes: []}, (data) => {
            const notes = data.notes;
            notes.push(noteContent);
            chrome.storage.sync.set({notes: notes}, () => {
              mainQuill.root.innerHTML = '';
              renderNotes();
            });
          });
        }
      }
    });
  });

  function renderNotes() {
    chrome.storage.sync.get({notes: []}, (data) => {
      notesList.innerHTML = '';
      data.notes.forEach((note, index) => {
        const noteContainer = document.createElement('div');
        noteContainer.classList.add('note-container');
        
        const noteElement = document.createElement('div');
        noteElement.innerHTML = note;
        
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('note-actions');
        
        const displayIcon = document.createElement('img');
        displayIcon.src = 'images/icons/eye.svg';
        displayIcon.classList.add('note-action');
        displayIcon.addEventListener('click', () => openNoteModal(note, index));
        
        const editIcon = document.createElement('img');
        editIcon.src = 'images/icons/pencil.svg';
        editIcon.classList.add('note-action');
        editIcon.addEventListener('click', () => editNote(index, note));
        
        const deleteIcon = document.createElement('img');
        deleteIcon.src = 'images/icons/trash.svg';
        deleteIcon.classList.add('note-action');
        deleteIcon.addEventListener('click', () => deleteNote(index));
        
        actionsContainer.appendChild(displayIcon);
        actionsContainer.appendChild(editIcon);
        actionsContainer.appendChild(deleteIcon);
        
        noteContainer.appendChild(noteElement);
        noteContainer.appendChild(actionsContainer);
        notesList.appendChild(noteContainer);
      });
    });
  }

  function openNoteModal(noteContent, index) {
    const modal = document.getElementById('note-modal');
    const modalNoteContent = document.getElementById('modal-note-content');
    const modalEditorContainer = document.getElementById('modal-editor-container');
    
    modalNoteContent.innerHTML = ''; // Clear previous content
    modalEditorContainer.style.display = 'none';
    modalNoteContent.style.display = 'block';

    const noteElement = document.createElement('div');
    noteElement.innerHTML = noteContent;

    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('note-actions');
    
    const editIcon = document.createElement('img');
    editIcon.src = 'images/icons/pencil.svg';
    editIcon.classList.add('note-action');
    editIcon.addEventListener('click', () => {
      editNoteInModal(index, noteContent);
    });
    
    const deleteIcon = document.createElement('img');
    deleteIcon.src = 'images/icons/trash.svg';
    deleteIcon.classList.add('note-action');
    deleteIcon.addEventListener('click', () => {
      showConfirm('Are you sure you want to delete this note?', (confirmed) => {
        if (confirmed) {
          deleteNote(index);
          closeNoteModal();
        }
      });
    });
    
    actionsContainer.appendChild(editIcon);
    actionsContainer.appendChild(deleteIcon);

    modalNoteContent.appendChild(noteElement);
    modalNoteContent.appendChild(actionsContainer);
    modal.style.display = 'flex';
  }

  function editNoteInModal(index, noteContent) {
    const modalNoteContent = document.getElementById('modal-note-content');
    const modalEditorContainer = document.getElementById('modal-editor-container');
    const modalSaveButton = document.getElementById('modal-save-button');

    modalNoteContent.style.display = 'none';
    modalEditorContainer.style.display = 'block';

    if (!modalQuill) {
      modalQuill = new Quill('#modal-editor', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }]
          ]
        }
      });
    }
    modalQuill.root.innerHTML = noteContent;

    modalSaveButton.onclick = () => {
      showConfirm('Are you sure you want to save the changes?', (confirmed) => {
        if (confirmed) {
          const updatedContent = modalQuill.root.innerHTML;
          chrome.storage.sync.get({notes: []}, (data) => {
            const notes = data.notes;
            notes[index] = updatedContent;
            chrome.storage.sync.set({notes: notes}, () => {
              closeNoteModal();
              renderNotes();
            });
          });
        }
      });
    };
  }

  function closeNoteModal() {
    const modal = document.getElementById('note-modal');
    modal.style.display = 'none';
  }

  document.getElementById('note-modal').addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') {
      closeNoteModal();
    }
  });

  function editNote(index, noteContent) {
    showConfirm('Are you sure you want to edit this note? This will overwrite the current content in the main editor.', (confirmed) => {
      if (confirmed) {
        mainQuill.root.innerHTML = noteContent;
        deleteNote(index, true);
      }
    });
  }

  function deleteNote(index, isEditing = false) {
    if (isEditing) {
      chrome.storage.sync.get({notes: []}, (data) => {
        const notes = data.notes;
        notes.splice(index, 1);
        chrome.storage.sync.set({notes: notes}, () => {
          renderNotes();
        });
      });
    } else {
      showConfirm('Are you sure you want to delete this note?', (confirmed) => {
        if (confirmed) {
          chrome.storage.sync.get({notes: []}, (data) => {
            const notes = data.notes;
            notes.splice(index, 1);
            chrome.storage.sync.set({notes: notes}, () => {
              renderNotes();
            });
          });
        }
      });
    }
  }

  // Tasks
  const taskInput = document.getElementById('task-input');
  const addTaskButton = document.getElementById('add-task');
  const taskList = document.getElementById('task-list');

  addTaskButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to add this task?', (confirmed) => {
      if (confirmed) {
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
      }
    });
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
          showConfirm('Are you sure you want to delete this task?', (confirmed) => {
            if (confirmed) {
              data.tasks.splice(index, 1);
              chrome.storage.sync.set({tasks: data.tasks}, renderTasks);
            }
          });
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
  const customRecurrence = document.getElementById('custom-recurrence');
  const weeklyRecurrence = document.getElementById('weekly-recurrence');
  const monthlyRecurrence = document.getElementById('monthly-recurrence');
  const setReminderButton = document.getElementById('set-reminder');
  const reminderList = document.getElementById('reminder-list');

  recurrenceUnit.addEventListener('change', () => {
    if (recurrenceUnit.value === 'custom') {
      customRecurrence.style.display = 'block';
    } else {
      customRecurrence.style.display = 'none';
    }

    if (recurrenceUnit.value === 'weekly') {
      weeklyRecurrence.style.display = 'block';
      monthlyRecurrence.style.display = 'none';
    } else if (recurrenceUnit.value === 'monthly') {
      weeklyRecurrence.style.display = 'none';
      monthlyRecurrence.style.display = 'block';
    } else {
      weeklyRecurrence.style.display = 'none';
      monthlyRecurrence.style.display = 'none';
    }
  });

  setReminderButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to set this reminder?', (confirmed) => {
      if (confirmed) {
        const reminderText = reminderInput.value;
        const reminderTimestamp = new Date(reminderTime.value).getTime();
        const recurrence = recurrenceUnit.value;
        
        let recurrenceData = {
          type: recurrence,
          endDate: document.getElementById('recurrence-end').value
        };

        if (recurrence === 'weekly') {
          const selectedDays = [];
          document.querySelectorAll('.weekday-selector input:checked').forEach(day => {
            selectedDays.push(parseInt(day.value));
          });
          recurrenceData.days = selectedDays;
        } else if (recurrence === 'monthly') {
          recurrenceData.dayOfMonth = parseInt(document.getElementById('day-of-month').value);
        }

        if (reminderText && reminderTimestamp > Date.now()) {
          chrome.runtime.sendMessage({
            type: 'set-reminder',
            reminder: {
              text: reminderText,
              time: reminderTimestamp,
              recurrence: recurrenceData
            }
          });

          reminderInput.value = '';
          reminderTime.value = '';
          recurrenceUnit.value = 'none';
          customRecurrence.style.display = 'none';
          renderReminders();
        }
      }
    });
  });

  function renderReminders() {
    chrome.storage.sync.get({reminders: []}, (data) => {
      reminderList.innerHTML = '';
      data.reminders.forEach((reminder, index) => {
        const reminderElement = document.createElement('li');
        let recurrenceText = '';
        if (reminder.recurrence && reminder.recurrence.type !== 'none') {
          recurrenceText = `(Repeats ${reminder.recurrence.type})`;
        }
        reminderElement.textContent = `${reminder.text} - ${new Date(reminder.time).toLocaleString()} ${recurrenceText}`;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          showConfirm('Are you sure you want to delete this reminder?', (confirmed) => {
            if (confirmed) {
              chrome.runtime.sendMessage({type: 'delete-reminder', index: index});
              renderReminders();
            }
          });
        });

        reminderElement.appendChild(deleteButton);
        reminderList.appendChild(reminderElement);
      });
    });
  }

  // Focus Mode
  const websiteInput = document.getElementById('website-input');
  const addWebsiteButton = document.getElementById('add-website');
  const websiteList = document.getElementById('website-list');
  const focusDurationInput = document.getElementById('focus-duration');
  const startFocusButton = document.getElementById('start-focus');
  const stopFocusButton = document.getElementById('stop-focus');
  const timerSVG = document.getElementById('timer-svg');
  const timerProgress = document.getElementById('timer-progress');
  const timerText = document.getElementById('timer-text');
  const radius = timerProgress.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;

  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = circumference;

  function setProgress(percent) {
    const offset = circumference - percent / 100 * circumference;
    timerProgress.style.strokeDashoffset = offset;
  }

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
          showConfirm('Are you sure you want to remove this website?', (confirmed) => {
            if (confirmed) {
              data.blockedWebsites.splice(index, 1);
              chrome.storage.sync.set({blockedWebsites: data.blockedWebsites}, renderBlockedWebsites);
            }
          });
        });

        websiteElement.appendChild(deleteButton);
        websiteList.appendChild(websiteElement);
      });
    });
  }

  startFocusButton.addEventListener('click', () => {
    const duration = parseInt(focusDurationInput.value, 10);
    if (duration > 0) {
      chrome.storage.local.set({ focusModeDuration: duration });
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
    chrome.storage.local.get(['focusModeUntil', 'focusModeDuration'], (data) => {
      const focusModeActive = data.focusModeUntil && data.focusModeUntil > Date.now();
      
      if (focusModeActive) {
        const totalDuration = data.focusModeDuration * 60;
        const remainingTime = Math.round((data.focusModeUntil - Date.now()) / 1000);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        
        timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const percent = ((totalDuration - remainingTime) / totalDuration) * 100;
        setProgress(percent);

        timerSVG.style.display = 'block';
        startFocusButton.style.display = 'none';
        stopFocusButton.style.display = 'block';
        focusDurationInput.style.display = 'none';
      } else {
        timerSVG.style.display = 'none';
        startFocusButton.style.display = 'block';
        stopFocusButton.style.display = 'none';
        focusDurationInput.style.display = 'block';
        timerText.textContent = "00:00";
        setProgress(0);
      }
    });
  }

  renderNotes();
  renderTasks();
  renderReminders();
  renderBlockedWebsites();
  updateFocusTimer();
  setInterval(updateFocusTimer, 1000);
});
