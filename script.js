let teachers = [];
let classes = [];
let assignments = {}; // assignments[class][period] = teacher

let editTeacherIndex = -1;
let editClassIndex = -1;

const TIMETABLE_STORAGE_KEY = "class_period_teacher_timetable_v1";

// ===== Helpers =====
function trim(v) { return (v || "").trim(); }

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function inlineJSString(value) {
  return JSON.stringify(String(value || "")).replace(/"/g, "&quot;");
}

function emptyStateHTML() {
  return `
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <h3>No timetable yet</h3>
      <p>Add teachers, create classes, set periods, then build or auto-generate your timetable.</p>
    </div>`;
}

function getPeriodCount() {
  const periods = parseInt(document.getElementById("periodCount").value);
  return Number.isFinite(periods) ? periods : 0;
}

function autoAdjustEnabled() {
  const el = document.getElementById("autoAdjust");
  return el ? el.checked : true;
}

function setSaveStatus(message) {
  const status = document.getElementById("saveStatus");
  if (status) status.textContent = message;
}

function getCurrentState() {
  return {
    teachers,
    classes,
    assignments,
    periodCount: getPeriodCount(),
    classCount: classes.length,
    autoAdjust: autoAdjustEnabled(),
    savedAt: new Date().toISOString()
  };
}

function cleanAssignments(periods) {
  const classSet = new Set(classes);
  const teacherSet = new Set(teachers);

  Object.keys(assignments).forEach(cls => {
    if (!classSet.has(cls)) {
      delete assignments[cls];
      return;
    }

    if (!assignments[cls] || typeof assignments[cls] !== "object") {
      assignments[cls] = {};
    }

    Object.keys(assignments[cls]).forEach(period => {
      const periodNumber = parseInt(period);
      const teacher = assignments[cls][period];

      if (!Number.isFinite(periodNumber) || periodNumber < 1 || (periods && periodNumber > periods)) {
        delete assignments[cls][period];
        return;
      }

      if (teacher && !teacherSet.has(teacher)) {
        assignments[cls][period] = "";
      }
    });
  });
}

function ensureAssignmentMap(periods) {
  cleanAssignments(periods);

  classes.forEach(cls => {
    if (!assignments[cls]) assignments[cls] = {};
    for (let p = 1; p <= periods; p++) {
      if (assignments[cls][p] === undefined) assignments[cls][p] = "";
    }
  });
}

function saveToBrowser(showMessage = true) {
  try {
    localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(getCurrentState()));
    setSaveStatus("Saved in this browser. You can close and edit later.");
    if (showMessage) alert("Timetable saved in this browser.");
  } catch (error) {
    console.error(error);
    setSaveStatus("Could not save. Browser storage may be blocked/full.");
    if (showMessage) alert("Could not save. Browser storage may be blocked or full.");
  }
}

function loadFromBrowser(showMessage = true) {
  const saved = localStorage.getItem(TIMETABLE_STORAGE_KEY);

  if (!saved) {
    setSaveStatus("No saved timetable found in this browser.");
    if (showMessage) alert("No saved timetable found in this browser.");
    renderLists();
    return false;
  }

  try {
    const data = JSON.parse(saved);

    teachers = Array.isArray(data.teachers) ? data.teachers : [];
    classes = Array.isArray(data.classes) ? data.classes : [];
    assignments = data.assignments && typeof data.assignments === "object" ? data.assignments : {};
    editTeacherIndex = -1;
    editClassIndex = -1;

    document.getElementById("teacherInput").value = "";
    document.getElementById("classInput").value = "";
    const classCountInput = document.getElementById("classCountInput");
    if (classCountInput) classCountInput.value = data.classCount || classes.length || "";
    document.getElementById("periodCount").value = data.periodCount || "";

    const autoAdjust = document.getElementById("autoAdjust");
    if (autoAdjust) autoAdjust.checked = data.autoAdjust !== false;

    const periods = getPeriodCount();
    ensureAssignmentMap(periods);
    renderLists();

    if (periods && classes.length > 0) {
      buildGrid(false);
    } else {
      document.getElementById("gridArea").innerHTML = emptyStateHTML();
    }

    const savedDate = data.savedAt ? new Date(data.savedAt).toLocaleString() : "earlier";
    setSaveStatus(`Loaded saved timetable from ${savedDate}.`);
    if (showMessage) alert("Saved timetable loaded.");
    return true;
  } catch (error) {
    console.error(error);
    setSaveStatus("Saved data is corrupted. Clear saved data and save again.");
    if (showMessage) alert("Saved data is corrupted. Please clear saved data and save again.");
    return false;
  }
}

