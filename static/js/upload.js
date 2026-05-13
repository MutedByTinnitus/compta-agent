/* upload.js — Kompta.ai dark dashboard
   Progression calée sur les phases réelles du backend */

// ── Tab navigation ─────────────────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.dk-tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.dk-nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
    if (tabId === 'corrections') onTabSwitchToReview();
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
    if (name.toLowerCase().endsWith('.zip')) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    }
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
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

        if (data.run_id) sessionStorage.setItem('lastRunId', data.run_id);

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
    const rv = data.review || {};

    document.getElementById('resultSummary').textContent =
        `${s.total} justificatif(s) traité(s) · ${s.exploites} exploitable(s) · ${s.inexploites} rejeté(s)`;

    // Bannière review si des tickets sont à valider ou à rescanner
    const existingBanner = document.getElementById('rv-banner');
    if (existingBanner) existingBanner.remove();
    if (rv.has_queue && (rv.count > 0 || rv.rescan_count > 0)) {
        const parts = [];
        if (rv.count > 0) parts.push(`<strong>${rv.count} douteux</strong>`);
        if (rv.rescan_count > 0) parts.push(`<strong>${rv.rescan_count} illisibles</strong>`);
        const banner = document.createElement('div');
        banner.id = 'rv-banner';
        banner.className = 'rv-notice-banner';
        banner.innerHTML = `
            <span class="rv-notice-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            </span>
            <span>${parts.join(', ')} nécessite${parts.length > 1 ? 'nt' : ''} une révision.</span>
            <button onclick="switchTab('corrections')" class="rv-notice-btn">Réviser maintenant</button>
        `;
        document.getElementById('resultSummary').after(banner);
    }

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

// ── Review Queue ───────────────────────────────────────────────────────────────
const rvState = {
    runId: null,
    queue: null,
    selectedId: null,
    activeSubtab: 'all',
};

function switchReviewSubtab(name) {
    rvState.activeSubtab = name;
    document.querySelectorAll('.rv-subtab').forEach(b =>
        b.classList.toggle('active', b.dataset.subtab === name)
    );
    document.querySelectorAll('.rv-subpanel').forEach(p => {
        p.style.display = p.id === 'subpanel-' + name ? '' : 'none';
    });
}

function onTabSwitchToReview() {
    const lastRunId = sessionStorage.getItem('lastRunId');
    if (lastRunId) {
        loadReviewQueue(lastRunId);
    } else {
        showReviewEmpty();
    }
}

async function loadReviewQueue(runId) {
    rvState.runId = runId;
    try {
        const res = await fetch(`/api/review/${runId}`);
        if (!res.ok) { showReviewEmpty(); return; }
        rvState.queue = await res.json();
        renderReviewQueue();
    } catch (e) {
        showReviewEmpty();
    }
}

function showReviewEmpty() {
    document.getElementById('review-empty').style.display = '';
    document.getElementById('review-queue').style.display = 'none';
}

function updateFinalizeBtnState() {
    const q = rvState.queue;
    if (!q) return;
    const pending = q.tickets.filter(t => t.review_status === 'pending').length;
    const btn = document.getElementById('btn-finalize');
    if (btn) btn.disabled = pending > 0;
}

function _ticketCard(ticket) {
    const sq = ticket.scan_quality || 'good';
    const badgeClass = sq === 'unreadable' ? 'rv-badge-unreadable' :
                       sq === 'doubtful'   ? 'rv-badge-doubtful' : 'rv-badge-good';
    const badgeLabel = sq === 'unreadable' ? 'Illisible' :
                       sq === 'doubtful'   ? 'Douteux' : 'OK';
    const imgSrc = ticket.review_image_path ? `/static/${ticket.review_image_path}` : '';
    const statusLabel = ticket.review_status === 'validated' ? ' · validé' :
                        ticket.review_status === 'ignored' ? ' · ignoré' :
                        ticket.review_status === 'duplicate' ? ' · duplicata' : '';
    const card = document.createElement('div');
    card.className = 'rv-ticket-card';
    card.innerHTML = `
        ${imgSrc ? `<img src="${imgSrc}" alt="Ticket" loading="lazy" />` : '<div style="aspect-ratio:3/4;background:var(--bg-2);border-radius:6px;"></div>'}
        <div class="rv-ticket-card-name">${ticket.fournisseur || '—'}${statusLabel}</div>
        <div class="rv-ticket-card-meta">
            <span>${ticket.date || '—'}</span>
            <span>${ticket.montant_ttc ? ticket.montant_ttc + ' €' : '?'}</span>
        </div>
        <span class="rv-ticket-card-badge ${badgeClass}">${badgeLabel}</span>
        ${ticket.scan_quality_reason ? `<div style="font-size:11px;color:var(--text-dim)">${ticket.scan_quality_reason}</div>` : ''}
    `;
    return card;
}

