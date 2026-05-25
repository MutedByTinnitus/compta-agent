// app/Auth.jsx — Login + signup screen (split layout)

const AuthAside = () => (
  <aside className="auth-aside" style={{
    background: 'var(--app-chrome)',
    borderRight: '1px solid var(--app-line)',
    padding: '56px 56px',
    display: 'flex', flexDirection: 'column',
    position: 'relative', overflow: 'hidden',
  }}>
    {/* Subtle grid background */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.4,
      backgroundImage:
        'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), ' +
        'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
      pointerEvents: 'none',
    }} />
    {/* Mint glow */}
    <div style={{
      position: 'absolute', top: -120, right: -120, width: 480, height: 480,
      background: 'radial-gradient(circle, rgba(0,229,180,0.12), transparent 70%)',
      pointerEvents: 'none',
    }} />

    <div style={{ position: 'relative', zIndex: 1 }}>
      <Logo size={20} />
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1, maxWidth: 460 }}>
      <div className="kicker" style={{ marginBottom: 20 }}>Espace cabinet</div>
      <h1 style={{
        fontFamily: "'Lora', Georgia, serif",
        fontWeight: 400, fontSize: 44, lineHeight: 1.1,
        letterSpacing: '-0.02em', margin: 0, color: 'var(--text)',
      }}>
        L'agent IA<br/>
        <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>comptable</span><br/>
        qui lit vos tickets.
      </h1>
      <div style={{
        marginTop: 28, padding: 0,
        fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 380,
      }}>
        Scannez. L'agent extrait, qualifie, génère les écritures —
        prêtes pour Sage, Cegid ou tout autre logiciel comptable.
      </div>

      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { k: 'Hébergement', v: 'Serveurs France · OVH / Scaleway' },
          { k: 'Sécurité',    v: 'AES-256 · TLS 1.3 · ISO 27001' },
          { k: 'Conformité',  v: 'RGPD · DAC7 · FEC' },
        ].map(r => (
          <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12 }}>
            <span style={{
              minWidth: 96,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: 'var(--text-mute)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>{r.k}</span>
            <span style={{ color: 'var(--text-dim)' }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>

    <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'var(--text-mute)' }}>
      © 2026 Enop.ai · Tous droits réservés
    </div>
  </aside>
);

