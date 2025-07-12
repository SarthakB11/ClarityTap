chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'select-file') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          // Send the file content back to the background script
          chrome.runtime.sendMessage({ type: 'file-selected', content: content });
        };
        reader.readAsText(file);
      }
      // Close the offscreen document once the job is done
      window.close();
    });
    
    input.click();
  }
});