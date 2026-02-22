let subjects = [];
let editingIndex = -1;

function addOrUpdateSubject() {
    let name = document.getElementById("subjectName").value;
    let teacher = document.getElementById("teacherName").value;
    let count = parseInt(document.getElementById("subjectCount").value);

    if (!name || !teacher || !count) return;

    if (editingIndex === -1) {
        subjects.push({ name, teacher, count });
    } else {
        subjects[editingIndex] = { name, teacher, count };
        editingIndex = -1;
    }

    clearInputs();
    renderSubjectList();
}

function renderSubjectList() {
    let list = document.getElementById("subjectList");
    list.innerHTML = "";

    subjects.forEach((sub, index) => {
        let li = document.createElement("li");
        li.innerHTML = `
            ${sub.name} - ${sub.teacher} (${sub.count})
            <button class="action-btn" onclick="editSubject(${index})">Edit</button>
            <button class="action-btn" onclick="deleteSubject(${index})">Delete</button>
        `;
        list.appendChild(li);
    });
}

function editSubject(index) {
    let sub = subjects[index];
    document.getElementById("subjectName").value = sub.name;
    document.getElementById("teacherName").value = sub.teacher;
    document.getElementById("subjectCount").value = sub.count;
    editingIndex = index;
}

function deleteSubject(index) {
    subjects.splice(index, 1);
    renderSubjectList();
}

function clearInputs() {
    document.getElementById("subjectName").value = "";
    document.getElementById("teacherName").value = "";
    document.getElementById("subjectCount").value = "";
}

function resetAll() {
    subjects = [];
    editingIndex = -1;
    document.getElementById("timetable").innerHTML = "";
    renderSubjectList();
    clearInputs();
}

function generateSchedule() {

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const periodsPerDay = parseInt(document.getElementById("periods").value);

    let schedule = Array.from({ length: periodsPerDay }, () =>
        Array(days.length).fill("")
    );

    let subjectPool = [];

    subjects.forEach(sub => {
        for (let i = 0; i < sub.count; i++) {
            subjectPool.push(sub);
        }
    });

    subjectPool.sort(() => Math.random() - 0.5);

    let index = 0;

    for (let p = 0; p < periodsPerDay; p++) {
        for (let d = 0; d < days.length; d++) {
            if (index < subjectPool.length) {
                let sub = subjectPool[index];
                schedule[p][d] = `${sub.name}\n${sub.teacher}`;
                index++;
            }
        }
    }

    displaySchedule(schedule, days, periodsPerDay);
}

function displaySchedule(schedule, days, periods) {

    let html = "<table id='scheduleTable'>";
    html += "<tr><th>Period</th>";

    days.forEach(day => html += `<th>${day}</th>`);
    html += "</tr>";

    for (let i = 0; i < periods; i++) {
        html += `<tr><td>Period ${i + 1}</td>`;
        for (let j = 0; j < days.length; j++) {
            html += `<td>${schedule[i][j]}</td>`;
        }
        html += "</tr>";
    }

    html += "</table>";
    document.getElementById("timetable").innerHTML = html;
}

function downloadPDF() {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let table = document.getElementById("scheduleTable");
    if (!table) return alert("Generate timetable first!");

    doc.text("School Timetable", 14, 15);

    let rows = table.rows;
    let y = 25;

    for (let i = 0; i < rows.length; i++) {
        let rowText = "";
        for (let j = 0; j < rows[i].cells.length; j++) {
            rowText += rows[i].cells[j].innerText + " | ";
        }
        doc.text(rowText, 14, y);
        y += 10;
    }

    doc.save("timetable.pdf");
}