/* upload.js — Kompta.ai dark dashboard
   Progression calée sur les phases réelles du backend */

// ── Tab navigation ─────────────────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.dk-tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.dk-nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
}

// ── DOM refs ───────────────────────────────────────────────────────────────────
const dropzone    = document.getElementById('dropzone');
const fileInput   = document.getElementById('fileInput');
const fileList    = document.getElementById('fileList');
const fileCard    = document.getElementById('fileCard');
const fileCount   = document.getElementById('fileCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const processBtn  = document.getElementById('processBtn');

const uploadState     = document.getElementById('dk-upload-state');
const processingState = document.getElementById('dk-processing-state');
const resultsState    = document.getElementById('dk-results-state');

const progressBar   = document.getElementById('progressBar');
const elapsedTimer  = document.getElementById('elapsedTimer');
const progressFiles = document.getElementById('progressFiles');

// ── State ──────────────────────────────────────────────────────────────────────
let selectedFiles    = [];
let timerInterval    = null;
let progressInterval = null;
let startTime        = null;

// ── Drag & Drop ────────────────────────────────────────────────────────────────
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

// ── File management ────────────────────────────────────────────────────────────
function addFiles(files) {
    files.forEach(f => {
        if (!selectedFiles.find(s => s.name === f.name)) selectedFiles.push(f);
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
        <div class="dk-file-row">
            <span class="dk-file-icon">${fileIcon(f.name)}</span>
            <span class="dk-file-name">${f.name}</span>
            <span class="dk-file-size">${formatSize(f.size)}</span>
            <button class="dk-file-remove" onclick="removeFile(${i})" title="Retirer">×</button>
        </div>
    `).join('');
    processBtn.disabled = false;
}

clearAllBtn.addEventListener('click', clearAll);

// ── Progression réelle calée sur le backend ────────────────────────────────────
/*
  Backend phases (durées typiques) :
  1. upload / split      :  2-8s    (5% du temps)
  2. render PNG 300dpi   :  3-10s   (10% du temps)
  3. AI Vision (×4 par)  : 15-120s  (65% du temps — le plus long)
  4. filtre + dedup      :  2-5s    (10% du temps)
  5. export Excel+PDF    :  3-10s   (10% du temps)

  Estimation de la durée totale selon le nombre de fichiers.
  On estime ~20s/page pour l'IA (median observé avec cache OFF).
*/

const STEP_IDS = ['step-upload', 'step-render', 'step-ai', 'step-filter', 'step-export'];

// % de progression cumulé à la fin de chaque étape (0-100)
const STEP_THRESHOLDS = [8, 18, 82, 92, 100];

// Labels détail dynamiques pendant l'étape active
const STEP_DETAILS_ACTIVE = [
    'Validation PDF, extraction des pages…',
    'Conversion PDF → PNG 300 DPI…',
    'Modèle IA en lecture…',
    'Contrôle qualité, détection des doublons…',
    'Génération Excel Sage, assemblage PDF…',
];

// Labels après complétion
const STEP_DETAILS_DONE = [
    null, // garder le défaut HTML
    null,
    null,
    null,
    null,
];

let stepStartTimes = [null, null, null, null, null];
let currentStep    = -1;
let estimatedTotal = 60; // secondes, recalculé au démarrage

function estimateDuration(fileCount) {
    // ~20s par fichier pour l'IA + ~15s overhead fixe
    return Math.max(30, fileCount * 20 + 15);
}

function setStepState(idx, state /* 'waiting'|'active'|'done' */) {
    const row  = document.getElementById(STEP_IDS[idx]);
    if (!row) return;
    const icon = row.querySelector('.dk-step-icon');

    row.className = 'dk-step ' + state;
    icon.className = 'dk-step-icon ' + state;

    if (state === 'active') {
        const detEl = row.querySelector('.dk-step-detail');
        if (detEl) detEl.textContent = STEP_DETAILS_ACTIVE[idx];
        stepStartTimes[idx] = Date.now();
    }

    if (state === 'done') {
        const timeEl = document.getElementById('time-' + STEP_IDS[idx].replace('step-', ''));
        if (timeEl && stepStartTimes[idx]) {
            const dur = ((Date.now() - stepStartTimes[idx]) / 1000).toFixed(0);
            timeEl.textContent = dur + ' s';
        }
    }
}

function advanceToStep(idx) {
    if (idx === currentStep) return;

    // Marquer les précédents comme done
    for (let i = 0; i < idx; i++) {
        if (i !== currentStep) setStepState(i, 'done');
    }

    // Terminer le step courant
    if (currentStep >= 0 && currentStep < idx) {
        setStepState(currentStep, 'done');
    }

    // Activer le nouveau
    setStepState(idx, 'active');
    currentStep = idx;
}

function initSteps() {
    currentStep = -1;
    stepStartTimes = [null, null, null, null, null];
    STEP_IDS.forEach((_, i) => setStepState(i, 'waiting'));
}

function allStepsDone() {
    STEP_IDS.forEach((_, i) => setStepState(i, 'done'));
    currentStep = STEP_IDS.length;
}

// ── Progress helpers ───────────────────────────────────────────────────────────
function startProgress() {
    startTime     = Date.now();
    estimatedTotal = estimateDuration(selectedFiles.length);
    initSteps();

    // Tick
    timerInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const m  = Math.floor(elapsed / 60);
        const ss = Math.floor(elapsed % 60).toString().padStart(2, '0');
        elapsedTimer.textContent = m > 0 ? `${m}:${ss}` : `${Math.floor(elapsed)} s`;

        // Avancement proportionnel des étapes selon le temps écoulé
        const pct = Math.min((elapsed / estimatedTotal) * 100, 99);

        // Déterminer quelle étape est en cours selon le % global
        let targetStep = 0;
        for (let i = 0; i < STEP_THRESHOLDS.length; i++) {
            if (pct >= STEP_THRESHOLDS[i]) targetStep = i + 1;
            else break;
        }
        // Ne pas dépasser la dernière (on finit manuellement)
        targetStep = Math.min(targetStep, STEP_IDS.length - 1);
        advanceToStep(targetStep);

        // Barre : avance jusqu'à 95% max tant que pas terminé
        progressBar.style.width = Math.min(pct, 95) + '%';
    }, 500);
}

function stopProgress(success) {
    clearInterval(timerInterval);
    timerInterval = null;

    if (success) {
        allStepsDone();
        progressBar.style.width = '100%';
        progressBar.classList.add('done');
    }
}

function showProcessing() {
    const names = selectedFiles.map(f => f.name).join(' · ');
    progressFiles.textContent = names;
    progressBar.style.width = '0%';
    progressBar.classList.remove('done');
    elapsedTimer.textContent = '0 s';

    uploadState.style.display     = 'none';
    processingState.style.display = 'block';
    resultsState.style.display    = 'none';

    startProgress();
}

// ── Process ────────────────────────────────────────────────────────────────────
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
        stopProgress(true);

        // Laisser la barre à 100% une demi-seconde avant le switch
        await new Promise(r => setTimeout(r, 500));

        if (data.error) {
            alert('Erreur : ' + data.error);
            resetAll();
            return;
        }

        showResults(data);

    } catch (err) {
        stopProgress(false);
        alert('Erreur de connexion : ' + err.message);
        resetAll();
    }
});

// ── Results ────────────────────────────────────────────────────────────────────
function showResults(data) {
    processingState.style.display = 'none';
    resultsState.style.display    = 'block';

    const s = data.summary;

    document.getElementById('resultSummary').textContent =
        `${s.total} justificatif(s) traité(s) · ${s.exploites} exploitable(s) · ${s.inexploites} rejeté(s)`;

    // Stats grid
    document.getElementById('stats').innerHTML = `
        <div class="dk-stat-card">
            <div class="dk-stat-label">Total</div>
            <div class="dk-stat-value">${s.total}</div>
        </div>
        <div class="dk-stat-card">
            <div class="dk-stat-label">Exploités</div>
            <div class="dk-stat-value" style="color:var(--dk-green)">${s.exploites}</div>
        </div>
        <div class="dk-stat-card">
            <div class="dk-stat-label">Rejetés</div>
            <div class="dk-stat-value" style="color:${s.inexploites > 0 ? 'var(--dk-amber)' : 'var(--dk-text)'}">${s.inexploites}</div>
        </div>
        <div class="dk-stat-card">
            <div class="dk-stat-label">Équilibre</div>
            <div class="dk-stat-value" style="color:${s.equilibre ? 'var(--dk-green)' : 'var(--dk-rust)'}">${s.equilibre ? '✓' : '✗'}</div>
        </div>
    `;

    // Download files
    const dl = data.output_files;
    const rows = [];
    if (dl.excel) rows.push(dlRow(
        iconTableur(), 'rgba(61,217,168,0.1)', 'var(--dk-green)',
        dl.excel.name, 'Écritures comptables au format Sage', dl.excel.name
    ));
    if (dl.stamped_pdf) rows.push(dlRow(
        iconDocCheck(), 'rgba(61,217,168,0.06)', 'var(--dk-text-dim)',
        dl.stamped_pdf.name, 'Justificatifs tamponnés, prêts pour archivage', dl.stamped_pdf.name
    ));
    if (dl.inexploitable_pdf) {
        const dim = s.inexploites === 0;
        rows.push(dlRow(
            iconDocAlert(), 'var(--dk-amber-soft)', 'var(--dk-amber)',
            dl.inexploitable_pdf.name,
            dim ? 'Aucun justificatif inexploitable dans ce lot' : `${s.inexploites} ticket(s) à vérifier`,
            dl.inexploitable_pdf.name, dim
        ));
    }
    document.getElementById('downloads').innerHTML = rows.join('');

    // Detail table
    document.getElementById('detailBody').innerHTML = data.results_detail.map(r => {
        const libelle = r.status === 'exploitable'
            ? (r.ecritures && r.ecritures[0] ? r.ecritures[0].libelle : '-')
            : r.raison;
        return `<tr>
            <td>${r.filename}</td>
            <td><span class="${r.status === 'exploitable' ? 'dk-badge-ok' : 'dk-badge-ko'}">${r.status === 'exploitable' ? 'OK' : 'Rejet'}</span></td>
            <td class="dk-mono">${r.reference || '-'}</td>
            <td>${libelle || '-'}</td>
        </tr>`;
    }).join('');
}

function dlRow(iconSvg, bgColor, fgColor, name, desc, filename, dim = false) {
    return `
        <div class="dk-file-dl-row${dim ? ' dim' : ''}">
            <div class="dk-file-dl-icon" style="background:${bgColor}; color:${fgColor}">${iconSvg}</div>
            <div class="dk-file-dl-info">
                <div class="dk-file-dl-name">${name}</div>
                <div class="dk-file-dl-desc">${desc}</div>
            </div>
            <a href="/api/download/${filename}" class="dk-dl-btn">
                Télécharger
                <svg class="dk-dl-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14m0 0-7-7m7 7-7 7"/>
                </svg>
            </a>
        </div>
    `;
}

// SVG icons
function iconTableur() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M3 15h18M9 3v18"/>
    </svg>`;
}
function iconDocCheck() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="m9 15 2 2 4-4"/>
    </svg>`;
}
function iconDocAlert() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="12" y1="10" x2="12.01" y2="10"/>
    </svg>`;
}

// ── Reset ──────────────────────────────────────────────────────────────────────
function resetAll() {
    stopProgress(false);
    selectedFiles = [];
    renderFiles();
    progressBar.style.width = '0%';
    progressBar.classList.remove('done');
    elapsedTimer.textContent = '0 s';
    progressFiles.textContent = '—';
    initSteps();

    uploadState.style.display     = 'block';
    processingState.style.display = 'none';
    resultsState.style.display    = 'none';
}
