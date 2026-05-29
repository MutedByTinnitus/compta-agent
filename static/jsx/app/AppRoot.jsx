// app/AppRoot.jsx — top-level app: auth state + router + job polling background

function AppRoot() {
  const [user, setUser] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [route, setRoute] = React.useState('dashboard');
  const [file, setFile] = React.useState(null);
  const [runResult, setRunResult] = React.useState(null);

  // Job en cours (lance par OcrUpload, polled ici dans AppRoot pour persister entre les pages)
  // job = null | { jobId, dbRunId, status, progress, step, detail, result, error, startedAt }
  const [job, setJob] = React.useState(null);

  React.useEffect(() => { document.body.classList.add('app-body'); }, []);

  // /api/me au mount
  React.useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const name = data.name || data.email;
          const initials = (data.first_name && data.last_name)
            ? (data.first_name[0] + data.last_name[0]).toUpperCase()
            : (name.split(/[\s@]/).filter(Boolean).map(s => s[0]).join('').slice(0, 2).toUpperCase());
          setUser({
            id: data.id, name, initials,
            email: data.email,
            org: data.org_name, org_id: data.org_id,
            role: data.role,
          });
        } else {
          setUser(false);
        }
      })
      .catch(() => setUser(false))
      .finally(() => setAuthChecked(true));
  }, []);

  // Polling persistant du job actif (continue même quand l'utilisateur change de page)
  React.useEffect(() => {
    if (!job || !job.jobId) return;
    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return;

    let cancelled = false;
    const POLL_MS = 2000;

    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${job.jobId}`, { credentials: 'same-origin' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setJob(j => j ? {
          ...j,
          status: data.status,
          progress: data.progress || 0,
          step: data.step || j.step,
          detail: data.detail || '',
          result: data.result || j.result,
          error: data.error || j.error,
          cancel_requested: !!data.cancel_requested,
        } : null);
      } catch {}
    };

    // Premier tick rapide
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [job?.jobId, job?.status]);

  const onAuth = () => { window.location.href = '/'; };
  const onLogout = () => { window.location.href = '/logout'; };

  const onNavigate = (id) => {
    if (id === 'ocr') id = 'ocr-upload';
    setRoute(id);
    window.scrollTo(0, 0);
  };

  // Appelé par OcrUpload quand l'API /api/process a renvoyé { job_id, run_id }
  const startJob = ({ jobId, dbRunId }) => {
    setJob({
      jobId, dbRunId,
      status: 'pending', progress: 0, step: 'upload', detail: '',
      result: null, error: null,
      startedAt: Date.now(),
    });
  };

  // Quand l'utilisateur clique sur le toast (run terminé) → ouvre les résultats
  const openJobResults = () => {
    if (!job || job.status !== 'done' || !job.result) return;
    setRunResult(job.result);
    setJob(null);  // toast se ferme
    setFile(null);
    onNavigate('ocr-validate');
  };

  const dismissJob = () => setJob(null);

  // Demande l'annulation au backend. Le job restera affiché en mode
  // "Annulation en cours…" jusqu'à ce que le polling reçoive status='cancelled'.
  const cancelJob = async () => {
    if (!job || !job.jobId) return;
    if (!confirm('Annuler l\'analyse en cours ? Les tickets déjà extraits seront perdus.')) return;
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      await fetch(`/api/jobs/${job.jobId}/cancel`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
      });
      // Optimistic UI : on flag tout de suite
      setJob(j => j ? { ...j, cancel_requested: true } : null);
    } catch (e) {
      console.error('[Cancel job]', e);
    }
  };

  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--app-bg)', color: 'var(--text-dim)',
        fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        Chargement…
      </div>
    );
  }

  if (!user) return <AuthScreen onAuth={onAuth} />;

  let activeNav = 'dashboard';
  let agentBadge = null;
  let breadcrumb = null;
  if (route === 'dashboard') activeNav = 'dashboard';
  else if (route === 'clients') activeNav = 'clients';
  else if (route === 'dossiers') activeNav = 'dossiers';
  else if (route === 'history') activeNav = 'history';
  else if (route === 'settings') activeNav = 'settings';
  else if (route.startsWith('ocr')) {
    activeNav = 'ocr';
    agentBadge = 'Agent Saisie';
    const stepLabel = route === 'ocr-upload' ? 'Nouvelle saisie' :
                      route === 'ocr-validate' ? 'Validation' : 'Export';
    breadcrumb = [{ label: 'Agent Saisie', onClick: () => onNavigate('ocr-upload') }, { label: stepLabel }];
  }

  // Un job est en cours si on a un job pending/running
  const jobActive = job && (job.status === 'pending' || job.status === 'running');

  return (
    <>
      <Shell active={activeNav} agentBadge={agentBadge} breadcrumb={breadcrumb}
             onNavigate={onNavigate} user={user} onLogout={onLogout}>
        {route === 'dashboard' && <Dashboard onNavigate={onNavigate} user={user} />}
        {route === 'clients'   && <ClientsList onNavigate={onNavigate} />}
        {route === 'dossiers'  && <DossiersList onNavigate={onNavigate} />}
        {route === 'history'   && <RunsHistory onNavigate={onNavigate} setRunResult={setRunResult} />}
        {route === 'settings'  && <Settings user={user} />}

        {route === 'ocr-upload' && (
          <OcrUpload onNext={() => onNavigate('ocr-validate')}
                     file={file} setFile={setFile}
                     setRunResult={setRunResult}
                     startJob={startJob}
                     jobActive={jobActive} />
        )}
        {route === 'ocr-validate' && (
          <OcrValidation onNext={() => onNavigate('ocr-export')}
                         onBack={() => onNavigate(runResult?._reopened ? 'history' : 'ocr-upload')}
                         runResult={runResult} />
        )}
        {route === 'ocr-export' && (
          <OcrExport onNavigate={onNavigate} runResult={runResult} />
        )}
      </Shell>

      {job && <JobToast job={job}
                        onOpen={openJobResults}
                        onDismiss={dismissJob}
                        onCancel={cancelJob} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
