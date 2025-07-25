document.addEventListener('DOMContentLoaded', () => {
  flatpickr("#reminder-time", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
  });

  // Core UI elements
  const mainContainer = document.getElementById('main-container');
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const userProfile = document.getElementById('user-profile');
  const userIcon = document.getElementById('user-icon');
  const userTooltip = document.getElementById('user-tooltip');
  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');

  // Notes elements
  const saveNoteButton = document.getElementById('save-note');
  const notesList = document.getElementById('notes-list');
  
  // Tasks elements
  const taskInput = document.getElementById('task-input');
  const addTaskButton = document.getElementById('add-task');
  const taskList = document.getElementById('task-list');

  // Reminders elements
  const reminderInput = document.getElementById('reminder-input');
  const reminderTime = document.getElementById('reminder-time');
  const recurrenceUnit = document.getElementById('recurrence-unit');
  const customRecurrence = document.getElementById('custom-recurrence');
  const weeklyRecurrence = document.getElementById('weekly-recurrence');
  const monthlyRecurrence = document.getElementById('monthly-recurrence');
  const setReminderButton = document.getElementById('set-reminder');
  const reminderList = document.getElementById('reminder-list');

  // Focus Mode elements
  const websiteInput = document.getElementById('website-input');
  const addWebsiteButton = document.getElementById('add-website');
  const websiteList = document.getElementById('website-list');
  const focusDurationInput = document.getElementById('focus-duration');
  const startFocusButton = document.getElementById('start-focus');
  const stopFocusButton = document.getElementById('stop-focus');
  const timerSVG = document.getElementById('timer-svg');
  const timerProgress = document.getElementById('timer-progress');
  const timerText = document.getElementById('timer-text');
  
  // Modal elements
  const customConfirmModal = document.getElementById('custom-confirm-modal');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmYesButton = document.getElementById('confirm-yes-button');
  const confirmNoButton = document.getElementById('confirm-no-button');
  const settingsIcon = document.getElementById('settings-icon');
  const settingsModal = document.getElementById('settings-modal');
  const settingsCloseButton = document.getElementById('settings-close-button');
  const exportDataButton = document.getElementById('export-data-button');
  const importDataButton = document.getElementById('import-data-button');
  const themeToggle = document.getElementById('theme-toggle');
  const alarmSoundToggle = document.getElementById('alarm-sound-toggle');
  const globalSearchInput = document.getElementById('global-search-input');
  const globalSearchResults = document.getElementById('global-search-results');
  const themesButton = document.getElementById('themes-button');
  const themesContainer = document.getElementById('themes-container');
  const themeOptions = document.querySelectorAll('.theme-option');

  let db;
  let currentUser = null;
  let modalQuill;

  // --- Initial Setup ---
  mainContainer.style.display = 'none'; // Hide main content initially
  loadAndApplySettings();
  
  // Listen for live auth changes from the background script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'auth-changed') {
      console.log('Auth state change received from background.');
      if (request.user) {
        updateUIForUser(request.user);
      } else {
        updateUIForGuest();
      }
    }
  });

  // Check the initial auth status when the popup opens
  chrome.runtime.sendMessage({ type: 'check-auth-status' }, (response) => {
    mainContainer.style.display = 'block';
    if (response && response.user) {
      updateUIForUser(response.user);
    } else {
      updateUIForGuest();
    }
  });

  function updateUIForUser(user) {
    console.log("Updating UI for logged-in user:", user.uid);
    currentUser = user;
    loginButton.style.display = 'none';
    userProfile.style.display = 'flex';
    userTooltip.textContent = `${user.displayName} (${user.email})`;
    if (!db) {
      db = firebase.firestore();
    }
    renderAllContent();
  }

  function updateUIForGuest() {
    console.log("Updating UI for guest user.");
    currentUser = null;
    loginButton.style.display = 'block';
    userProfile.style.display = 'none';
    db = null;
    renderAllContent();
  }
  
  function renderAllContent() {
    renderNotes();
    renderTasks();
    renderReminders();
    renderBlockedWebsites();
    updateFocusTimer();
  }

  // --- Settings ---
  function loadAndApplySettings() {
    chrome.storage.local.get(['theme', 'alarmSound'], (settings) => {
      // Apply theme
      let currentTheme = settings.theme || 'default';
      if (currentTheme === 'light') currentTheme = 'default';

      document.body.className = '';
      document.body.classList.add(`${currentTheme}-theme`);
      
      themeOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.theme === currentTheme) {
          option.classList.add('selected');
        }
      });

      if (currentTheme === 'dark') {
        themeToggle.checked = true;
      } else {
        themeToggle.checked = false;
      }

      // Apply alarm sound setting
      if (settings.alarmSound === false) {
        alarmSoundToggle.checked = false;
      } else {
        alarmSoundToggle.checked = true;
      }
    });
  }

  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : 'default';
    document.body.className = `${theme}-theme`;
    chrome.storage.local.set({ theme: theme });
    
    themeOptions.forEach(opt => opt.classList.remove('selected'));
    document.querySelector(`.theme-option[data-theme="${theme}"]`).classList.add('selected');
  });

  alarmSoundToggle.addEventListener('change', () => {
    chrome.storage.local.set({ alarmSound: alarmSoundToggle.checked });
  });

  themesButton.addEventListener('click', () => {
    themesContainer.style.display = themesContainer.style.display === 'none' ? 'flex' : 'none';
  });

  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const selectedTheme = option.dataset.theme;
      document.body.className = ''; // Clear existing theme classes
      document.body.classList.add(`${selectedTheme}-theme`);
      chrome.storage.local.set({ theme: selectedTheme });

      // Update the selected visual state
      themeOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      // Sync dark mode toggle
      themeToggle.checked = (selectedTheme === 'dark');
    });
  });

  // --- Global Search ---
  globalSearchInput.addEventListener('input', handleGlobalSearch);

  async function handleGlobalSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    globalSearchResults.innerHTML = '';

    if (searchTerm.length < 2) {
      return; // Don't search for less than 2 characters
    }

    // 1. Fetch all data
    let allData = { notes: [], tasks: [], reminders: [], blockedWebsites: [] };
    const localData = await new Promise(resolve => chrome.storage.local.get(['notes', 'tasks', 'reminders', 'blockedWebsites'], resolve));
    
    if (currentUser && db) {
      const notesSnapshot = await db.collection('users').doc(currentUser.uid).collection('notes').get();
      allData.notes = notesSnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
      
      const tasksSnapshot = await db.collection('users').doc(currentUser.uid).collection('tasks').get();
      allData.tasks = tasksSnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
      
      const remindersSnapshot = await db.collection('users').doc(currentUser.uid).collection('reminders').get();
      allData.reminders = remindersSnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));

      const websitesSnapshot = await db.collection('users').doc(currentUser.uid).collection('blockedWebsites').get();
      allData.blockedWebsites = websitesSnapshot.docs.map(doc => ({...doc.data(), id: doc.id}));
    } else {
      allData.notes = localData.notes || [];
      allData.tasks = localData.tasks || [];
      allData.reminders = localData.reminders || [];
      allData.blockedWebsites = localData.blockedWebsites || [];
    }

    // 2. Filter data
    const noteResults = allData.notes.filter(n => n.content.toLowerCase().includes(searchTerm));
    const taskResults = allData.tasks.filter(t => t.text.toLowerCase().includes(searchTerm));
    const reminderResults = allData.reminders.filter(r => r.text.toLowerCase().includes(searchTerm));
    const websiteResults = allData.blockedWebsites.filter(w => w.url.toLowerCase().includes(searchTerm));

    // 3. Render results
    noteResults.forEach(n => renderSearchResult(n.content, 'note'));
    taskResults.forEach(t => renderSearchResult(t.text, 'task'));
    reminderResults.forEach(r => renderSearchResult(r.text, 'reminder'));
    websiteResults.forEach(w => renderSearchResult(w.url, 'website'));

    if (noteResults.length === 0 && taskResults.length === 0 && reminderResults.length === 0 && websiteResults.length === 0) {
      globalSearchResults.innerHTML = '<p class="empty-message">No results found.</p>';
    }
  }

  function renderSearchResult(content, type) {
    const item = document.createElement('div');
    item.classList.add('search-result-item', `result-type-${type}`);
    
    const typeSpan = document.createElement('span');
    typeSpan.classList.add('result-type');
    typeSpan.textContent = type;

    const contentSpan = document.createElement('span');
    contentSpan.classList.add('result-content');
    // In a real implementation, you'd want to sanitize this content
    // if it's from the note's innerHTML. For now, we'll use textContent.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    contentSpan.textContent = tempDiv.textContent || "";

    item.appendChild(typeSpan);
    item.appendChild(contentSpan);
    globalSearchResults.appendChild(item);
  }

  // --- Settings Modal ---
  settingsIcon.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });

  settingsCloseButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') {
      settingsModal.style.display = 'none';
    }
  });

  // --- Data Management ---
  exportDataButton.addEventListener('click', async () => {
    let allData = {
      notes: [],
      tasks: [],
      reminders: [],
      blockedWebsites: []
    };

    // Get local data first
    const localData = await new Promise(resolve => chrome.storage.local.get(null, resolve));
    allData.notes = localData.notes || [];
    allData.tasks = localData.tasks || [];
    allData.reminders = localData.reminders || [];
    allData.blockedWebsites = localData.blockedWebsites || [];

    // If logged in, get Firestore data
    if (currentUser && db) {
      const notesSnapshot = await db.collection('users').doc(currentUser.uid).collection('notes').get();
      allData.notes = notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const tasksSnapshot = await db.collection('users').doc(currentUser.uid).collection('tasks').get();
      allData.tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const remindersSnapshot = await db.collection('users').doc(currentUser.uid).collection('reminders').get();
      allData.reminders = remindersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const websitesSnapshot = await db.collection('users').doc(currentUser.uid).collection('blockedWebsites').get();
      allData.blockedWebsites = websitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const dataStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clarity-tap-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log("Data exported successfully.");
  });

    importDataButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'import.html' });
    settingsModal.style.display = 'none';
  });

  // --- Authentication ---
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
    console.log("Logout button clicked.");
    chrome.runtime.sendMessage({ type: 'logout' }, (response) => {
      if (response && response.success) {
        console.log("Logout successful, updating UI.");
        updateUIForGuest();
      } else {
        console.error("Logout failed.");
      }
    });
  });

  // --- Tabs ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.remove('active'));
      contents.forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // --- Quill Editor ---
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

  // --- Modals ---
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

  // --- Notes ---
  saveNoteButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to save this note?', (confirmed) => {
      if (confirmed) {
        const noteContent = mainQuill.root.innerHTML;
        if (!noteContent.trim() || noteContent === '<p><br></p>') return;

        if (currentUser && db) {
          db.collection('users').doc(currentUser.uid).collection('notes').add({
            content: noteContent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then((docRef) => {
            console.log("Note saved to Firestore with ID:", docRef.id);
            mainQuill.root.innerHTML = '';
            renderNotes();
          }).catch(error => console.error("Error saving note to Firestore:", error));
        } else {
          chrome.storage.local.get({ notes: [] }, (data) => {
            const notes = data.notes;
            notes.push({ id: `local-${Date.now()}`, content: noteContent });
            chrome.storage.local.set({ notes: notes }, () => {
              console.log("Note saved to local storage.");
              mainQuill.root.innerHTML = '';
              renderNotes();
            });
          });
        }
      }
    });
  });

  function renderNotes() {
    notesList.innerHTML = '';
    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('notes').orderBy('createdAt', 'desc').get().then((snapshot) => {
        console.log("Successfully retrieved notes from Firestore.");
        if (snapshot.empty) {
            notesList.innerHTML = '<p class="empty-message">No notes yet. Add one above!</p>';
        }
        snapshot.forEach(doc => {
          const note = doc.data();
          displayNote(note.content, doc.id);
        });
      }).catch(error => console.error("Error getting notes from Firestore:", error));
    } else {
      chrome.storage.local.get({ notes: [] }, (data) => {
        console.log("Successfully retrieved notes from local storage.");
        if (!data.notes || data.notes.length === 0) {
            notesList.innerHTML = '<p class="empty-message">No notes yet. Add one above!</p>';
        }
        data.notes.forEach(note => {
          displayNote(note.content, note.id);
        });
      });
    }
  }

  function displayNote(content, id) {
      const noteContainer = document.createElement('div');
      noteContainer.classList.add('note-container');
      
      const noteElement = document.createElement('div');
      noteElement.innerHTML = content;
      
      const actionsContainer = document.createElement('div');
      actionsContainer.classList.add('note-actions');
      
      const displayIcon = document.createElement('img');
      displayIcon.src = 'images/icons/eye.svg';
      displayIcon.classList.add('note-action');
      displayIcon.addEventListener('click', () => openNoteModal(content, id));
      
      const editIcon = document.createElement('img');
      editIcon.src = 'images/icons/pencil.svg';
      editIcon.classList.add('note-action');
      editIcon.addEventListener('click', () => editNote(id, content));
      
      const deleteIcon = document.createElement('img');
      deleteIcon.src = 'images/icons/trash.svg';
      deleteIcon.classList.add('note-action');
      deleteIcon.addEventListener('click', () => deleteNote(id));
      
      actionsContainer.appendChild(displayIcon);
      actionsContainer.appendChild(editIcon);
      actionsContainer.appendChild(deleteIcon);
      
      noteContainer.appendChild(noteElement);
      noteContainer.appendChild(actionsContainer);
      notesList.appendChild(noteContainer);
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
              const notes = data.notes.map(n => n.id === idOrIndex ? { ...n, content: updatedContent } : n);
              chrome.storage.local.set({notes: notes}, () => {
                console.log("Note updated in local storage.");
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
    const performDelete = () => {
      if (currentUser && db) {
        db.collection('users').doc(currentUser.uid).collection('notes').doc(id).delete().then(() => {
          console.log("Successfully deleted note from Firestore.");
          renderNotes();
        }).catch(error => console.error("Error deleting note from Firestore:", error));
      } else {
        chrome.storage.local.get({ notes: [] }, (data) => {
          const updatedNotes = data.notes.filter(note => note.id !== id);
          chrome.storage.local.set({ notes: updatedNotes }, () => {
            console.log("Successfully deleted note from local storage.");
            renderNotes();
          });
        });
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

  // --- Tasks ---
  const completedTasksHeader = document.getElementById('completed-tasks-header');
  const completedTaskList = document.getElementById('completed-task-list');

  completedTasksHeader.addEventListener('click', () => {
    const isDisplayed = completedTaskList.style.display === 'block';
    completedTaskList.style.display = isDisplayed ? 'none' : 'block';
  });

  addTaskButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to add this task?', (confirmed) => {
      if (confirmed) {
        const taskText = taskInput.value;
        if (!taskText.trim()) return;

        if (currentUser && db) {
          db.collection('users').doc(currentUser.uid).collection('tasks').add({
            text: taskText,
            completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then((docRef) => {
            console.log("Task saved to Firestore with ID:", docRef.id);
            taskInput.value = '';
            renderTasks();
          }).catch(error => console.error("Error saving task to Firestore:", error));
        } else {
          chrome.storage.local.get({ tasks: [] }, (data) => {
            const tasks = data.tasks;
            tasks.push({ id: `local-${Date.now()}`, text: taskText, completed: false });
            chrome.storage.local.set({ tasks: tasks }, () => {
              console.log("Task saved to local storage.");
              taskInput.value = '';
              renderTasks();
            });
          });
        }
      }
    });
  });

  function renderTasks() {
    taskList.innerHTML = '';
    completedTaskList.innerHTML = '';

    const processTasks = (tasks) => {
      if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<p class="empty-message">No tasks yet. Add one!</p>';
        return;
      }

      tasks.forEach(task => {
        if (task.completed) {
          displayTask(task.text, task.completed, task.id, completedTaskList);
        } else {
          displayTask(task.text, task.completed, task.id, taskList);
        }
      });
    };

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('tasks').orderBy('createdAt', 'desc').get().then((snapshot) => {
        console.log("Successfully retrieved tasks from Firestore.");
        const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        processTasks(tasks);
      }).catch(error => console.error("Error getting tasks from Firestore:", error));
    } else {
      chrome.storage.local.get({ tasks: [] }, (data) => {
        console.log("Successfully retrieved tasks from local storage.");
        processTasks(data.tasks);
      });
    }
  }

  function displayTask(text, completed, id, listElement) {
      const taskContainer = document.createElement('div');
      taskContainer.classList.add('note-container');

      const taskElement = document.createElement('li');
      
      const checkbox = document.createElement('div');
      checkbox.classList.add('task-checkbox');
      if (completed) {
        checkbox.classList.add('completed');
      }

      const check = document.createElement('div');
      check.classList.add('check');
      check.innerHTML = '&#x2713;';
      checkbox.appendChild(check);
      
      checkbox.addEventListener('click', () => {
        checkbox.classList.toggle('completed');
        
        setTimeout(() => {
          if (currentUser && db) {
              db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).update({
                  completed: !completed
              }).then(() => {
                  console.log("Successfully updated task in Firestore.");
                  renderTasks();
              }).catch(error => console.error("Error updating task in Firestore:", error));
          } else {
              chrome.storage.local.get({ tasks: [] }, (data) => {
                  const tasks = data.tasks.map(t => t.id === id ? { ...t, completed: !completed } : t);
                  chrome.storage.local.set({ tasks: tasks }, () => {
                      console.log("Task updated in local storage.");
                      renderTasks();
                  });
              });
          }
        }, 500);
      });

      const taskText = document.createElement('span');
      taskText.textContent = text;
      taskText.style.textDecoration = completed ? 'line-through' : 'none';

      const actionsContainer = document.createElement('div');
      actionsContainer.classList.add('note-actions');

      const editIcon = document.createElement('img');
      editIcon.src = 'images/icons/pencil.svg';
      editIcon.classList.add('note-action');
      editIcon.addEventListener('click', () => editTask(id, text));

      const deleteIcon = document.createElement('img');
      deleteIcon.src = 'images/icons/trash.svg';
      deleteIcon.classList.add('note-action');
      deleteIcon.addEventListener('click', () => deleteTask(id));

      actionsContainer.appendChild(editIcon);
      actionsContainer.appendChild(deleteIcon);

      taskElement.appendChild(checkbox);
      taskElement.appendChild(taskText);
      taskContainer.appendChild(taskElement);
      taskContainer.appendChild(actionsContainer);
      listElement.appendChild(taskContainer);
  }

  function editTask(id, text) {
    showConfirm('Are you sure you want to edit this task? This will overwrite the current content in the main editor.', (confirmed) => {
      if (confirmed) {
        taskInput.value = text;
        deleteTask(id, true);
      }
    });
  }

  function deleteTask(id, isEditing = false) {
    const performDelete = () => {
      if (currentUser && db) {
          db.collection('users').doc(currentUser.uid).collection('tasks').doc(id).delete().then(() => {
              console.log("Successfully deleted task from Firestore.");
              renderTasks();
          }).catch(error => console.error("Error deleting task from Firestore:", error));
      } else {
          chrome.storage.local.get({ tasks: [] }, (data) => {
              const updatedTasks = data.tasks.filter(t => t.id !== id);
              chrome.storage.local.set({ tasks: updatedTasks }, () => {
                  console.log("Task deleted from local storage.");
                  renderTasks();
              });
          });
      }
    };

    if (isEditing) {
      performDelete();
    } else {
      showConfirm('Are you sure you want to delete this task?', (confirmed) => {
        if (confirmed) {
          performDelete();
        }
      });
    }
  }

  // --- Reminders ---
  setReminderButton.addEventListener('click', () => {
    showConfirm('Are you sure you want to set this reminder?', (confirmed) => {
      if (confirmed) {
        const reminderText = reminderInput.value;
        const reminderTimestamp = new Date(reminderTime.value).getTime();
        if (!reminderText.trim() || !reminderTimestamp || reminderTimestamp <= Date.now()) {
            console.error("Invalid reminder text or time.");
            return;
        }
        
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

        const reminder = {
            id: `local-${Date.now()}`,
            text: reminderText,
            time: reminderTimestamp,
            recurrence: recurrenceData
        };

        if (currentUser && db) {
          reminder.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          db.collection('users').doc(currentUser.uid).collection('reminders').add(reminder).then((docRef) => {
            console.log("Reminder saved to Firestore with ID:", docRef.id);
            resetReminderForm();
            renderReminders();
          }).catch(error => console.error("Error saving reminder to Firestore:", error));
        } else {
            chrome.storage.local.get({ reminders: [] }, (data) => {
                const reminders = data.reminders;
                reminders.push(reminder);
                chrome.storage.local.set({ reminders: reminders }, () => {
                    console.log("Reminder saved to local storage.");
                    resetReminderForm();
                    renderReminders();
                });
            });
        }
      }
    });
  });
  
  function resetReminderForm() {
      reminderInput.value = '';
      reminderTime.value = '';
      recurrenceUnit.value = 'none';
      customRecurrence.style.display = 'none';
  }

  function renderReminders() {
    reminderList.innerHTML = '';
    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('reminders').orderBy('createdAt', 'desc').get().then((snapshot) => {
        console.log("Successfully retrieved reminders from Firestore.");
        if (snapshot.empty) {
            reminderList.innerHTML = '<p class="empty-message">No reminders yet. Set one!</p>';
        }
        snapshot.forEach(doc => {
          const reminder = doc.data();
          displayReminder(reminder, doc.id);
        });
      }).catch(error => console.error("Error getting reminders from Firestore:", error));
    } else {
      chrome.storage.local.get({ reminders: [] }, (data) => {
        console.log("Successfully retrieved reminders from local storage.");
        if (!data.reminders || data.reminders.length === 0) {
            reminderList.innerHTML = '<p class="empty-message">No reminders yet. Set one!</p>';
        }
        data.reminders.forEach(reminder => {
          displayReminder(reminder, reminder.id);
        });
      });
    }
  }

  function displayReminder(reminder, id) {
      const reminderContainer = document.createElement('div');
      reminderContainer.classList.add('note-container');

      const reminderElement = document.createElement('li');
      let recurrenceText = '';
      if (reminder.recurrence && reminder.recurrence.type !== 'none') {
        recurrenceText = `(Repeats ${reminder.recurrence.type})`;
      }
      reminderElement.textContent = `${reminder.text} - ${new Date(reminder.time).toLocaleString()} ${recurrenceText}`;
      
      const actionsContainer = document.createElement('div');
      actionsContainer.classList.add('note-actions');

      const editIcon = document.createElement('img');
      editIcon.src = 'images/icons/pencil.svg';
      editIcon.classList.add('note-action');
      editIcon.addEventListener('click', () => editReminder(id, reminder));

      const deleteIcon = document.createElement('img');
      deleteIcon.src = 'images/icons/trash.svg';
      deleteIcon.classList.add('note-action');
      deleteIcon.addEventListener('click', () => deleteReminder(id));

      actionsContainer.appendChild(editIcon);
      actionsContainer.appendChild(deleteIcon);

      reminderContainer.appendChild(reminderElement);
      reminderContainer.appendChild(actionsContainer);
      reminderList.appendChild(reminderContainer);
  }

  function editReminder(id, reminder) {
    showConfirm('Are you sure you want to edit this reminder? This will overwrite the current content in the main editor.', (confirmed) => {
      if (confirmed) {
        reminderInput.value = reminder.text;
        flatpickr("#reminder-time", {}).setDate(new Date(reminder.time));
        recurrenceUnit.value = reminder.recurrence.type;
        
        if (reminder.recurrence.type === 'weekly') {
          customRecurrence.style.display = 'block';
          weeklyRecurrence.style.display = 'block';
          monthlyRecurrence.style.display = 'none';
          document.querySelectorAll('.weekday-selector input').forEach(day => {
            day.checked = reminder.recurrence.days.includes(parseInt(day.value));
          });
        } else if (reminder.recurrence.type === 'monthly') {
          customRecurrence.style.display = 'block';
          weeklyRecurrence.style.display = 'none';
          monthlyRecurrence.style.display = 'block';
          document.getElementById('day-of-month').value = reminder.recurrence.dayOfMonth;
        } else {
          customRecurrence.style.display = 'none';
        }

        deleteReminder(id, true);
      }
    });
  }

  function deleteReminder(id, isEditing = false) {
    const performDelete = () => {
      if (currentUser && db) {
          db.collection('users').doc(currentUser.uid).collection('reminders').doc(id).delete().then(() => {
              console.log("Successfully deleted reminder from Firestore.");
              renderReminders();
          }).catch(error => console.error("Error deleting reminder from Firestore:", error));
      } else {
          chrome.storage.local.get({ reminders: [] }, (data) => {
              const updatedReminders = data.reminders.filter(r => r.id !== id);
              chrome.storage.local.set({ reminders: updatedReminders }, () => {
                  console.log("Reminder deleted from local storage.");
                  renderReminders();
              });
          });
      }
    };

    if (isEditing) {
      performDelete();
    } else {
      showConfirm('Are you sure you want to delete this reminder?', (confirmed) => {
        if (confirmed) {
          performDelete();
        }
      });
    }
  }

  // --- Focus Mode ---
  addWebsiteButton.addEventListener('click', () => {
    const website = websiteInput.value;
    if (!website.trim()) return;

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('blockedWebsites').add({
        url: website,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then((docRef) => {
        console.log("Blocked website saved to Firestore with ID:", docRef.id);
        websiteInput.value = '';
        renderBlockedWebsites();
      }).catch(error => console.error("Error saving blocked website to Firestore:", error));
    } else {
        chrome.storage.local.get({ blockedWebsites: [] }, (data) => {
            const blockedWebsites = data.blockedWebsites;
            blockedWebsites.push({ id: `local-${Date.now()}`, url: website });
            chrome.storage.local.set({ blockedWebsites: blockedWebsites }, () => {
                console.log("Blocked website saved to local storage.");
                websiteInput.value = '';
                renderBlockedWebsites();
            });
        });
    }
  });

  function renderBlockedWebsites() {
    websiteList.innerHTML = '';
    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('blockedWebsites').orderBy('createdAt', 'desc').get().then((snapshot) => {
        console.log("Successfully retrieved blocked websites from Firestore.");
        if (snapshot.empty) {
            websiteList.innerHTML = '<p class="empty-message">No websites blocked.</p>';
        }
        const websites = [];
        snapshot.forEach(doc => {
          const website = doc.data();
          websites.push(website.url);
          displayBlockedWebsite(website.url, doc.id);
        });
        updateBlockingRules(websites);
      }).catch(error => console.error("Error getting blocked websites from Firestore:", error));
    } else {
        chrome.storage.local.get({ blockedWebsites: [] }, (data) => {
            console.log("Successfully retrieved blocked websites from local storage.");
            if (!data.blockedWebsites || data.blockedWebsites.length === 0) {
                websiteList.innerHTML = '<p class="empty-message">No websites blocked.</p>';
            }
            const websites = data.blockedWebsites.map(w => w.url);
            data.blockedWebsites.forEach(website => {
                displayBlockedWebsite(website.url, website.id);
            });
            updateBlockingRules(websites);
        });
    }
  }

  function displayBlockedWebsite(url, id) {
      const websiteContainer = document.createElement('div');
      websiteContainer.classList.add('note-container');

      const websiteElement = document.createElement('li');
      websiteElement.textContent = url;
      
      const actionsContainer = document.createElement('div');
      actionsContainer.classList.add('note-actions');

      const editIcon = document.createElement('img');
      editIcon.src = 'images/icons/pencil.svg';
      editIcon.classList.add('note-action');
      editIcon.addEventListener('click', () => editBlockedWebsite(id, url));

      const deleteIcon = document.createElement('img');
      deleteIcon.src = 'images/icons/trash.svg';
      deleteIcon.classList.add('note-action');
      deleteIcon.addEventListener('click', () => deleteBlockedWebsite(id));

      actionsContainer.appendChild(editIcon);
      actionsContainer.appendChild(deleteIcon);

      websiteContainer.appendChild(websiteElement);
      websiteContainer.appendChild(actionsContainer);
      websiteList.appendChild(websiteContainer);
  }
  
  function editBlockedWebsite(id, url) {
    showConfirm('Are you sure you want to edit this blocked website? This will overwrite the current content in the main editor.', (confirmed) => {
      if (confirmed) {
        websiteInput.value = url;
        deleteBlockedWebsite(id, true);
      }
    });
  }

  function deleteBlockedWebsite(id, isEditing = false) {
    const performDelete = () => {
      if (currentUser && db) {
          db.collection('users').doc(currentUser.uid).collection('blockedWebsites').doc(id).delete().then(() => {
              console.log("Successfully deleted blocked website from Firestore.");
              renderBlockedWebsites();
          }).catch(error => console.error("Error deleting blocked website from Firestore:", error));
      } else {
          chrome.storage.local.get({ blockedWebsites: [] }, (data) => {
              const updatedWebsites = data.blockedWebsites.filter(w => w.id !== id);
              chrome.storage.local.set({ blockedWebsites: updatedWebsites }, () => {
                  console.log("Blocked website deleted from local storage.");
                  renderBlockedWebsites();
              });
          });
      }
    };

    if (isEditing) {
      performDelete();
    } else {
      showConfirm('Are you sure you want to remove this website?', (confirmed) => {
        if (confirmed) {
          performDelete();
        }
      });
    }
  }
  
  function updateBlockingRules(websites) {
      chrome.runtime.sendMessage({
          type: 'update-blocking',
          websites: websites
      });
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
  
  const radius = timerProgress.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;

  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = circumference;

  function setProgress(percent) {
    const offset = circumference - percent / 100 * circumference;
    timerProgress.style.strokeDashoffset = offset;
  }
  
  // Init focus timer update loop
  setInterval(updateFocusTimer, 1000);
});