function renderReviewQueue() {
    const q = rvState.queue;
    const goodTickets   = q.good_tickets   || [];
    const doubtTickets  = q.tickets        || [];
    const rescanTickets = q.rescan_tickets || [];

    const total = goodTickets.length + doubtTickets.length + rescanTickets.length;
    if (total === 0) { showReviewEmpty(); return; }

    document.getElementById('review-empty').style.display = 'none';
    document.getElementById('review-queue').style.display = '';

    // Badges compteurs
    document.getElementById('badge-all').textContent = total;
    document.getElementById('badge-doubtful').textContent = doubtTickets.filter(t => t.review_status === 'pending').length;
    document.getElementById('badge-rescan').textContent = rescanTickets.length;

    // Badge nav sidebar
    const navBadge = document.getElementById('nav-badge-review');
    const actionCount = doubtTickets.filter(t => t.review_status === 'pending').length + rescanTickets.length;
    if (navBadge) {
        navBadge.textContent = actionCount;
        navBadge.style.display = actionCount > 0 ? '' : 'none';
    }

    // ── Grille "Tous les tickets" ──
    const allGrid = document.getElementById('rv-all-grid');
    allGrid.innerHTML = '';
    [...goodTickets, ...doubtTickets, ...rescanTickets].forEach(t => allGrid.appendChild(_ticketCard(t)));

    // ── Liste "À valider" ──
    updateFinalizeBtnState();
    const list = document.getElementById('rv-list');
    list.innerHTML = '';
    doubtTickets.forEach(ticket => {
        const item = document.createElement('div');
        item.className = 'rv-list-item' + (ticket.ticket_id === rvState.selectedId ? ' active' : '');
        item.dataset.ticketId = ticket.ticket_id;

        const reasons = (ticket.review_reasons || []).slice(0, 2).join(' · ');
        const statusLabel = ticket.review_status === 'pending' ? '' :
            `<div class="rv-item-status ${ticket.review_status}">${ticket.review_status}</div>`;

        item.innerHTML = `
            <div class="rv-item-summary">
                ${ticket.fournisseur || '—'} · ${ticket.montant_ttc ? ticket.montant_ttc + ' €' : '?'}
                ${ticket.date ? '· ' + ticket.date : ''}
            </div>
            <div class="rv-item-reasons">${reasons}</div>
            ${statusLabel}
        `;
        item.addEventListener('click', () => selectReviewTicket(ticket.ticket_id));
        list.appendChild(item);
    });

    const pending = doubtTickets.filter(t => t.review_status === 'pending');
    if (!rvState.selectedId && pending.length > 0) {
        selectReviewTicket(pending[0].ticket_id);
    }

    // ── Grille "À rescanner" ──
    const rescanGrid = document.getElementById('rv-rescan-grid');
    rescanGrid.innerHTML = '';
    rescanTickets.forEach(t => rescanGrid.appendChild(_ticketCard(t)));

    const dlBtn = document.getElementById('btn-download-rescan');
    if (dlBtn) {
        dlBtn.href = q.rescan_pdf ? `/api/rescan-pdf/${rvState.runId}` : '#';
        dlBtn.style.opacity = q.rescan_pdf ? '1' : '0.4';
        dlBtn.style.pointerEvents = q.rescan_pdf ? '' : 'none';
    }

    // Switcher vers le bon sous-onglet par défaut selon les données
    switchReviewSubtab(rvState.activeSubtab);
}