const AuthForm = ({ mode, onSubmit, onSwitch }) => {
  const isLogin = mode === 'login';
  const [showPwd, setShowPwd] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [form, setForm] = React.useState({
    email: '', password: '',
    firstName: '', lastName: '', cabinet: '', siret: '',
    agree: false,
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/login' : '/signup';
      const body = new URLSearchParams();
      body.set('email', form.email);
      body.set('password', form.password);
      if (!isLogin) {
        body.set('first_name', form.firstName);
        body.set('last_name', form.lastName);
        body.set('cabinet', form.cabinet);
        if (form.siret) body.set('siret', form.siret);
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        credentials: 'same-origin',
        redirect: 'follow',
      });

      // Succès : Flask redirige vers / (302 → 200 sur /)
      if (resp.ok && (resp.redirected || resp.url.endsWith('/'))) {
        window.location.href = '/';
        return;
      }

      // Échec : Flask renvoie HTML avec un message d'erreur, statut 4xx
      if (!resp.ok) {
        const html = await resp.text();
        const match = html.match(/class="err"[^>]*>([^<]+)</);
        const msg = match ? match[1].trim() :
                    (isLogin ? 'Identifiants invalides' : 'Erreur lors de la création');
        throw new Error(msg);
      }

      // Cas dégénéré : 200 mais sans redirect (ne devrait pas arriver)
      throw new Error('Réponse inattendue du serveur');

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '56px 32px',
    }}>
      <form onSubmit={handle} style={{ width: '100%', maxWidth: 420 }}>
        <div className="kicker" style={{ marginBottom: 14 }}>
          {isLogin ? 'Connexion' : 'Création de compte'}
        </div>
        <h2 style={{
          fontFamily: "'Lora', Georgia, serif",
          fontWeight: 400, fontSize: 32, lineHeight: 1.1,
          letterSpacing: '-0.015em', margin: '0 0 8px',
          color: 'var(--text)',
        }}>
          {isLogin ? 'Accédez à votre espace.' : 'Démarrez en 2 minutes.'}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)', margin: '0 0 32px', lineHeight: 1.55 }}>
          {isLogin
            ? 'Retrouvez vos clients, vos dossiers et l\'agent de saisie automatique.'
            : 'Créez votre cabinet. Pas de carte bancaire requise — 30 tickets gratuits.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="app-input-group">
                <label>Prénom</label>
                <input className="app-input" required value={form.firstName}
                       onChange={(e) => setField('firstName', e.target.value)} placeholder="Claire" />
              </div>
              <div className="app-input-group">
                <label>Nom</label>
                <input className="app-input" required value={form.lastName}
                       onChange={(e) => setField('lastName', e.target.value)} placeholder="Lemoine" />
              </div>
            </div>
          )}

          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
              <div className="app-input-group">
                <label>Cabinet / société</label>
                <input className="app-input" required value={form.cabinet}
                       onChange={(e) => setField('cabinet', e.target.value)} placeholder="Lemoine & Pelletier" />
              </div>
              <div className="app-input-group">
                <label>SIRET</label>
                <input className="app-input" value={form.siret}
                       onChange={(e) => setField('siret', e.target.value)} placeholder="800 432 119 00012" />
              </div>
            </div>
          )}

          <div className="app-input-group">
            <label>Email professionnel</label>
            <input className="app-input" type="email" required value={form.email}
                   onChange={(e) => setField('email', e.target.value)}
                   placeholder="claire@cabinet.fr" autoComplete="email" />
          </div>

          <div className="app-input-group">
            <label>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input className="app-input" type={showPwd ? 'text' : 'password'} required value={form.password}
                     onChange={(e) => setField('password', e.target.value)}
                     placeholder={isLogin ? '••••••••' : 'Minimum 12 caractères'}
                     minLength={isLogin ? 0 : 12}
                     autoComplete={isLogin ? 'current-password' : 'new-password'}
                     style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                      title={showPwd ? 'Masquer' : 'Afficher'}
                      style={{
                        position: 'absolute', right: 4, top: 4, height: 30, width: 32,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 0, cursor: 'pointer',
                        color: 'var(--text-mute)',
                      }}>
                <I.Eye size={15} />
              </button>
            </div>
            {isLogin && (
              <a href="#" onClick={(e) => e.preventDefault()} style={{
                fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', alignSelf: 'flex-end',
              }}>Mot de passe oublié ?</a>
            )}
          </div>

          {!isLogin && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <input type="checkbox" required checked={form.agree}
                     onChange={(e) => setField('agree', e.target.checked)}
                     style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
              <span>
                J'accepte les <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>CGU</a> et
                la <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>politique de confidentialité</a>.
                Les données sont hébergées en France.
              </span>
            </label>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(232,93,93,0.1)',
              border: '1px solid rgba(232,93,93,0.3)',
              color: '#e85d5d', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="app-btn app-btn-primary app-btn-lg"
                  disabled={loading}
                  style={{ width: '100%', marginTop: 8 }}>
            {loading ? (isLogin ? 'Connexion…' : 'Création…') : (isLogin ? 'Se connecter' : 'Créer mon compte')}
            {!loading && <I.ArrowRight size={14} />}
          </button>
        </div>

        <div style={{
          margin: '28px 0', display: 'flex', alignItems: 'center', gap: 12,
          color: 'var(--text-mute)', fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--app-line)' }} />
          <span>ou</span>
          <div style={{ flex: 1, height: 1, background: 'var(--app-line)' }} />
        </div>

        <button type="button" className="app-btn app-btn-secondary app-btn-lg"
                style={{ width: '100%' }}
                onClick={(e) => e.preventDefault()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.3-1 2.4-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5z"/>
            <path d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6C4.7 19.7 8.1 22 12 22z" opacity=".8"/>
            <path d="M6.4 13.9C6.2 13.3 6.1 12.7 6.1 12s.1-1.3.3-1.9V7.5H3C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.5l3.4-2.6z" opacity=".6"/>
            <path d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.1 2 4.7 4.3 3 7.5l3.4 2.6C7.2 7.8 9.4 5.9 12 5.9z" opacity=".4"/>
          </svg>
          Continuer avec Google
        </button>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-dim)' }}>
          {isLogin ? "Pas encore de compte ? " : "Déjà inscrit ? "}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitch(); }}
             style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            {isLogin ? 'Créer un compte' : 'Se connecter'}
          </a>
        </div>
      </form>
    </main>
  );
};

const AuthScreen = ({ onAuth }) => {
  const [mode, setMode] = React.useState('login');
  return (
    <div className="auth-shell">
      <AuthAside />
      <AuthForm
        mode={mode}
        onSubmit={onAuth}
        onSwitch={() => setMode(mode === 'login' ? 'signup' : 'login')}
      />
    </div>
  );
};

window.AuthScreen = AuthScreen;
