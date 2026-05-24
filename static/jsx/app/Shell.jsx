// app/Shell.jsx — Sidebar, topbar, page wrapper

const Logo = ({ size = 18 }) => (
  <a href="#" onClick={(e) => { e.preventDefault(); window.appNavigate?.('dashboard'); }}
     style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
    <img src="logo-enop.svg" alt="" width={size + 4} height={size + 4} />
    <span style={{
      fontFamily: "'Lora', Georgia, serif",
      fontSize: size + 4, lineHeight: 1, letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'baseline',
    }}>
      Enop
      <span style={{ color: 'var(--accent)', fontStyle: 'italic', fontSize: size, marginLeft: 2 }}>.ai</span>
    </span>
  </a>
);

const Avatar = ({ initials = 'CL', size = 30 }) => (
  <div className="app-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
    {initials}
  </div>
);

const Topbar = ({ activeAgent, breadcrumb, user, onLogout }) => (
  <div style={{
    height: 'var(--app-topbar-h)',
    background: 'var(--app-chrome)',
    display: 'flex', alignItems: 'center',
    padding: '0 18px 0 0',
    borderBottom: '1px solid var(--app-line)',
    flexShrink: 0,
  }}>
    <div style={{
      width: 'var(--app-sidebar-w)', height: '100%',
      display: 'flex', alignItems: 'center', padding: '0 18px',
      borderRight: '1px solid var(--app-line)',
    }}>
      <Logo />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', flex: 1, minWidth: 0 }}>
      {activeAgent && (
        <span className="app-badge app-badge-ok">{activeAgent}</span>
      )}
      {breadcrumb && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', minWidth: 0 }}>
          {breadcrumb.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ color: 'var(--text-mute)' }}>›</span>}
              <span
                onClick={item.onClick}
                style={{
                  cursor: item.onClick ? 'pointer' : 'default',
                  color: idx === breadcrumb.length - 1 ? 'var(--text)' : 'inherit',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320,
                }}>{item.label}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <button className="app-btn app-btn-ghost" style={{ width: 32, padding: 0 }} title="Notifications">
        <I.Bell size={15} />
      </button>
      <div style={{ height: 22, width: 1, background: 'var(--app-line)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{user?.name || 'Claire Lemoine'}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{user?.org || 'Cabinet Lemoine & Pelletier'}</span>
        </div>
        <Avatar initials={user?.initials || 'CL'} />
        <button className="app-btn app-btn-ghost" onClick={onLogout} title="Déconnexion"
                style={{ width: 32, padding: 0 }}>
          <I.Logout size={15} />
        </button>
      </div>
    </div>
  </div>
);

const Sidebar = ({ active, onNavigate }) => {
  const NavItem = ({ id, icon, label, badge, locked }) => (
    <a className={`app-nav-item ${active === id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
       onClick={() => !locked && onNavigate(id)}>
      <span className="app-nav-item-icon">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span className="app-badge app-badge-neutral" style={{ height: 18, fontSize: 9.5 }}>{badge}</span>}
      {locked && <I.Lock size={11} stroke="var(--text-mute)" />}
    </a>
  );

  return (
    <aside style={{
      width: 'var(--app-sidebar-w)',
      background: 'var(--app-chrome)',
      flexShrink: 0,
      borderRight: '1px solid var(--app-line)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 18,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--text-mute)',
        padding: '0 18px 8px', fontFamily: 'JetBrains Mono, monospace',
      }}>Espace de travail</div>
      <NavItem id="dashboard" icon={<I.Dashboard />} label="Tableau de bord" />
      <NavItem id="clients"   icon={<I.Clients />}  label="Clients" />
      <NavItem id="dossiers"  icon={<I.Folder />}   label="Dossiers" badge="14" locked />

      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--text-mute)',
        padding: '22px 18px 8px', fontFamily: 'JetBrains Mono, monospace',
      }}>Agents IA</div>
      <NavItem id="ocr"       icon={<I.Camera />}   label="OCR & Écritures" />
      <NavItem id="documents" icon={<I.Doc />}      label="Documents juridiques" locked />
      <NavItem id="templates" icon={<I.Template />} label="Templates" locked />

      <div style={{ flex: 1 }} />

      <div style={{
        margin: 14, padding: 12,
        background: 'rgba(0,229,180,0.04)',
        border: '1px solid var(--accent-line)',
        borderRadius: 6,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <I.Shield size={14} stroke="var(--accent)" />
        <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)' }}>
          <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
            Hébergé en France
          </div>
          Aucune donnée ne transite par un modèle IA externe.
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--app-line)', padding: '6px 0 10px' }}>
        <NavItem id="settings" icon={<I.Settings />} label="Paramètres" locked />
        <NavItem id="support"  icon={<I.Help />}     label="Support" locked />
      </div>
    </aside>
  );
};

const Shell = ({ active, agentBadge, breadcrumb, onNavigate, user, onLogout, children }) => {
  window.appNavigate = onNavigate;
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--app-bg)' }}>
      <Topbar activeAgent={agentBadge} breadcrumb={breadcrumb} user={user} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar active={active} onNavigate={onNavigate} />
        <main className="app-scroll workspace-light" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--app-bg)', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
};

// ── Common page primitives ──────────────────────────────────────────

const PageHeader = ({ kicker, title, subtitle, actions }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: 24, marginBottom: 28,
  }}>
    <div>
      {kicker && <div className="kicker" style={{ marginBottom: 8 }}>{kicker}</div>}
      <h1 className="h1" style={{ marginBottom: subtitle ? 6 : 0 }}>{title}</h1>
      <div className="accent-rule" />
      {subtitle && <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 14, maxWidth: 720, lineHeight: 1.55 }}>{subtitle}</div>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
  </div>
);

const Steps = ({ steps, current }) => (
  <div className="app-steps">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        {i > 0 && <div className="app-step-line" style={{
          background: i <= current ? 'var(--accent-line)' : 'var(--app-line-hi)',
        }} />}
        <div className={`app-step ${i < current ? 'is-done' : i === current ? 'is-active' : ''}`}>
          <span className="app-step-bullet">
            {i < current ? <I.Check size={12} sw={2.5}/> : i + 1}
          </span>
          <span className="app-step-label">{s}</span>
        </div>
      </React.Fragment>
    ))}
  </div>
);

const Stat = ({ label, value, change, intent = 'ok' }) => (
  <div className="app-card" style={{ padding: '18px 20px' }}>
    <div className="label" style={{ marginBottom: 10 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 32, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>{value}</div>
      {change && <span className={`app-badge app-badge-${intent}`}>{change}</span>}
    </div>
  </div>
);

const TrustBanner = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 11, color: 'var(--text-dim)',
    padding: '8px 0',
  }}>
    <I.Shield size={13} stroke="var(--accent)" />
    <span>Traité localement sur serveurs France — aucune donnée ne transite par un modèle IA externe.</span>
  </div>
);

Object.assign(window, { Shell, Logo, Avatar, PageHeader, Steps, Stat, TrustBanner });