function selectReviewTicket(ticketId) {
    rvState.selectedId = ticketId;
    const ticket = rvState.queue && rvState.queue.tickets.find(t => t.ticket_id === ticketId);
    if (!ticket) return;

    document.querySelectorAll('.rv-list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.ticketId === ticketId);
    });

    const img = document.getElementById('rv-image');
    img.src = ticket.review_image_path ? `/static/${ticket.review_image_path}` : '';

    document.getElementById('rv-date').value = ticket.date || '';
    document.getElementById('rv-fournisseur').value = ticket.fournisseur || '';
    document.getElementById('rv-ttc').value = ticket.montant_ttc || '';
    document.getElementById('rv-ht').value = ticket.montant_ht || '';
    document.getElementById('rv-tva').value = ticket.montant_tva || '';
    document.getElementById('rv-mode').value = ticket.mode_paiement || 'CB';
    document.getElementById('rv-categorie').value = ticket.type || '';

    const sqReason = ticket.scan_quality_reason;
    const sqLabel  = ticket.scan_quality ? ticket.scan_quality.toUpperCase() : 'REVIEW';
    const fallbackReasons = (ticket.review_reasons || []).join(' · ');
    document.getElementById('rv-reasons').textContent = sqReason
        ? `${sqLabel}: ${sqReason}`
        : (fallbackReasons || 'Vérification recommandée');
}

async function rvPatchTicket(action, extraFields) {
    const ticketId = rvState.selectedId;
    if (!ticketId || !rvState.runId) return;

    const body = { action };
    if (extraFields) body.fields = extraFields;

    await fetch(`/api/review/${rvState.runId}/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
        body: JSON.stringify(body),
    });

    rvState.selectedId = null;
    await loadReviewQueue(rvState.runId);
}

document.getElementById('btn-rv-validate').addEventListener('click', () => {
    rvPatchTicket('validate', {
        date: document.getElementById('rv-date').value,
        fournisseur: document.getElementById('rv-fournisseur').value,
        montant_ttc: parseFloat(document.getElementById('rv-ttc').value) || 0,
        montant_ht: parseFloat(document.getElementById('rv-ht').value) || 0,
        montant_tva: parseFloat(document.getElementById('rv-tva').value) || 0,
        mode_paiement: document.getElementById('rv-mode').value,
        type: document.getElementById('rv-categorie').value,
    });
});

document.getElementById('btn-rv-ignore').addEventListener('click', () => rvPatchTicket('ignore'));
document.getElementById('btn-rv-duplicate').addEventListener('click', () => rvPatchTicket('duplicate'));

document.getElementById('btn-ignore-duplicates').addEventListener('click', async () => {
    if (!rvState.runId) return;
    const res = await fetch(`/api/review/${rvState.runId}/ignore-duplicates`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': CSRF_TOKEN },
    });
    const data = await res.json();
    if (data.ignored_count > 0) {
        rvState.selectedId = null;
        await loadReviewQueue(rvState.runId);
    }
});

document.getElementById('btn-finalize').addEventListener('click', async () => {
    if (!rvState.runId) return;
    const res = await fetch(`/api/review/${rvState.runId}/finalize`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': CSRF_TOKEN },
    });
    const data = await res.json();
    if (data.ok && data.excel_url) {
        window.location.href = data.excel_url;
    }
});

// ── Lightbox ───────────────────────────────────────────────────────────────────
(function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    if (!lightbox || !lightboxImg) return;

    function open(src) {
        lightboxImg.src = src;
        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        lightbox.classList.add('hidden');
        lightboxImg.src = '';
        document.body.style.overflow = '';
    }

    document.addEventListener('click', e => {
        const img = e.target.closest('.rv-image-wrap img, .rv-ticket-card img');
        if (img && img.src) open(img.src);
    });

    lightboxClose.addEventListener('click', close);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) close();
    });
})();

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
