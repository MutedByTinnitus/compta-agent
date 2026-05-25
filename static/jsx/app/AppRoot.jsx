// app/AppRoot.jsx — top-level app: auth state + router

function AppRoot() {
  // user = null pendant le chargement, false si non auth, objet si auth
  const [user, setUser] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [route, setRoute] = React.useState('dashboard');
  const [file, setFile] = React.useState(null);
  const [runResult, setRunResult] = React.useState(null);

  React.useEffect(() => { document.body.classList.add('app-body'); }, []);

  // Au mount : récupère l'utilisateur courant via /api/me
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
            id: data.id,
            name,
            initials,
            email: data.email,
            org: data.org_name,
            org_id: data.org_id,
            role: data.role,
          });
        } else {
          setUser(false);
        }
      })
      .catch(() => setUser(false))
      .finally(() => setAuthChecked(true));
  }, []);

  // Appelé après login/signup React (rarement utilisé : Flask gère le redirect via window.location)
  const onAuth = () => { window.location.href = '/'; };

  const onLogout = () => {
    window.location.href = '/logout';
  };

  const onNavigate = (id) => {
    if (id === 'ocr') id = 'ocr-upload';
    setRoute(id);
    window.scrollTo(0, 0);
  };

  // Chargement initial : éviter le flash de l'écran auth
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

  // Pas authentifié : la session a expiré pendant l'utilisation
  // (en pratique, Flask redirige vers /login avant qu'on arrive ici)
  if (!user) return <AuthScreen onAuth={onAuth} />;

  // Shell config per route
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

  return (
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
                   setRunResult={setRunResult} />
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
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
