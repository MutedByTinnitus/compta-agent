// app/AppRoot.jsx — top-level app: auth state + router

function AppRoot() {
  const [user, setUser] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('enop_user') || 'null'); }
    catch { return null; }
  });
  const [route, setRoute] = React.useState('dashboard');
  const [file, setFile] = React.useState(null);
  const [runResult, setRunResult] = React.useState(null);

  React.useEffect(() => { document.body.classList.add('app-body'); }, []);
  React.useEffect(() => {
    if (user) localStorage.setItem('enop_user', JSON.stringify(user));
    else localStorage.removeItem('enop_user');
  }, [user]);

  const onAuth = (u) => { setUser(u); setRoute('dashboard'); };
  const onLogout = () => { setUser(null); setFile(null); setRoute('dashboard'); };

  const onNavigate = (id) => {
    // Sidebar shortcut: clicking "ocr" in nav opens the first step
    if (id === 'ocr') id = 'ocr-upload';
    setRoute(id);
    window.scrollTo(0, 0);
  };

  if (!user) return <AuthScreen onAuth={onAuth} />;

  // Shell config per route
  let activeNav = 'dashboard';
  let agentBadge = null;
  let breadcrumb = null;
  if (route === 'dashboard') activeNav = 'dashboard';
  else if (route === 'clients') activeNav = 'clients';
  else if (route.startsWith('ocr')) {
    activeNav = 'ocr';
    agentBadge = 'Agent OCR';
    const stepLabel = route === 'ocr-upload' ? 'Nouveau ticket' :
                      route === 'ocr-validate' ? 'Validation' : 'Export';
    breadcrumb = [{ label: 'OCR & Écritures', onClick: () => onNavigate('ocr-upload') }, { label: stepLabel }];
  }

  return (
    <Shell active={activeNav} agentBadge={agentBadge} breadcrumb={breadcrumb}
           onNavigate={onNavigate} user={user} onLogout={onLogout}>
      {route === 'dashboard' && <Dashboard onNavigate={onNavigate} user={user} />}
      {route === 'clients'   && <ClientsList onNavigate={onNavigate} />}

      {route === 'ocr-upload' && (
        <OcrUpload onNext={() => onNavigate('ocr-validate')}
                   file={file} setFile={setFile}
                   setRunResult={setRunResult} />
      )}
      {route === 'ocr-validate' && (
        <OcrValidation onNext={() => onNavigate('ocr-export')}
                       onBack={() => onNavigate('ocr-upload')}
                       runResult={runResult} />
      )}
      {route === 'ocr-export' && (
        <OcrExport onNavigate={onNavigate} runResult={runResult} />
      )}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
