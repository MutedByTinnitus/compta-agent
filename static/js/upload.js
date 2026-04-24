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

// ── Results ───────────────────────────────────────────────────────────────────
function showResults(data) {
    processingSection.style.display = 'none';
    resultsSection.classList.add('active');

    const s = data.summary;

    // Résumé
    document.getElementById('resultSummary').textContent =
        `${s.total} justificatif(s) traité(s) · ${s.exploites} exploitable(s) · ${s.inexploites} rejeté(s)`;

    // Stats strip
    document.getElementById('stats').innerHTML = `
        <div class="res-stat-card">
            <div class="res-stat-label">Total</div>
            <div class="res-stat-value">${s.total}</div>
        </div>
        <div class="res-stat-card">
            <div class="res-stat-label">Exploités</div>
            <div class="res-stat-value" style="color: var(--forest)">${s.exploites}</div>
        </div>
        <div class="res-stat-card">
            <div class="res-stat-label">Rejetés</div>
            <div class="res-stat-value" style="color: ${s.inexploites > 0 ? 'var(--amber)' : 'var(--text)'}">${s.inexploites}</div>
        </div>
        <div class="res-stat-card">
            <div class="res-stat-label">Équilibre</div>
            <div class="res-stat-value" style="color: ${s.equilibre ? 'var(--forest)' : 'var(--rust)'}">${s.equilibre ? '✓' : '✗'}</div>
        </div>
    `;

    // Fichiers
    const dl = data.output_files;
    const rows = [];
    if (dl.excel) rows.push(fileRow(
        iconTableur(), 'var(--forest-soft)', 'var(--forest)',
        dl.excel.name, 'Écritures comptables au format Sage', dl.excel.name
    ));
    if (dl.stamped_pdf) rows.push(fileRow(
        iconDocCheck(), 'var(--accent-soft)', 'var(--accent)',
        dl.stamped_pdf.name, 'Justificatifs tamponnés, prêts pour archivage', dl.stamped_pdf.name
    ));
    if (dl.inexploitable_pdf) {
        const dim = s.inexploites === 0;
        rows.push(fileRow(
            iconDocAlert(), 'var(--amber-soft)', 'var(--amber)',
            dl.inexploitable_pdf.name,
            dim ? 'Aucun justificatif inexploitable dans ce lot' : `${s.inexploites} ticket(s) à vérifier dans ce lot`,
            dl.inexploitable_pdf.name, dim
        ));
    }
    document.getElementById('downloads').innerHTML = rows.join('');

    // Tableau
    const tbody = document.getElementById('detailBody');
    tbody.innerHTML = data.results_detail.map(r => {
        const libelle = r.status === 'exploitable'
            ? (r.ecritures && r.ecritures[0] ? r.ecritures[0].libelle : '-')
            : r.raison;
        return `<tr class="detail-row">
            <td>${r.filename}</td>
            <td><span class="res-badge ${r.status === 'exploitable' ? 'ok' : 'ko'}">${r.status === 'exploitable' ? 'OK' : 'Rejet'}</span></td>
            <td class="mono-cell">${r.reference || '-'}</td>
            <td>${libelle || '-'}</td>
        </tr>`;
    }).join('');
}

function fileRow(iconSvg, bgColor, fgColor, name, desc, filename, dim = false) {
    return `
        <div class="res-file-row${dim ? ' res-file-row--dim' : ''}">
            <div class="res-file-icon" style="background:${bgColor}; color:${fgColor}">${iconSvg}</div>
            <div class="res-file-info">
                <div class="res-file-name">${name}</div>
                <div class="res-file-desc">${desc}</div>
            </div>
            <a href="/api/download/${filename}" class="btn btn-ghost res-dl-btn">
                Télécharger
                <svg class="res-dl-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14m0 0-7-7m7 7-7 7"/>
                </svg>
            </a>
        </div>
    `;
}

// SVG icons
function iconTableur() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>`;
}
function iconDocCheck() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="m9 15 2 2 4-4"/>
    </svg>`;
}
function iconDocAlert() {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="12" y1="10" x2="12.01" y2="10"/>
    </svg>`;
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
