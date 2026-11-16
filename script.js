
const clock = document.getElementById("clock");
const today = document.getElementById("today");
const addButton = document.getElementById("addReminder");
const reminderList = document.getElementById("reminderList");
const reminderCount = document.getElementById("reminderCount");

let reminders = [];
let voiceRetryTimer = null;
let voiceStopTimer = null;
let activeAlarmPopup = null;
let announcementEnd = 0;

try {
  reminders = JSON.parse(localStorage.getItem("voiceReminders")) || [];
} catch (error) {
  reminders = [];
}

// Voice controls
const testVoiceButton = document.createElement("button");
testVoiceButton.textContent = "♫ Test Voice";
testVoiceButton.style.cssText = `
  width:100%; margin-top:12px; padding:15px;
  border:1px solid #ffffff25; border-radius:16px;
  background:#ffffff12; color:white; font-size:14px;
`;
addButton.after(testVoiceButton);

const stopVoiceButton = document.createElement("button");
stopVoiceButton.textContent = "■ Stop Voice";
stopVoiceButton.style.cssText = `
  width:100%; margin-top:10px; padding:15px;
  border:1px solid #ff777755; border-radius:16px;
  background:#ff555522; color:#ff9999; font-size:14px;
`;
testVoiceButton.after(stopVoiceButton);

const voiceStatus = document.createElement("p");
voiceStatus.style.cssText =
  "text-align:center;color:#aeb6cc;font-size:12px;margin-top:12px;";
stopVoiceButton.after(voiceStatus);

// Styles
const styles = document.createElement("style");
styles.textContent = `
.reminder-card {
  display:flex; justify-content:space-between;
  align-items:center; gap:12px; padding:17px;
  border:1px solid #ffffff20; border-radius:20px;
  background:#ffffff10;
}
.reminder-info { min-width:0; }
.reminder-info h3 { font-size:15px; margin-bottom:6px; overflow-wrap:anywhere; }
.reminder-info p { font-size:12px; color:#aeb6cc; margin-top:4px; }
.delete-reminder {
  border:0; background:#ff555522; color:#ff7777;
  border-radius:12px; padding:10px;
}
.reminder-modal {
  position:fixed; inset:0; z-index:1000;
  background:#000b; display:flex;
  align-items:center; justify-content:center; padding:18px;
}
.reminder-form {
  width:100%; max-width:420px; padding:24px;
  border:1px solid #ffffff25; border-radius:25px;
  background:#202330;
}
.reminder-form h2 { margin-bottom:20px; }
.reminder-form label {
  display:block; color:#c4c9d8;
  font-size:13px; margin:14px 0 7px;
}
.reminder-form input, .reminder-form textarea {
  width:100%; padding:13px; border:1px solid #ffffff25;
  border-radius:12px; background:#ffffff10;
  color:white; font:inherit; outline:none;
}
.reminder-form textarea { resize:vertical; min-height:75px; }
.reminder-form input[type="datetime-local"] { color-scheme:dark; }
.form-actions { display:flex; gap:10px; margin-top:22px; }
.form-actions button {
  flex:1; padding:13px; border:0;
  border-radius:12px; font-size:14px; font-weight:600;
}
.cancel-reminder { background:#ffffff18; color:white; }
.save-reminder { background:#8293ff; color:white; }

.alarm-overlay {
  position:fixed; inset:0; z-index:3000;
  background:#080a12eF; display:flex;
  align-items:center; justify-content:center;
  padding:22px;
}
.alarm-box {
  width:100%; max-width:360px; padding:30px 22px;
  text-align:center; border:1px solid #ffffff25;
  border-radius:28px;
  background:linear-gradient(145deg,#303958,#202330);
  box-shadow:0 20px 70px #0009;
}
.alarm-symbol { font-size:42px; margin-bottom:16px; }
.alarm-box h2 { font-size:23px; margin-bottom:12px; }
.alarm-box p { color:#c2c8dc; font-size:14px; margin-bottom:24px; }
.stop-alarm-button {
  width:100%; padding:16px; border:0;
  border-radius:16px; background:#ff626e;
  color:white; font-size:16px; font-weight:700;
}
`;

// Add styles only once
document.head.appendChild(styles);

