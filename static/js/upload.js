/* upload.js — Kompta.ai dashboard upload
   Remplace app.js pour la section upload.
   Toute la logique métier (fetch /api/process, showResults, resetAll) est préservée. */

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const fileList    = document.getElementById('fileList');
const fileCard    = document.getElementById('fileCard');
const fileCount   = document.getElementById('fileCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const processBtn  = document.getElementById('processBtn');

const uploadSection     = document.getElementById('upload-section');
const processingSection = document.getElementById('processing-section');
const resultsSection    = document.getElementById('results');

const progressBar   = document.getElementById('progressBar');
const elapsedTimer  = document.getElementById('elapsedTimer');
const progressFiles = document.getElementById('progressFiles');

// ── State ─────────────────────────────────────────────────────────────────────
let selectedFiles = [];
let timerInterval = null;
let progressInterval = null;
let startTime = null;

// ── Drag & Drop ───────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });
});

dropzone.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files).filter(f =>
        f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.zip')
    );
    addFiles(files);
});

fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
});

// ── File management ───────────────────────────────────────────────────────────
function addFiles(files) {
    files.forEach(f => {
        if (!selectedFiles.find(s => s.name === f.name)) {
            selectedFiles.push(f);
        }
    });
    renderFiles();
}

function removeFile(idx) {
    selectedFiles.splice(idx, 1);
    renderFiles();
}

function clearAll() {
    selectedFiles = [];
    renderFiles();
}

function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    return Math.round(bytes / 1024) + ' Ko';
}

function fileIcon(name) {
    return name.toLowerCase().endsWith('.zip') ? '🗜️' : '📄';
}

function renderFiles() {
    const n = selectedFiles.length;

    if (n === 0) {
        fileCard.style.display = 'none';
        processBtn.disabled = true;
        return;
    }

    fileCard.style.display = 'block';
    fileCount.textContent = n;

    fileList.innerHTML = selectedFiles.map((f, i) => `
        <div class="file-row">
            <span class="file-row-icon">${fileIcon(f.name)}</span>
            <span class="file-row-name">${f.name}</span>
            <span class="file-row-size">${formatSize(f.size)}</span>
            <button class="file-row-remove" onclick="removeFile(${i})" title="Retirer">×</button>
        </div>
    `).join('');

    processBtn.disabled = false;
}

clearAllBtn.addEventListener('click', clearAll);

// ── Progress helpers ──────────────────────────────────────────────────────────
function startFakeProgress() {
    startTime = Date.now();

    // Timer
    timerInterval = setInterval(() => {
        const s = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(s / 60);
        const ss = s % 60;
        elapsedTimer.textContent = m > 0
            ? `⏱ ${m} min ${ss} s`
            : `⏱ ${ss} s`;
    }, 1000);

    // Fake progress : 0 → 90% en ~3 min (180s), courbe logarithmique
    let pct = 0;
    progressBar.style.width = '0%';
    progressInterval = setInterval(() => {
        // Montée rapide au début, ralentit vers 90%
        const elapsed = (Date.now() - startTime) / 1000;
        pct = 90 * (1 - Math.exp(-elapsed / 55));
        progressBar.style.width = Math.min(pct, 90) + '%';
    }, 500);
}

function stopFakeProgress(success) {
    clearInterval(timerInterval);
    clearInterval(progressInterval);
    timerInterval = null;
    progressInterval = null;

    if (success) {
        progressBar.style.width = '100%';
        progressBar.classList.add('done');
    }
}

function showProcessing() {
    // Afficher noms des fichiers en cours
    progressFiles.textContent = selectedFiles.map(f => f.name).join(' · ');

    uploadSection.style.display = 'none';
    processingSection.style.display = 'block';
    resultsSection.classList.remove('active');

    startFakeProgress();
}

// ── Process ───────────────────────────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    showProcessing();

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));

    try {
        const resp = await fetch('/api/process', {
            method: 'POST',
            headers: { 'X-CSRF-Token': CSRF_TOKEN },
            body: formData
        });

        if (resp.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await resp.json();

        stopFakeProgress(true);

        // Petit délai pour que la barre passe à 100% avant de switcher
        await new Promise(r => setTimeout(r, 400));

        if (data.error) {
            alert('Erreur : ' + data.error);
            resetAll();
            return;
        }

        showResults(data);

    } catch (err) {
        stopFakeProgress(false);
        alert('Erreur de connexion : ' + err.message);
        resetAll();
    }
});

// ── Results (repris de app.js, inchangé) ─────────────────────────────────────
function showResults(data) {
    processingSection.style.display = 'none';
    resultsSection.classList.add('active');

    const s = data.summary;

    document.getElementById('resultSummary').textContent =
        `${s.total} justificatif(s) traité(s) — ${s.exploites} exploitable(s), ${s.inexploites} inexploitable(s)`;

    document.getElementById('stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total</div>
            <div class="stat-value">${s.total}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Exploités</div>
            <div class="stat-value green">${s.exploites}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Rejetés</div>
            <div class="stat-value ${s.inexploites > 0 ? 'orange' : ''}">${s.inexploites}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Équilibre</div>
            <div class="stat-value ${s.equilibre ? 'green' : 'red'}">${s.equilibre ? '✓' : '✗'}</div>
        </div>
    `;

    const dl = data.output_files;
    let dlHtml = '';
    if (dl.excel)            dlHtml += downloadCard('📊', 'excel', dl.excel.name, 'Import Sage — écritures comptables');
    if (dl.stamped_pdf)      dlHtml += downloadCard('📑', 'pdf-s', dl.stamped_pdf.name, 'Tickets visés avec tampon S');
    if (dl.inexploitable_pdf) dlHtml += downloadCard('⚠️', 'pdf-x', dl.inexploitable_pdf.name, 'Justificatifs à corriger');
    document.getElementById('downloads').innerHTML = dlHtml;

    const tbody = document.getElementById('detailBody');
    tbody.innerHTML = data.results_detail.map(r => {
        const libelle = r.status === 'exploitable'
            ? (r.ecritures && r.ecritures[0] ? r.ecritures[0].libelle : '-')
            : r.raison;
        return `<tr>
            <td>${r.filename}</td>
            <td><span class="badge ${r.status === 'exploitable' ? 'ok' : 'ko'}">${r.status === 'exploitable' ? 'OK' : 'Rejet'}</span></td>
            <td>${r.reference || '-'}</td>
            <td>${libelle || '-'}</td>
        </tr>`;
    }).join('');
}

function downloadCard(icon, type, filename, desc) {
    return `
        <div class="download-card">
            <div class="download-info">
                <div class="download-icon ${type}">${icon}</div>
                <div>
                    <div class="download-name">${filename}</div>
                    <div class="download-desc">${desc}</div>
                </div>
            </div>
            <a href="/api/download/${filename}" class="download-btn">Télécharger</a>
        </div>
    `;
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetAll() {
    stopFakeProgress(false);
    selectedFiles = [];
    renderFiles();
    progressBar.style.width = '0%';
    progressBar.classList.remove('done');
    elapsedTimer.textContent = '⏱ 0 s';
    progressFiles.textContent = '';

    uploadSection.style.display = 'block';
    processingSection.style.display = 'none';
    resultsSection.classList.remove('active');
}
