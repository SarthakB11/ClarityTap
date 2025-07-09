document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const mainContainer = document.getElementById('main-container');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const userName = document.getElementById('user-name');

  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');

  let db;
  let currentUser = null;

  // Ask the background script for the current user status when the popup opens
  chrome.runtime.sendMessage({ type: 'get-user-status' }, (response) => {
    if (response && response.user) {
      updateUIForUser(response.user);
    } else {
      updateUIForGuest();
    }
  });

  function updateUIForUser(user) {
    console.log("Updating UI for logged-in user:", user.uid);
    currentUser = user;
    authContainer.style.display = 'none';
    mainContainer.style.display = 'block';
    userName.textContent = user.displayName;
    if (!db) {
      db = firebase.firestore();
    }
    renderNotes();
    renderTasks();
    renderReminders();
    renderBlockedWebsites();
  }

  function updateUIForGuest() {
    console.log("Updating UI for guest user.");
    currentUser = null;
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
    db = null;
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log("onAuthStateChanged: User is logged in.", user.uid);
      updateUIForUser(user);
    } else {
      console.log("onAuthStateChanged: User is logged out.");
      updateUIForGuest();
    }
  });

  loginButton.addEventListener('click', () => {
    console.log("Login button clicked.");
    chrome.runtime.sendMessage({ type: 'login' }, (response) => {
      if (response && response.user) {
        console.log("Login successful, updating UI.");
        updateUIForUser(response.user);
      } else {
        console.error("Login failed or no user data received.");
      }
    });
  });

  logoutButton.addEventListener('click', () => {
    firebase.auth().signOut();
  });

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
        if (noteContent && db && currentUser) {
          db.collection('users').doc(currentUser.uid).collection('notes').add({
            content: noteContent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then((docRef) => {
            console.log("Note saved to Firestore with ID:", docRef.id);
            mainQuill.root.innerHTML = '';
            renderNotes();
          }).catch(error => console.error("Error saving note to Firestore:", error));
        }
      }
    });
  });

  function renderNotes() {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('notes').orderBy('createdAt', 'desc').get().then((snapshot) => {
      console.log("Successfully retrieved notes from Firestore.");
      notesList.innerHTML = '';
      snapshot.forEach(doc => {
        const note = doc.data();
        console.log("  - Note data:", note);
        const noteContainer = document.createElement('div');
        noteContainer.classList.add('note-container');
        
        const noteElement = document.createElement('div');
        noteElement.innerHTML = note.content;
        
        const actionsContainer = document.createElement('div');
        actionsContainer.classList.add('note-actions');
        
        const displayIcon = document.createElement('img');
        displayIcon.src = 'images/icons/eye.svg';
        displayIcon.classList.add('note-action');
        displayIcon.addEventListener('click', () => openNoteModal(note.content, doc.id));
        
        const editIcon = document.createElement('img');
        editIcon.src = 'images/icons/pencil.svg';
        editIcon.classList.add('note-action');
        editIcon.addEventListener('click', () => editNote(doc.id, note.content));
        
        const deleteIcon = document.createElement('img');
        deleteIcon.src = 'images/icons/trash.svg';
        deleteIcon.classList.add('note-action');
        deleteIcon.addEventListener('click', () => deleteNote(doc.id));
        
        actionsContainer.appendChild(displayIcon);
        actionsContainer.appendChild(editIcon);
        actionsContainer.appendChild(deleteIcon);
        
        noteContainer.appendChild(noteElement);
        noteContainer.appendChild(actionsContainer);
        notesList.appendChild(noteContainer);
      });
    }).catch(error => console.error("Error getting notes from Firestore:", error));
  }

  function openNoteModal(noteContent, idOrIndex) {
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
      editNoteInModal(idOrIndex, noteContent);
    });
    
    const deleteIcon = document.createElement('img');
    deleteIcon.src = 'images/icons/trash.svg';
    deleteIcon.classList.add('note-action');
    deleteIcon.addEventListener('click', () => {
      showConfirm('Are you sure you want to delete this note?', (confirmed) => {
        if (confirmed) {
          deleteNote(idOrIndex);
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

  function editNoteInModal(idOrIndex, noteContent) {
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
          if (currentUser && db) {
            db.collection('users').doc(currentUser.uid).collection('notes').doc(idOrIndex).update({
              content: updatedContent
            }).then(() => {
              console.log("Successfully updated note in Firestore.");
              closeNoteModal();
              renderNotes();
            }).catch(error => console.error("Error updating note in Firestore:", error));
          } else {
            chrome.storage.local.get({notes: []}, (data) => {
              const notes = data.notes;
              notes[idOrIndex] = updatedContent;
              chrome.storage.local.set({notes: notes}, () => {
                closeNoteModal();
                renderNotes();
              });
            });
          }
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

  function editNote(id, noteContent) {
    showConfirm('Are you sure you want to edit this note? This will overwrite the current content in the main editor.', (confirmed) => {
      if (confirmed) {
        mainQuill.root.innerHTML = noteContent;
        deleteNote(id, true);
      }
    });
  }

  function deleteNote(id, isEditing = false) {
    if (!currentUser) return;
    const performDelete = () => {
        if (db) {
            db.collection('users').doc(currentUser.uid).collection('notes').doc(id).delete().then(() => {
                console.log("Successfully deleted note from Firestore.");
                renderNotes();
            }).catch(error => console.error("Error deleting note from Firestore:", error));
        }
    };

    if (isEditing) {
      performDelete();
    } else {
      showConfirm('Are you sure you want to delete this note?', (confirmed) => {
        if (confirmed) {
          performDelete();
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
        if (taskText && db && currentUser) {
          db.collection('users').doc(currentUser.uid).collection('tasks').add({
            text: taskText,
            completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then((docRef) => {
            console.log("Task saved to Firestore with ID:", docRef.id);
            taskInput.value = '';
            renderTasks();
          }).catch(error => console.error("Error saving task to Firestore:", error));
        }
      }
    });
  });

  function renderTasks() {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('createdAt', 'desc').get().then((snapshot) => {
      console.log("Successfully retrieved tasks from Firestore.");
      taskList.innerHTML = '';
      snapshot.forEach(doc => {
        const task = doc.data();
        console.log("  - Task data:", task);
        const taskElement = document.createElement('li');
        taskElement.textContent = task.text;
        taskElement.style.textDecoration = task.completed ? 'line-through' : 'none';
        
        const completeButton = document.createElement('input');
        completeButton.type = 'checkbox';
        completeButton.checked = task.completed;
        completeButton.addEventListener('change', () => {
          db.collection('users').doc(currentUser.uid).collection('tasks').doc(doc.id).update({
            completed: completeButton.checked
          }).then(() => {
            console.log("Successfully updated task in Firestore.");
            renderTasks();
          }).catch(error => console.error("Error updating task in Firestore:", error));
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          showConfirm('Are you sure you want to delete this task?', (confirmed) => {
            if (confirmed) {
              db.collection('users').doc(currentUser.uid).collection('tasks').doc(doc.id).delete().then(() => {
                console.log("Successfully deleted task from Firestore.");
                renderTasks();
              }).catch(error => console.error("Error deleting task from Firestore:", error));
            }
          });
        });

        taskElement.prepend(completeButton);
        taskElement.appendChild(deleteButton);
        taskList.appendChild(taskElement);
      });
    }).catch(error => console.error("Error getting tasks from Firestore:", error));
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

        if (reminderText && reminderTimestamp > Date.now() && db && currentUser) {
          db.collection('users').doc(currentUser.uid).collection('reminders').add({
            text: reminderText,
            time: reminderTimestamp,
            recurrence: recurrenceData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then((docRef) => {
            console.log("Reminder saved to Firestore with ID:", docRef.id);
            reminderInput.value = '';
            reminderTime.value = '';
            recurrenceUnit.value = 'none';
            customRecurrence.style.display = 'none';
            renderReminders();
          }).catch(error => console.error("Error saving reminder to Firestore:", error));
        }
      }
    });
  });

  function renderReminders() {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('reminders').orderBy('createdAt', 'desc').get().then((snapshot) => {
      console.log("Successfully retrieved reminders from Firestore.");
      reminderList.innerHTML = '';
      snapshot.forEach(doc => {
        const reminder = doc.data();
        console.log("  - Reminder data:", reminder);
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
              db.collection('users').doc(currentUser.uid).collection('reminders').doc(doc.id).delete().then(() => {
                console.log("Successfully deleted reminder from Firestore.");
                renderReminders();
              }).catch(error => console.error("Error deleting reminder from Firestore:", error));
            }
          });
        });

        reminderElement.appendChild(deleteButton);
        reminderList.appendChild(reminderElement);
      });
    }).catch(error => console.error("Error getting reminders from Firestore:", error));
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
    if (website && db && currentUser) {
      db.collection('users').doc(currentUser.uid).collection('blockedWebsites').add({
        url: website,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then((docRef) => {
        console.log("Blocked website saved to Firestore with ID:", docRef.id);
        websiteInput.value = '';
        renderBlockedWebsites();
      }).catch(error => console.error("Error saving blocked website to Firestore:", error));
    }
  });

  function renderBlockedWebsites() {
    if (!db || !currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('blockedWebsites').orderBy('createdAt', 'desc').get().then((snapshot) => {
      console.log("Successfully retrieved blocked websites from Firestore.");
      websiteList.innerHTML = '';
      snapshot.forEach(doc => {
        const website = doc.data();
        console.log("  - Blocked website data:", website);
        const websiteElement = document.createElement('li');
        websiteElement.textContent = website.url;
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'X';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          showConfirm('Are you sure you want to remove this website?', (confirmed) => {
            if (confirmed) {
              db.collection('users').doc(currentUser.uid).collection('blockedWebsites').doc(doc.id).delete().then(() => {
                console.log("Successfully deleted blocked website from Firestore.");
                renderBlockedWebsites();
              }).catch(error => console.error("Error deleting blocked website from Firestore:", error));
            }
          });
        });

        websiteElement.appendChild(deleteButton);
        websiteList.appendChild(websiteElement);
      });
    }).catch(error => console.error("Error getting blocked websites from Firestore:", error));
  }

  startFocusButton.addEventListener('click', () => {
    const duration = parseInt(focusDurationInput.value, 10);
    if (duration > 0) {
      console.log("Starting focus mode for", duration, "minutes.");
      chrome.storage.local.set({ focusModeDuration: duration });
      chrome.runtime.sendMessage({
        type: 'start-focus-mode',
        duration: duration
      });
    }
  });

  stopFocusButton.addEventListener('click', () => {
    console.log("Stopping focus mode.");
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

  updateFocusTimer();
  setInterval(updateFocusTimer, 1000);
});