// Clock
function updateClock() {
  const now = new Date();

  clock.textContent = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  today.textContent = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// Save reminders
function saveReminders() {
  localStorage.setItem("voiceReminders", JSON.stringify(reminders));
}

// Display reminders
function renderReminders() {
  reminderList.innerHTML = "";

  reminderCount.textContent =
    reminders.length +
    (reminders.length === 1 ? " reminder" : " reminders");

  if (reminders.length === 0) {
    reminderList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No reminders yet</h3>
        <p>Your reminders will appear here.</p>
      </div>
    `;
    return;
  }

  reminders.forEach(reminder => {
    const card = document.createElement("div");
    card.className = "reminder-card";

    const info = document.createElement("div");
    info.className = "reminder-info";

    const title = document.createElement("h3");
    title.textContent = reminder.title;

    const date = document.createElement("p");
    date.textContent = new Date(reminder.time).toLocaleString(
      "en-IN",
      { dateStyle: "medium", timeStyle: "short" }
    );

    const status = document.createElement("p");
    status.textContent = reminder.fired ? "Completed" : "Upcoming";

    info.append(title, date, status);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-reminder";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      reminders = reminders.filter(item => item.id !== reminder.id);
      saveReminders();
      renderReminders();
    });

    card.append(info, deleteButton);
    reminderList.appendChild(card);
  });
}

// Stop voice playback
function stopVoice() {
  clearTimeout(voiceRetryTimer);
  clearTimeout(voiceStopTimer);

  voiceRetryTimer = null;
  voiceStopTimer = null;
  announcementEnd = 0;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  voiceStatus.textContent = "Voice stopped.";
}

// Close alarm popup and stop voice
function dismissAlarm() {
  stopVoice();

  if (activeAlarmPopup) {
    activeAlarmPopup.remove();
    activeAlarmPopup = null;
  }
}

// Speak once
function speakOnce(message) {
  if (!("speechSynthesis" in window)) {
    voiceStatus.textContent = "Voice is not supported.";
    return;
  }

  stopVoice();

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = "en-IN";
  speech.rate = 0.9;
  speech.pitch = 1;

  speech.onstart = () => {
    voiceStatus.textContent = "Speaking...";
  };

  speech.onend = () => {
    voiceStatus.textContent = "Voice test completed.";
  };

  speech.onerror = () => {
    voiceStatus.textContent = "Voice playback failed.";
  };

  window.speechSynthesis.speak(speech);
}

// Repeat voice for one minute
function announceForOneMinute(message) {
  if (!("speechSynthesis" in window)) return;

  stopVoice();

  announcementEnd = Date.now() + 60000;
  voiceStatus.textContent = "Alarm is repeating.";

  voiceStopTimer = setTimeout(() => {
    stopVoice();

    if (activeAlarmPopup) {
      activeAlarmPopup.remove();
      activeAlarmPopup = null;
    }

    voiceStatus.textContent = "One-minute alarm finished.";
  }, 60000);

  function repeatAnnouncement() {
    if (Date.now() >= announcementEnd) {
      stopVoice();
      return;
    }

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "en-IN";
    speech.rate = 0.9;
    speech.pitch = 1;

    speech.onend = () => {
      if (Date.now() < announcementEnd) {
        voiceRetryTimer = setTimeout(repeatAnnouncement, 1200);
      }
    };

    speech.onerror = () => {
      stopVoice();
      voiceStatus.textContent = "Voice playback failed.";
    };

    window.speechSynthesis.speak(speech);
  }

  repeatAnnouncement();
}

// Show title popup
function showAlarmPopup(title) {
  if (activeAlarmPopup) {
    activeAlarmPopup.remove();
  }

  const overlay = document.createElement("div");
  overlay.className = "alarm-overlay";

  const box = document.createElement("div");
  box.className = "alarm-box";

  const symbol = document.createElement("div");
  symbol.className = "alarm-symbol";
  symbol.textContent = "🔔";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const message = document.createElement("p");
  message.textContent = "Your reminder is ringing!";

  const stopButton = document.createElement("button");
  stopButton.className = "stop-alarm-button";
  stopButton.textContent = "■ Stop Alarm";

  stopButton.addEventListener("click", dismissAlarm);

  box.append(symbol, heading, message, stopButton);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  activeAlarmPopup = overlay;
}

// Test voice
testVoiceButton.addEventListener("click", () => {
  speakOnce("Hello! Your Voice Reminder app is working.");
});

stopVoiceButton.addEventListener("click", dismissAlarm);

// Open reminder form
function openReminderForm() {
  if (document.querySelector(".reminder-modal")) return;

  const modal = document.createElement("div");
  modal.className = "reminder-modal";

  modal.innerHTML = `
    <form class="reminder-form">
      <h2>New Reminder</h2>

      <label for="reminderTitle">Reminder title</label>
      <input id="reminderTitle" type="text"
        placeholder="Example: Study Botany"
        maxlength="60" required>

      <label for="reminderTime">Date and time</label>
      <input id="reminderTime" type="datetime-local" required>

      <label for="reminderMessage">Voice announcement</label>
      <textarea id="reminderMessage"
        placeholder="Example: It's time to study Botany."
        maxlength="200"></textarea>

      <div class="form-actions">
        <button type="button" class="cancel-reminder">Cancel</button>
        <button type="submit" class="save-reminder">Save reminder</button>
      </div>
    </form>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("form");
  const timeInput = modal.querySelector("#reminderTime");

  const defaultTime = new Date(Date.now() + 5 * 60000);
  defaultTime.setSeconds(0, 0);

  timeInput.value = new Date(
    defaultTime.getTime() - defaultTime.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);

  timeInput.min = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);

  modal.querySelector(".cancel-reminder")
    .addEventListener("click", () => modal.remove());

  modal.addEventListener("click", event => {
    if (event.target === modal) modal.remove();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const title = modal.querySelector("#reminderTitle").value.trim();
    const time = new Date(timeInput.value).getTime();
    const message = modal.querySelector("#reminderMessage").value.trim();

    if (!title || !timeInput.value || time <= Date.now()) {
      alert("Please enter a title and a future date and time.");
      return;
    }

    reminders.push({
      id: Date.now().toString(),
      title,
      time,
      message: message || title,
      fired: false
    });

    saveReminders();
    renderReminders();
    modal.remove();
  });

  modal.querySelector("#reminderTitle").focus();
}

// Check reminders
function checkReminders() {
  const now = Date.now();
  let changed = false;

  reminders.forEach(reminder => {
    if (!reminder.fired && now >= reminder.time) {
      reminder.fired = true;
      changed = true;

      announceForOneMinute(reminder.message);
      showAlarmPopup(reminder.title);
    }
  });

  if (changed) {
    saveReminders();
    renderReminders();
  }
}

// Start app
addButton.addEventListener("click", openReminderForm);

updateClock();
renderReminders();

setInterval(updateClock, 1000);
setInterval(checkReminders, 1000);
