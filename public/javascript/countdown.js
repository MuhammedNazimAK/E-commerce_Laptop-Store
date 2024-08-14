// countdown.js
function startCountdown(duration, elementId, callback) {
  let timer = duration;
  const countdownElement = document.getElementById(elementId);
  const interval = setInterval(() => {
    countdownElement.textContent = timer;
    if (--timer < 0) {
      clearInterval(interval);
      if (callback) callback();
    }
  }, 1000);
}