function clearBrowserSave(showMessage = true) {
  if (showMessage && !confirm("Delete the saved timetable from this browser?")) return;

  localStorage.removeItem(TIMETABLE_STORAGE_KEY);
  setSaveStatus("Saved browser data cleared.");
  if (showMessage) alert("Saved browser data cleared.");
}

function autoSaveState() {
  saveToBrowser(false);
}

// Rule: One teacher cannot teach two classes in the same period
function teacherBusyInPeriod(period, teacher, excludingClass) {
  for (const cls of classes) {
    if (cls === excludingClass) continue;
    if (assignments[cls] && assignments[cls][period] === teacher) return true;
  }
  return false;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== Teachers CRUD =====
function addOrUpdateTeacher() {
  const val = trim(document.getElementById("teacherInput").value);
  if (!val) return;

  if (editTeacherIndex === -1) {
    teachers.push(val);
  } else {
    const oldTeacher = teachers[editTeacherIndex];
    teachers[editTeacherIndex] = val;

    // Rename this teacher inside the timetable too
    Object.keys(assignments).forEach(cls => {
      Object.keys(assignments[cls]).forEach(p => {
        if (assignments[cls][p] === oldTeacher) assignments[cls][p] = val;
      });
    });

    editTeacherIndex = -1;
  }

  document.getElementById("teacherInput").value = "";
  renderLists();
  rebuildIfVisible();
  autoSaveState();
}

function editTeacher(i) {
  document.getElementById("teacherInput").value = teachers[i];
  editTeacherIndex = i;
}

function deleteTeacher(i) {
  const removed = teachers[i];
  teachers.splice(i, 1);

  // Clear removed teacher from all assignments
  Object.keys(assignments).forEach(cls => {
    Object.keys(assignments[cls]).forEach(p => {
      if (assignments[cls][p] === removed) assignments[cls][p] = "";
    });
  });

  renderLists();
  rebuildIfVisible();
  autoSaveState();
}

// ===== Bulk Class Creator =====
function createNumberedClasses() {
  const input = document.getElementById("classCountInput");
  const count = parseInt(input ? input.value : "", 10);

  if (!Number.isFinite(count) || count < 1) {
    alert("Enter a valid number of classes first.");
    return;
  }

  if (count > 100) {
    alert("Please keep the class count 100 or below.");
    return;
  }

  const newClasses = Array.from({ length: count }, (_, i) => `Class ${i + 1}`);

  if (classes.length > 0) {
    const ok = confirm(`This will replace your current class list with Class 1 to Class ${count}. Continue?`);
    if (!ok) return;
  }

  const oldAssignments = assignments;
  const newAssignments = {};

  newClasses.forEach(cls => {
    newAssignments[cls] = oldAssignments[cls] || {};
  });

  classes = newClasses;
  assignments = newAssignments;
  editClassIndex = -1;

  document.getElementById("classInput").value = "";
  renderLists();
  rebuildIfVisible();
  autoSaveState();
  setSaveStatus(`Created ${count} numbered classes and saved in this browser.`);
}

// ===== Classes CRUD =====
function addOrUpdateClass() {
  const val = trim(document.getElementById("classInput").value);
  if (!val) return;

  if (editClassIndex === -1) {
    classes.push(val);
  } else {
    const old = classes[editClassIndex];
    classes[editClassIndex] = val;
    assignments[val] = assignments[old] || {};
    delete assignments[old];
    editClassIndex = -1;
  }

  document.getElementById("classInput").value = "";
  renderLists();
  rebuildIfVisible();
  autoSaveState();
}

function editClass(i) {
  document.getElementById("classInput").value = classes[i];
  editClassIndex = i;
}

function deleteClass(i) {
  const cls = classes[i];
  classes.splice(i, 1);
  delete assignments[cls];
  renderLists();
  rebuildIfVisible();
  autoSaveState();
}

// ===== Render Lists =====
function renderLists() {
  const tList = document.getElementById("teacherList");
  tList.innerHTML = "";
  teachers.forEach((t, i) => {
    tList.innerHTML += `
      <li>${escapeHTML(t)}
        <span>
          <button class="small-btn small-edit" onclick="editTeacher(${i})">Edit</button>
          <button class="small-btn small-del" onclick="deleteTeacher(${i})">Delete</button>
        </span>
      </li>`;
  });

  const cList = document.getElementById("classList");
  cList.innerHTML = "";
  classes.forEach((c, i) => {
    cList.innerHTML += `
      <li>${escapeHTML(c)}
        <span>
          <button class="small-btn small-edit" onclick="editClass(${i})">Edit</button>
          <button class="small-btn small-del" onclick="deleteClass(${i})">Delete</button>
        </span>
      </li>`;
  });
}

// ===== Build Empty Grid =====
function buildGrid(saveAfterBuild = true) {
  const periods = getPeriodCount();
  if (!periods || classes.length === 0) {
    alert("Add classes and set number of periods first.");
    return;
  }

  ensureAssignmentMap(periods);

  let html = `
    <div class="timetable-panel">
      <div class="timetable-panel-header">
        <h2>Final Timetable</h2>
        <span class="table-count">${classes.length} classes • ${periods} periods</span>
      </div>
      <div class="table-scroll">
        <table id="finalTable">
          <tr><th>Class × Period</th>`;

  for (let p = 1; p <= periods; p++) html += `<th>Period ${p}</th>`;
  html += `</tr>`;

  classes.forEach(cls => {
    html += `<tr><td><b>${escapeHTML(cls)}</b></td>`;
    for (let p = 1; p <= periods; p++) {
      const current = assignments[cls][p] || "";
      html += `<td>${teacherSelect(cls, p, current)}</td>`;
    }
    html += `</tr>`;
  });

  html += `
        </table>
      </div>
    </div>`;

  document.getElementById("gridArea").innerHTML = html;

  if (saveAfterBuild) autoSaveState();
}

// ===== Generate Full Timetable =====
function generateTimetable() {
  const periods = getPeriodCount();
  if (!periods || classes.length === 0 || teachers.length === 0) {
    alert("Add teachers + classes and set number of periods first.");
    return;
  }

  // clean generate
  assignments = {};
  ensureAssignmentMap(periods);

  // For each period, assign unique teachers to classes where possible.
  // If teachers < classes, remaining cells stay empty (still valid).
  for (let p = 1; p <= periods; p++) {
    const shuffled = shuffle(teachers);
    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      assignments[cls][p] = shuffled[i] || ""; // may be empty if not enough teachers
    }
  }

  buildGrid();
  autoSaveState();
}

