chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'play-audio') {
    const audio = new Audio(msg.url);
    audio.play();
  }
});