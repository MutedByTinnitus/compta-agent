// app/Ocr.jsx — Agent Saisie 3-step flow: Upload → Validation → Export

const STEPS_OCR = ['Upload', 'Validation', 'Export'];

// ─── Ticket preview (DEPRECATED — kept for demo, unused in production) ─
const TicketPreview = ({ ticket, ocrCase, fileUrl }) => {
  const blur = ocrCase === 'fail';
  return (
    <div style={{
      background: 'var(--app-card-hi)',
      borderRadius: 'var(--radius-lg)',
      padding: 28,
      border: '1px solid var(--app-line)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      minHeight: 480,
    }}>
      {fileUrl ? (
        /* User-uploaded image */
        <div style={{
          width: '100%', maxWidth: 280,
          padding: 8, background: '#FBF9F4',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          transform: 'rotate(-1.5deg)',
          filter: blur ? 'blur(3px) brightness(.85)' : 'none',
        }}>
          <img src={fileUrl} alt="Ticket"
               style={{ width: '100%', display: 'block', maxHeight: 380, objectFit: 'contain' }}/>
        </div>
      ) : (
        /* Synthetic paper receipt for demo */
        <div style={{
          width: 240, padding: '20px 18px',
          background: '#FBF9F4',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: '#222',
          transform: 'rotate(-1.5deg)',
          position: 'relative',
          filter: blur ? 'blur(3px) brightness(.85)' : 'none',
        }}>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            {ticket.vendor}
          </div>
          <div style={{ textAlign: 'center', fontSize: 9, marginBottom: 12, color: '#666' }}>
            14 RUE DE RIVOLI · 75001 PARIS<br/>SIRET 442 193 856 00014
          </div>
          <div style={{ borderTop: '1px dashed #999', paddingTop: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span>Date :</span><span>{ticket.date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Heure :</span><span>14:32</span>
            </div>
          </div>
          {ocrCase === 'high' && (
            <div style={{ borderTop: '1px dashed #999', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Cartouches encre x2</span><span>52,00</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Ramettes A4 x4</span><span>32,00</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Stylos lot/10</span><span>20,00</span></div>
            </div>
          )}
          {ocrCase === 'doubtful' && (
            <div style={{ borderTop: '1px dashed #999', paddingTop: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Menu déjeuner x3</span><span>54,00</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Café x3</span><span>7,36</span></div>
            </div>
          )}
          <div style={{ borderTop: '1px solid #333', paddingTop: 6, fontWeight: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>HT</span><span>{ticket.ht.toFixed(2)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TVA {ocrCase === 'doubtful' ? '10%' : '20%'}</span><span>{ticket.ttva.toFixed(2)} €</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span>TOTAL TTC</span><span>{ticket.total.toFixed(2)} €</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 9, marginTop: 14, color: '#999' }}>
            MERCI DE VOTRE VISITE
          </div>
          {ocrCase === 'doubtful' && (
            <div style={{ position: 'absolute', top: 80, right: -8,
                          background: 'rgba(240,180,41,0.95)', color: '#1a1500',
                          padding: '2px 6px', fontSize: 9, fontWeight: 700, borderRadius: 2,
                          transform: 'rotate(8deg)' }}>TVA peu lisible</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button className="app-btn app-btn-secondary app-btn-sm"><I.Zoom size={12}/> Zoom</button>
        <button className="app-btn app-btn-secondary app-btn-sm"><I.Camera size={12}/> Re-scanner</button>
      </div>
    </div>
  );
};

// ─── Step 1: Upload ────────────────────────────────────────────────
const OcrUpload = ({ onNext, file, setFile, setRunResult }) => {
  const [drag, setDrag] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState({ percent: 0, step: 'upload', detail: '' });
  const [error, setError] = React.useState(null);
  const [clients, setClients] = React.useState([]);
  const [clientId, setClientId] = React.useState('');
  const [dossiers, setDossiers] = React.useState([]);
  const [dossierId, setDossierId] = React.useState('');
  const inputRef = React.useRef(null);

  // Charger les clients de l'org pour le sélecteur
  React.useEffect(() => {
    fetch('/api/clients', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setClients(d.clients || []); })
      .catch(() => {});
  }, []);

  // Quand on change de client, charger ses dossiers
  React.useEffect(() => {
    setDossierId('');
    if (!clientId) { setDossiers([]); return; }
    fetch(`/api/dossiers?client_id=${encodeURIComponent(clientId)}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDossiers(d.dossiers || []); })
      .catch(() => setDossiers([]));
  }, [clientId]);

  const handleFiles = (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
    setFile({ name: f.name, size: `${(f.size / 1024 / 1024).toFixed(1)} MB`, url, raw: f });
    setError(null);
  };

  const analyzeFile = async () => {
    if (!file?.raw) { setError("Aucun fichier sélectionné."); return; }
    setProcessing(true);
    setError(null);
    setProgress({ percent: 0, step: 'upload', detail: 'Démarrage…' });

    try {
      const fd = new FormData();
      fd.append('files', file.raw);
      if (clientId) fd.append('client_id', clientId);
      if (dossierId) fd.append('dossier_id', dossierId);
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      fd.append('csrf_token', csrf);

      const resp = await fetch('/api/process', {
        method: 'POST', body: fd, credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        let msg = `Erreur ${resp.status}`;
        try { msg = JSON.parse(txt).error || msg; } catch {}
        throw new Error(msg);
      }
      const { job_id } = await resp.json();
      if (!job_id) throw new Error("Réponse invalide du serveur (job_id manquant).");

      const finalResult = await pollJob(job_id, (p) => setProgress(p));
      setRunResult(finalResult);
      setProcessing(false);
      onNext();
    } catch (err) {
      console.error('[OCR upload]', err);
      setProcessing(false);
      setError(err.message || 'Erreur inconnue');
    }
  };

  return (
    <div className="app-page" style={{ maxWidth: 1080 }}>
      <PageHeader
        kicker="Agent Saisie"
        title="Nouvelle saisie"
        subtitle="Scannez un ticket ou une facture. L'agent extrait les montants et génère les écritures comptables, prêtes à exporter."
      />
      <Steps steps={STEPS_OCR} current={0} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 28 }}>
        <div>
          <div className={`app-dropzone ${drag ? 'is-drag' : ''}`}
               onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
               onDragLeave={() => setDrag(false)}
               onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
               onClick={() => inputRef.current?.click()}>
            <input ref={inputRef} type="file" accept="image/*,.pdf,.zip" hidden
                   onChange={(e) => handleFiles(e.target.files)} />
            <div style={{
              width: 56, height: 56, margin: '0 auto 16px', borderRadius: 12,
              background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
            }}><I.Camera size={24} /></div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Déposez vos tickets ici</div>
            <div className="meta" style={{ marginBottom: 14 }}>
              ou <span style={{ color: 'var(--accent)', fontWeight: 500 }}>cliquez pour parcourir</span>
            </div>
            <div className="caption">PDF · ZIP de PDFs · max 10 MB par fichier</div>
          </div>

          {file && (
            <div className="app-card" style={{ marginTop: 12, padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', gap: 12 }}>
              <I.File size={22} stroke="var(--accent)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div className="caption">{file.size} · prêt à analyser</div>
              </div>
              <span className="app-badge app-badge-ok"><I.Check size={10} sw={3}/> Prêt</span>
              <button className="app-btn app-btn-ghost app-btn-sm" onClick={() => setFile(null)} title="Retirer">
                <I.X size={13} />
              </button>
            </div>
          )}

          {error && (
            <div className="app-alert app-alert-danger" style={{ marginTop: 12 }}>
              <I.AlertCircle size={17} className="app-alert-icon"/>
              <div>
                <div className="app-alert-title">Erreur</div>
                <div className="app-alert-msg">{error}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}><TrustBanner /></div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button className="app-btn app-btn-ghost" onClick={() => window.appNavigate?.('dashboard')}>
              ← Retour au tableau de bord
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="app-btn app-btn-secondary" onClick={() => setFile(null)}>Annuler</button>
              <button className={`app-btn app-btn-primary ${!file ? 'app-btn-disabled' : ''}`}
                      disabled={!file || processing} onClick={analyzeFile}>
                <I.Sparkle size={13}/> Analyser
                <I.ArrowRight size={13}/>
              </button>
            </div>
          </div>
        </div>

        <div>
          {clients.length > 0 && (
            <div className="app-card app-card-body" style={{ marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Rattacher ce run (optionnel)</div>
              <div className="caption" style={{ marginBottom: 10 }}>
                Lier à un client et un exercice pour l'organiser dans l'historique.
              </div>

              <span className="caption" style={{ fontSize: 11 }}>Client</span>
              <select value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        marginTop: 4, marginBottom: 10,
                        padding: '9px 12px',
                        background: 'var(--app-card-hi)',
                        border: '1px solid var(--app-line)',
                        borderRadius: 6, color: 'var(--text)',
                        fontFamily: 'inherit', fontSize: 13, outline: 'none',
                      }}>
                <option value="">— Non classé —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.siren ? ` (${c.siren})` : ''}
                  </option>
                ))}
              </select>

              {clientId && (
                <>
                  <span className="caption" style={{ fontSize: 11 }}>Dossier</span>
                  <select value={dossierId}
                          onChange={(e) => setDossierId(e.target.value)}
                          disabled={dossiers.length === 0}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            marginTop: 4,
                            padding: '9px 12px',
                            background: 'var(--app-card-hi)',
                            border: '1px solid var(--app-line)',
                            borderRadius: 6, color: 'var(--text)',
                            fontFamily: 'inherit', fontSize: 13, outline: 'none',
                            opacity: dossiers.length === 0 ? 0.5 : 1,
                          }}>
                    {dossiers.length === 0 ? (
                      <option value="">— Aucun dossier pour ce client —</option>
                    ) : (
                      <>
                        <option value="">— Aucun (non rattaché) —</option>
                        {dossiers.map(d => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </>
                    )}
                  </select>
                </>
              )}
            </div>
          )}

          <div className="app-card app-card-body">
            <div className="label" style={{ marginBottom: 12 }}>Guide de prise de vue</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { num: 1, title: 'Lumière directe',    sub: "Pas d'ombre sur le ticket" },
                { num: 2, title: 'Ticket à plat',      sub: 'Sans pli, ni ondulation' },
                { num: 3, title: 'Cadrage serré',      sub: 'Le ticket remplit la vue' },
              ].map(g => (
                <div key={g.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    border: '1px solid var(--accent-line)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 11, flexShrink: 0,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{g.num}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.title}</div>
                    <div className="caption" style={{ marginTop: 1 }}>{g.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {processing && <ProcessingOverlay progress={progress} />}
    </div>
  );
};

// ─── Polling helper ────────────────────────────────────────────────
async function pollJob(jobId, onProgress) {
  const POLL_MS = 2000;
  const MAX_DURATION = 15 * 60 * 1000;
  const start = Date.now();
  while (true) {
    if (Date.now() - start > MAX_DURATION) throw new Error('Timeout : analyse > 15 min');
    let resp;
    try { resp = await fetch(`/api/jobs/${jobId}`, { credentials: 'same-origin' }); }
    catch (e) { await sleep(POLL_MS); continue; }
    if (!resp.ok) {
      if (resp.status === 404) throw new Error('Job introuvable');
      await sleep(POLL_MS); continue;
    }
    const data = await resp.json();
    onProgress({ percent: data.progress || 0, step: data.step || '', detail: data.detail || '' });
    if (data.status === 'done') return data.result;
    if (data.status === 'failed') throw new Error(data.error || "Échec côté serveur");
    await sleep(POLL_MS);
  }
}
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// ─── Progress modal ────────────────────────────────────────────────
const ProcessingOverlay = ({ progress }) => {
  const stepLabel = {
    upload: 'Réception du fichier',
    render: 'Rendu des pages',
    ai: 'Extraction IA des tickets',
    filter: 'Validation et déduplication',
    export: 'Génération des fichiers',
  }[progress.step] || 'Analyse en cours';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(8,18,22,0.88)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--app-card-hi, #0f1f1d)', border: '1px solid var(--app-line)',
        borderRadius: 16, padding: 36, maxWidth: 480, width: '90%',
      }}>
        <div className="kicker" style={{ color: 'var(--accent)' }}>EN COURS</div>
        <h3 style={{
          fontFamily: "'Lora', Georgia, serif", fontSize: 26, margin: '6px 0 22px',
          color: 'var(--text)', fontWeight: 500,
        }}>
          {stepLabel}
        </h3>
        <div style={{
          height: 6, background: 'var(--app-line)', borderRadius: 999,
          overflow: 'hidden', marginBottom: 14,
        }}>
          <div style={{
            height: '100%', background: 'var(--accent)',
            width: `${Math.max(2, progress.percent || 0)}%`,
            transition: 'width 0.4s ease',
          }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 22,
            color: 'var(--accent)', fontWeight: 500,
          }}>
            {progress.percent || 0}%
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'right', maxWidth: 280 }}>
            {progress.detail}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Step 2: Validation ────────────────────────────────────────────
const OcrValidation = ({ onNext, onBack, runResult }) => {
  const runId = runResult?.run_id;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selected, setSelected] = React.useState(null); // ticket_id of doubtful selected
  const [tab, setTab] = React.useState('doubtful'); // doubtful | good | unreadable

  const fetchQueue = React.useCallback(async () => {
    if (!runId) { setLoading(false); return; }
    try {
      const r = await fetch(`/api/review/${runId}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j);
      const firstPending = (j.tickets || []).find(t => (t.review_status || 'pending') === 'pending');
      setSelected(prev => prev || firstPending?.ticket_id || (j.tickets?.[0]?.ticket_id) || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  React.useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Reset selection when changing tab — must be before any early return (hook rules)
  React.useEffect(() => { setSelected(null); }, [tab]);

  if (!runId) {
    return (
      <div className="app-page" style={{ maxWidth: 800 }}>
        <div className="app-alert app-alert-warn">
          <I.Alert size={17} className="app-alert-icon"/>
          <div>
            <div className="app-alert-title">Aucun run en cours</div>
            <div className="app-alert-msg">Lance d'abord une analyse depuis l'écran Upload.</div>
          </div>
        </div>
        <button className="app-btn app-btn-primary" style={{ marginTop: 14 }} onClick={onBack}>
          <I.ChevronLeft size={13}/> Retour à l'upload
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-page" style={{ maxWidth: 800, textAlign: 'center', padding: '60px 20px' }}>
        <div className="caption">Chargement de la file de validation…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page" style={{ maxWidth: 800 }}>
        <div className="app-alert app-alert-danger">
          <I.AlertCircle size={17} className="app-alert-icon"/>
          <div>
            <div className="app-alert-title">Impossible de charger les tickets</div>
            <div className="app-alert-msg">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const doubtful = data?.tickets || [];
  const good = data?.good_tickets || [];
  const unreadable = data?.rescan_tickets || [];

  const counts = {
    doubtful: doubtful.filter(t => (t.review_status || 'pending') === 'pending').length,
    good: good.length,
    unreadable: unreadable.length,
  };

  const ticketsForTab = tab === 'doubtful' ? doubtful : tab === 'good' ? good : unreadable;
  const selectedTicket = (tab === 'doubtful' ? doubtful : tab === 'good' ? good : unreadable)
    .find(t => t.ticket_id === selected) || ticketsForTab[0] || null;

  const onUpdated = () => fetchQueue();

  const allDone = counts.doubtful === 0;

  const reopened = !!runResult?._reopened;
  const dbRunId = runResult?.db_run_id;

  const downloadExcel = () => {
    if (!dbRunId) return;
    // On va chercher excel_path via /api/runs/<id>
    fetch(`/api/runs/${dbRunId}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.excel_path) window.location.href = `/api/download/${d.excel_path}`;
        else alert("Aucun Excel disponible pour ce run. Lancez d'abord l'export.");
      });
  };
  const downloadRescan = () => {
    if (runId) window.location.href = `/api/rescan-pdf/${runId}`;
  };

  return (
    <div className="app-page-wide" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        kicker={reopened ? 'Historique · saisie rouverte' : 'Agent Saisie'}
        title={reopened ? 'Détail du run' : 'Validation des tickets'}
        subtitle={`Saisie #${runId.slice(0, 12)} · ${good.length} auto-validés · ${doubtful.length} à revoir · ${unreadable.length} illisibles`}
        actions={reopened ? (
          <>
            <button className="app-btn app-btn-secondary" onClick={downloadExcel}>
              <I.Download size={13}/> Excel
            </button>
            {unreadable.length > 0 && (
              <button className="app-btn app-btn-secondary" onClick={downloadRescan}>
                <I.Download size={13}/> PDF rescan
              </button>
            )}
          </>
        ) : null}
      />
      {!reopened && <Steps steps={STEPS_OCR} current={1} />}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginTop: 22, borderBottom: '1px solid var(--app-line)' }}>
        <TabBtn active={tab === 'doubtful'} onClick={() => setTab('doubtful')}
                label="À vérifier" count={counts.doubtful} tone="warn" />
        <TabBtn active={tab === 'good'} onClick={() => setTab('good')}
                label="Auto-validés" count={counts.good} tone="ok" />
        <TabBtn active={tab === 'unreadable'} onClick={() => setTab('unreadable')}
                label="Illisibles" count={counts.unreadable} tone="danger" />
      </div>

      {ticketsForTab.length === 0 ? (
        <div className="app-card app-card-body" style={{ marginTop: 20, textAlign: 'center', padding: 40 }}>
          <div className="caption">Aucun ticket dans cette catégorie.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, marginTop: 20 }}>
          {/* Sidebar liste tickets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 700, overflowY: 'auto' }}>
            {ticketsForTab.map(t => (
              <TicketListItem key={t.ticket_id}
                              ticket={t}
                              selected={selectedTicket?.ticket_id === t.ticket_id}
                              onClick={() => setSelected(t.ticket_id)} />
            ))}
          </div>

          {/* Panneau détail */}
          <div>
            {selectedTicket && (
              <TicketDetail key={selectedTicket.ticket_id}
                            ticket={selectedTicket}
                            runId={runId}
                            mode={tab}
                            onUpdated={onUpdated} />
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button className="app-btn app-btn-secondary" onClick={onBack}>
          <I.ChevronLeft size={13}/> Retour
        </button>
        {reopened ? (
          <button className="app-btn app-btn-primary"
                  disabled={!allDone}
                  onClick={onNext}
                  title={allDone ? 'Régénérer un Excel à partir des validations actuelles' : 'Traitez tous les tickets douteux d\'abord'}>
            {allDone ? 'Régénérer l\'export' : `${counts.doubtful} ticket${counts.doubtful > 1 ? 's' : ''} à traiter`} <I.ArrowRight size={13}/>
          </button>
        ) : (
          <button className={`app-btn app-btn-primary ${!allDone ? 'app-btn-disabled' : ''}`}
                  disabled={!allDone}
                  onClick={onNext}
                  title={allDone ? '' : 'Traitez tous les tickets douteux avant export'}>
            {allDone ? 'Valider et exporter' : `${counts.doubtful} ticket${counts.doubtful > 1 ? 's' : ''} à traiter`} <I.ArrowRight size={13}/>
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Validation sub-components ─────────────────────────────────────
const TabBtn = ({ active, onClick, label, count, tone }) => (
  <button onClick={onClick} style={{
    appearance: 'none', background: 'transparent', cursor: 'pointer',
    border: 'none', borderBottom: '2px solid ' + (active ? 'var(--accent)' : 'transparent'),
    padding: '10px 16px', color: active ? 'var(--text)' : 'var(--text-dim)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: 8,
  }}>
    {label}
    <span className={`app-badge app-badge-${tone}`} style={{ minWidth: 22 }}>{count}</span>
  </button>
);

const TicketListItem = ({ ticket, selected, onClick }) => {
  const status = ticket.review_status || 'pending';
  const reasons = ticket.review_reasons || [];
  const imgPath = ticket.review_image_path;
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', textAlign: 'left',
      background: selected ? 'var(--accent-soft)' : 'var(--app-card)',
      border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--app-line)'),
      borderRadius: 10, padding: 10, fontFamily: 'inherit', color: 'var(--text)',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      {imgPath ? (
        <img src={`/static/${imgPath}`} alt="" style={{
          width: 64, height: 84, objectFit: 'cover', borderRadius: 6,
          background: '#FBF9F4', flexShrink: 0,
        }}/>
      ) : (
        <div style={{
          width: 64, height: 84, borderRadius: 6, background: 'var(--app-card-hi)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--text-mute)',
        }}><I.File size={18}/></div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.fournisseur || ticket.vendor || '—'}
        </div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
          {ticket.date || '?'} · {ticket.montant_ttc != null ? `${ticket.montant_ttc} €` : '—'}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {status === 'validated' && <span className="app-badge app-badge-ok"><I.Check size={9} sw={3}/> Validé</span>}
          {status === 'ignored'   && <span className="app-badge" style={{ background: 'rgba(255,255,255,0.06)' }}>Ignoré</span>}
          {status === 'duplicate' && <span className="app-badge app-badge-warn">Doublon</span>}
          {status === 'pending' && reasons.length > 0 && (
            <span className="app-badge app-badge-warn"><I.Alert size={9}/> {reasons[0]}</span>
          )}
        </div>
      </div>
    </button>
  );
};

const TicketDetail = ({ ticket, runId, mode, onUpdated }) => {
  const [fields, setFields] = React.useState(() => ({
    date: ticket.date || '',
    fournisseur: ticket.fournisseur || '',
    montant_ttc: ticket.montant_ttc ?? '',
    montant_ht: ticket.montant_ht ?? '',
    montant_tva: ticket.montant_tva ?? '',
    type: ticket.type || '',
    mode_paiement: ticket.mode_paiement || '',
  }));
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const readOnly = mode !== 'doubtful' || ticket.review_status === 'validated';
  const imgPath = ticket.review_image_path;

  const setField = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const callPatch = async (action, includeFields = false) => {
    setSaving(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const body = { action };
      if (includeFields) {
        body.fields = {
          ...fields,
          montant_ttc: fields.montant_ttc === '' ? null : Number(fields.montant_ttc),
          montant_ht:  fields.montant_ht === ''  ? null : Number(fields.montant_ht),
          montant_tva: fields.montant_tva === '' ? null : Number(fields.montant_tva),
        };
      }
      const r = await fetch(`/api/review/${runId}/${ticket.ticket_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      onUpdated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
      {/* Image du ticket */}
      <div className="app-card app-card-body" style={{
        background: 'var(--app-card-hi)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', padding: 14,
      }}>
        {imgPath ? (
          <a href={`/static/${imgPath}`} target="_blank" rel="noopener"
             style={{ width: '100%', textAlign: 'center', display: 'block' }}>
            <img src={`/static/${imgPath}`} alt="Ticket"
                 style={{ width: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 6,
                          background: '#FBF9F4', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                          display: 'block' }}/>
          </a>
        ) : (
          <div className="caption">Aperçu non disponible</div>
        )}
        {ticket.source_page && (
          <div className="caption" style={{ marginTop: 10 }}>Source : {ticket.source_page}</div>
        )}
      </div>

      {/* Champs éditables ou raisons */}
      <div className="app-card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--app-line)' }}>
          <div className="label">Données extraites</div>
          {ticket.review_reasons?.length > 0 && mode === 'doubtful' && (
            <div className="caption" style={{ marginTop: 6, color: 'var(--warn)' }}>
              <I.Alert size={11} style={{ verticalAlign: -1 }}/> {ticket.review_reasons.join(' · ')}
            </div>
          )}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Date"        value={fields.date}         onChange={v => setField('date', v)} readOnly={readOnly} />
          <Field label="Fournisseur" value={fields.fournisseur}  onChange={v => setField('fournisseur', v)} readOnly={readOnly} />
          <Row>
            <Field label="Montant TTC" value={fields.montant_ttc} onChange={v => setField('montant_ttc', v)} readOnly={readOnly} mono />
            <Field label="Montant HT"  value={fields.montant_ht}  onChange={v => setField('montant_ht', v)}  readOnly={readOnly} mono />
            <Field label="TVA"         value={fields.montant_tva} onChange={v => setField('montant_tva', v)} readOnly={readOnly} mono />
          </Row>
          <Row>
            <Field label="Type"          value={fields.type}          onChange={v => setField('type', v)} readOnly={readOnly} />
            <Field label="Mode paiement" value={fields.mode_paiement} onChange={v => setField('mode_paiement', v)} readOnly={readOnly} />
          </Row>

          {err && (
            <div className="app-alert app-alert-danger" style={{ marginTop: 6 }}>
              <I.AlertCircle size={14} className="app-alert-icon"/>
              <div className="app-alert-msg">{err}</div>
            </div>
          )}
        </div>

        {mode === 'doubtful' && ticket.review_status !== 'validated' && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--app-line)',
                        display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="app-btn app-btn-ghost app-btn-sm" disabled={saving}
                    onClick={() => callPatch('duplicate')}>
              <I.File size={12}/> Doublon
            </button>
            <button className="app-btn app-btn-secondary app-btn-sm" disabled={saving}
                    onClick={() => callPatch('ignore')}>
              <I.Trash size={12}/> Ignorer
            </button>
            <button className="app-btn app-btn-primary app-btn-sm" disabled={saving}
                    onClick={() => callPatch('validate', true)}>
              <I.Check size={12} sw={3}/> Valider
            </button>
          </div>
        )}
        {ticket.review_status === 'validated' && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--app-line)' }}>
            <span className="app-badge app-badge-ok"><I.Check size={10} sw={3}/> Validé manuellement</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, readOnly, mono }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
    <span className="caption" style={{ fontSize: 11 }}>{label}</span>
    <input type="text" value={value ?? ''} readOnly={readOnly}
           onChange={(e) => onChange(e.target.value)}
           style={{
             width: '100%', boxSizing: 'border-box',
             background: readOnly ? 'transparent' : 'var(--app-card-hi)',
             border: '1px solid var(--app-line)',
             borderRadius: 6, padding: '7px 10px',
             color: 'var(--text)', fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
             fontSize: 12.5, outline: 'none', minWidth: 0,
           }}/>
  </label>
);

const Row = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, width: '100%' }}>{children}</div>
);

const FailActions = ({ ticket }) => (
  <div className="app-card app-card-body">
    <div className="label" style={{ marginBottom: 12, color: 'var(--danger)' }}>
      Ticket illisible — actions disponibles
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ActionTile icon={<I.Camera/>}   title="Re-photographier le ticket" sub="Suivre le guide de prise de vue pour une meilleure capture" />
      <ActionTile icon={<I.Edit/>}     title="Saisie manuelle"            sub="Créer les écritures à la main" />
      <ActionTile icon={<I.Mail/>}     title="Email de relance"           sub="Envoyer un message au client pour demander un nouveau scan" featured />
    </div>
    <div style={{ height: 1, background: 'var(--app-line)', margin: '18px 0' }} />
    <div style={{
      padding: 14, background: 'var(--info-soft)',
      border: '1px solid var(--info-line)', borderRadius: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--info)', marginBottom: 6 }}>
        Modèle de message pré-rédigé
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
        "Bonjour, le ticket que vous avez transmis le {ticket.date} n'a pas pu être lu de manière fiable.
        Pourriez-vous nous renvoyer une photo plus nette (ticket à plat, lumière directe, cadrage serré) ?"
      </div>
      <button className="app-btn app-btn-secondary app-btn-sm" style={{ marginTop: 12 }}>
        <I.Edit size={11}/> Personnaliser et envoyer
      </button>
    </div>
  </div>
);

const ActionTile = ({ icon, title, sub, featured }) => (
  <button style={{
    appearance: 'none', textAlign: 'left',
    border: '1px solid ' + (featured ? 'var(--accent)' : 'var(--app-line)'),
    background: featured ? 'var(--accent-soft)' : 'transparent',
    padding: 13, borderRadius: 8, cursor: 'pointer',
    display: 'flex', gap: 12, alignItems: 'center',
    fontFamily: 'inherit', color: 'var(--text)',
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: featured ? 'var(--accent-soft)' : 'var(--app-card-hi)',
      color: featured ? 'var(--accent)' : 'var(--text-dim)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{React.cloneElement(icon, { size: 16 })}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
      <div className="caption" style={{ marginTop: 2 }}>{sub}</div>
    </div>
    <I.Chevron size={13} stroke="var(--text-mute)" />
  </button>
);

// ─── Step 3: Export ────────────────────────────────────────────────
const OcrExport = ({ onNavigate, runResult }) => {
  const runId = runResult?.run_id;
  const [exporting, setExporting] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const hasRescan = (runResult?.review?.rescan_count || 0) > 0;
  const summary = runResult?.summary || {};

  const doExport = async () => {
    if (!runId) return;
    setExporting(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const r = await fetch(`/api/review/${runId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: '{}',
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await r.json();
      setResult(j);
      if (j.excel_url) window.location.href = j.excel_url;
    } catch (e) {
      setErr(e.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadRescan = () => {
    if (runId) window.location.href = `/api/rescan-pdf/${runId}`;
  };

  return (
    <div className="app-page" style={{ maxWidth: 1100 }}>
      <PageHeader
        kicker="Agent Saisie"
        title="Export comptable"
        subtitle="Choisissez le format d'export et téléchargez les écritures validées."
      />
      <Steps steps={STEPS_OCR} current={2} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18, marginTop: 28 }}>
        <div>
          <div className="label" style={{ marginBottom: 12 }}>Export Sage Compta</div>
          <div className="app-card app-card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <I.FileExcel size={28} stroke="var(--accent)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Excel — Format Sage Compta Cloud</div>
                <div className="caption" style={{ marginTop: 2 }}>
                  Toutes les écritures validées + alertes. Import direct dans Sage.
                </div>
              </div>
            </div>

            <button className="app-btn app-btn-primary app-btn-lg"
                    style={{ width: '100%', marginTop: 18 }}
                    disabled={exporting || !runId}
                    onClick={doExport}>
              <I.Download size={14}/> {exporting ? 'Génération en cours…' : 'Générer et télécharger l\'Excel'}
            </button>

            {result && (
              <div className="app-alert app-alert-ok" style={{ marginTop: 12 }}>
                <I.CheckCircle size={17} className="app-alert-icon"/>
                <div>
                  <div className="app-alert-title">Export terminé</div>
                  <div className="app-alert-msg">
                    {result.tickets_included} écriture{result.tickets_included > 1 ? 's' : ''} exportée{result.tickets_included > 1 ? 's' : ''}.
                    {result.excel_url && (
                      <> <a href={result.excel_url} style={{ color: 'var(--accent)' }}>Re-télécharger</a></>
                    )}
                  </div>
                </div>
              </div>
            )}

            {err && (
              <div className="app-alert app-alert-danger" style={{ marginTop: 12 }}>
                <I.AlertCircle size={17} className="app-alert-icon"/>
                <div>
                  <div className="app-alert-title">Erreur</div>
                  <div className="app-alert-msg">{err}</div>
                </div>
              </div>
            )}
          </div>

          {hasRescan && (
            <>
              <div className="label" style={{ marginTop: 22, marginBottom: 12 }}>Tickets à rescanner</div>
              <div className="app-card app-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <I.AlertCircle size={20} stroke="var(--warn)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {runResult.review.rescan_count} ticket{runResult.review.rescan_count > 1 ? 's' : ''} illisible{runResult.review.rescan_count > 1 ? 's' : ''}
                    </div>
                    <div className="caption">PDF des pages à re-scanner avec une meilleure prise de vue.</div>
                  </div>
                </div>
                <button className="app-btn app-btn-secondary" style={{ width: '100%', marginTop: 14 }}
                        onClick={downloadRescan}>
                  <I.Download size={12}/> Télécharger le PDF à rescanner
                </button>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="label" style={{ marginBottom: 12 }}>Récapitulatif du run</div>
          <div className="app-card app-card-body">
            <SummaryRow label="Saisie #"           value={runId ? runId.slice(0, 12) + '…' : '—'} mono />
            <SummaryRow label="Pages traitées"     value={summary.total ?? '—'} />
            <SummaryRow label="Tickets exploités"  value={summary.exploites ?? '—'} />
            <SummaryRow label="Tickets illisibles" value={summary.inexploites ?? '—'} />
            <div style={{ height: 1, background: 'var(--app-line)', margin: '10px 0' }} />
            <SummaryRow label="Total débit"  value={summary.total_debit  != null ? fmtEur(summary.total_debit)  : '—'} mono />
            <SummaryRow label="Total crédit" value={summary.total_credit != null ? fmtEur(summary.total_credit) : '—'} mono />
            <SummaryRow label="Équilibre"
                        value={summary.equilibre ? 'OK' : (summary.total_debit != null ? 'À vérifier' : '—')}
                        bold />
          </div>

          {runResult?.cost && (
            <>
              <div className="label" style={{ marginTop: 22, marginBottom: 12 }}>Coût du traitement</div>
              <div className="app-card app-card-body">
                <SummaryRow label="Total"      value={fmtEur(runResult.cost.total_eur)} mono />
                <SummaryRow label="Par ticket" value={fmtEur(runResult.cost.per_ticket_eur)} mono />
                <SummaryRow label="Par page"   value={fmtEur(runResult.cost.per_page_eur)} mono />
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <button className="app-btn app-btn-secondary" onClick={() => onNavigate('ocr-upload')}>
          <I.Plus size={12}/> Nouvelle saisie
        </button>
        <button className="app-btn app-btn-primary" onClick={() => onNavigate('dashboard')}>
          Retour au tableau de bord <I.ArrowRight size={13}/>
        </button>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value, mono, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0' }}>
    <span className="meta">{label}</span>
    <span className={mono ? 'mono' : ''} style={{ fontWeight: bold ? 600 : 500, fontSize: bold ? 14.5 : 13 }}>{value}</span>
  </div>
);

Object.assign(window, { OcrUpload, OcrValidation, OcrExport });
