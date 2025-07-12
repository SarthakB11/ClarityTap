// This script runs in a dedicated tab, waiting for a user click to open the file picker.

document.getElementById('select-file-button').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  // When the file is selected, read its content and send it to the background script.
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      // If the user cancels the dialog, just close the tab.
      window.close();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target.result;
      // Send the data to the background script for safe processing.
      chrome.runtime.sendMessage({ type: 'import-data-from-tab', data: fileContent }, (response) => {
        if (response && response.success) {
          console.log('Import message sent successfully.');
        } else {
          console.error('Failed to send import message.');
        }
        // Close the tab regardless of the response, as the job is done.
        window.close();
      });
    };
    reader.readAsText(file);
  };

  // Click the hidden input to open the file dialog.
  input.click();
});
