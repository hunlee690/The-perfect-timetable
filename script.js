let teachers = [];
let classes = [];
let assignments = {}; // assignments[class][period] = teacher

let editTeacherIndex = -1;
let editClassIndex = -1;

// ===== Helpers =====
function trim(v) { return (v || "").trim(); }

function getPeriodCount() {
  const periods = parseInt(document.getElementById("periodCount").value);
  return Number.isFinite(periods) ? periods : 0;
}

function ensureAssignmentMap(periods) {
  classes.forEach(cls => {
    if (!assignments[cls]) assignments[cls] = {};
    for (let p = 1; p <= periods; p++) {
      if (assignments[cls][p] === undefined) assignments[cls][p] = "";
    }
  });
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

function autoAdjustEnabled() {
  const el = document.getElementById("autoAdjust");
  return el ? el.checked : true;
}

// ===== Teachers CRUD =====
function addOrUpdateTeacher() {
  const val = trim(document.getElementById("teacherInput").value);
  if (!val) return;

  if (editTeacherIndex === -1) teachers.push(val);
  else { teachers[editTeacherIndex] = val; editTeacherIndex = -1; }

  document.getElementById("teacherInput").value = "";
  renderLists();
  rebuildIfVisible();
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
}

// ===== Classes CRUD =====
function addOrUpdateClass() {
  const val = trim(document.getElementById("classInput").value);
  if (!val) return;

  if (editClassIndex === -1) classes.push(val);
  else {
    const old = classes[editClassIndex];
    classes[editClassIndex] = val;
    assignments[val] = assignments[old] || {};
    delete assignments[old];
    editClassIndex = -1;
  }

  document.getElementById("classInput").value = "";
  renderLists();
  rebuildIfVisible();
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
}

// ===== Render Lists =====
function renderLists() {
  const tList = document.getElementById("teacherList");
  tList.innerHTML = "";
  teachers.forEach((t, i) => {
    tList.innerHTML += `
      <li>${t}
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
      <li>${c}
        <span>
          <button class="small-btn small-edit" onclick="editClass(${i})">Edit</button>
          <button class="small-btn small-del" onclick="deleteClass(${i})">Delete</button>
        </span>
      </li>`;
  });
}

// ===== Build Empty Grid =====
function buildGrid() {
  const periods = getPeriodCount();
  if (!periods || classes.length === 0) {
    alert("Add classes and set number of periods first.");
    return;
  }

  ensureAssignmentMap(periods);

  let html = `<table id="finalTable"><tr><th>Class \\ Period</th>`;
  for (let p = 1; p <= periods; p++) html += `<th>Period ${p}</th>`;
  html += `</tr>`;

  classes.forEach(cls => {
    html += `<tr><td><b>${cls}</b></td>`;
    for (let p = 1; p <= periods; p++) {
      const current = assignments[cls][p] || "";
      html += `<td>${teacherSelect(cls, p, current)}</td>`;
    }
    html += `</tr>`;
  });

  html += `</table>`;
  document.getElementById("gridArea").innerHTML = html;
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
}

// ===== Dropdown (conflict-aware) =====
function teacherSelect(cls, period, current) {
  let options = `<option value="">-- Select --</option>`;
  teachers.forEach(t => {
    const selected = t === current ? "selected" : "";
    options += `<option value="${t}" ${selected}>${t}</option>`;
  });

  return `<select onchange="setAssignment('${cls}', ${period}, this.value)">
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
  document.getElementById("periodCount").value = "";
  document.getElementById("gridArea").innerHTML = "";

  renderLists();
}

// ===== PDF =====
function downloadPDF() {
  const table = document.getElementById("finalTable");
  if (!table) return alert("Build or Generate timetable first!");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.text("Class × Period Teacher Timetable", 14, 14);

  let y = 24;
  for (let i = 0; i < table.rows.length; i++) {
    let rowText = "";
    for (let j = 0; j < table.rows[i].cells.length; j++) {
      rowText += table.rows[i].cells[j].innerText.replace(/\s+/g, " ").trim() + " | ";
    }
    if (y > 190) { doc.addPage(); y = 14; }
    doc.text(rowText, 14, y);
    y += 8;
  }

  doc.save("class_period_timetable.pdf");
}

// ===== Rebuild grid if visible =====
function rebuildIfVisible() {
  const table = document.getElementById("finalTable");
  if (table) buildGrid();
}

// init
renderLists();