// ===== Dropdown (conflict-aware) =====
function teacherSelect(cls, period, current) {
  let options = `<option value="">-- Select --</option>`;
  teachers.forEach(t => {
    const selected = t === current ? "selected" : "";
    options += `<option value="${escapeHTML(t)}" ${selected}>${escapeHTML(t)}</option>`;
  });

  return `<select aria-label="Teacher for ${escapeHTML(cls)} period ${period}" onchange="setAssignment(${inlineJSString(cls)}, ${period}, this.value)">
            ${options}
          </select>`;
}

function findClassUsingTeacherInPeriod(period, teacher, excludingClass) {
  for (const cls of classes) {
    if (cls === excludingClass) continue;
    if (assignments[cls] && assignments[cls][period] === teacher) return cls;
  }
  return null;
}

// ===== Manual Set + Auto-Adjust =====
function setAssignment(cls, period, teacher) {
  const periods = getPeriodCount();
  if (!periods) return;

  ensureAssignmentMap(periods);

  const oldTeacherHere = assignments[cls][period] || "";

  // If user cleared selection
  if (!teacher) {
    assignments[cls][period] = "";
    if (autoAdjustEnabled()) autoFillRowForClass(cls, periods);
    buildGrid();
    autoSaveState();
    return;
  }

  // Check if selected teacher is already used in same period
  const otherClass = findClassUsingTeacherInPeriod(period, teacher, cls);

  if (otherClass) {
    // SWAP teachers between cls and otherClass in same period
    assignments[cls][period] = teacher;
    assignments[otherClass][period] = oldTeacherHere; // may become "" if oldTeacherHere empty
  } else {
    // No conflict, normal assign
    assignments[cls][period] = teacher;
  }

  // Optional auto-adjust: fill empty periods in this row after manual change
  if (autoAdjustEnabled()) autoFillRowForClass(cls, periods);

  buildGrid();
  autoSaveState();
}

function autoFillRowForClass(cls, periods) {
  for (let p = 1; p <= periods; p++) {
    // only fill empty
    if (assignments[cls][p]) continue;

    // choose an available teacher for this period
    const choices = shuffle(teachers).filter(t => !teacherBusyInPeriod(p, t, cls));

    // If no teacher available, leave blank
    assignments[cls][p] = choices[0] || "";
  }
}

// ===== Reset =====
function resetAll() {
  teachers = [];
  classes = [];
  assignments = {};
  editTeacherIndex = -1;
  editClassIndex = -1;

  document.getElementById("teacherInput").value = "";
  document.getElementById("classInput").value = "";
  const classCountInput = document.getElementById("classCountInput");
  if (classCountInput) classCountInput.value = "";
  document.getElementById("periodCount").value = "";
  document.getElementById("gridArea").innerHTML = emptyStateHTML();

  renderLists();
  setSaveStatus("Page reset. Saved browser data is still kept unless you click Clear Saved.");
}

// ===== PDF =====
function downloadPDF() {
  const table = document.getElementById("finalTable");
  if (!table) {
    alert("Build or Generate timetable first!");
    return;
  }

  // Ask user for file name
  let fileName = prompt("Enter file name for the timetable:", "My_Timetable");
  if (!fileName) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(16);
  doc.text(fileName, 14, 15);

  // Convert HTML table into autoTable
  doc.autoTable({
    html: "#finalTable",
    startY: 25,
    theme: "grid",
    styles: {
      halign: "center",
      valign: "middle"
    },
    headStyles: {
      fillColor: [0, 123, 255]  // blue header
    }
  });

  doc.save(fileName + ".pdf");
}

// ===== Rebuild grid if visible =====
function rebuildIfVisible() {
  const table = document.getElementById("finalTable");
  if (table) buildGrid();
}

function initApp() {
  renderLists();
  loadFromBrowser(false);

  const periodInput = document.getElementById("periodCount");
  if (periodInput) {
    periodInput.addEventListener("change", () => {
      if (getPeriodCount() && classes.length > 0) ensureAssignmentMap(getPeriodCount());
      rebuildIfVisible();
      autoSaveState();
    });
  }

  const autoAdjust = document.getElementById("autoAdjust");
  if (autoAdjust) {
    autoAdjust.addEventListener("change", autoSaveState);
  }

  const classCountInput = document.getElementById("classCountInput");
  if (classCountInput) {
    classCountInput.addEventListener("keydown", event => {
      if (event.key === "Enter") createNumberedClasses();
    });
  }
}

// init
initApp();

renderLists();
