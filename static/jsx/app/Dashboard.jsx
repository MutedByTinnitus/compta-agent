// app/Dashboard.jsx — landing screen after login

const RECENT_ACTIVITY = [
  { who: 'Vous',     what: 'avez validé 8 écritures OCR pour', target: 'OFFICE PRO PARIS',    when: 'Il y a 12 min', initials: 'CL' },
  { who: 'Pierre M.', what: 'a exporté un lot de tickets',     target: 'avril 2026',          when: 'Il y a 1 h',    initials: 'PM' },
  { who: 'Vous',     what: 'avez ajouté un client',            target: 'GAUTHIER & ASSOCIÉS', when: 'Hier',          initials: 'CL' },
  { who: 'Léa B.',    what: 'a corrigé une ligne pour',         target: 'ATLAS LOGISTIQUE',    when: 'Hier',          initials: 'LB' },
];

const Dashboard = ({ onNavigate, user }) => {
  const firstName = (user?.name || 'Claire').split(' ')[0];
  return (
    <div className="app-page">
      <PageHeader
        kicker={user?.org || 'Cabinet Lemoine & Pelletier'}
        title="Tableau de bord"
        subtitle={`Bienvenue ${firstName}. Voici ce qui demande votre attention cette semaine.`}
        actions={<>
          <button className="app-btn app-btn-secondary"><I.Plus size={14}/> Nouveau client</button>
          <button className="app-btn app-btn-primary" onClick={() => onNavigate('ocr-upload')}>
            <I.Camera size={14}/> Nouveau ticket OCR
          </button>
        </>}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <Stat label="Tickets ce mois"     value="384"  change="+98% auto" intent="ok" />
        <Stat label="À valider"           value="6"    change="à traiter" intent="warn" />
        <Stat label="Clients actifs"      value="42"   change="+2"        intent="ok" />
        <Stat label="Taux d'automatisation" value="96%" change="stable"   intent="neutral" />
      </div>

      {/* Two columns: agent launcher + activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Agent launcher */}
        <div className="app-card" style={{ padding: 0 }}>
          <div className="app-card-hd">
            <div>
              <h2 className="h2">Démarrer une tâche</h2>
              <div className="accent-rule" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <AgentTile
              icon={<I.Camera size={18} />}
              tone="ok"
              title="Nouveau ticket OCR"
              sub="Scanner ticket ou facture, générer les écritures comptables"
              cta="Démarrer"
              onClick={() => onNavigate('ocr-upload')}
              available
            />
            <AgentTile
              icon={<I.Doc size={18} />}
              tone="info"
              title="Approbation des comptes"
              sub="Générer le jeu complet de documents juridiques (AGOA)"
              cta="Bientôt disponible"
              locked
            />
          </div>
        </div>

        {/* Recent activity */}
        <div className="app-card" style={{ padding: 0 }}>
          <div className="app-card-hd">
            <div>
              <h2 className="h2">Activité récente</h2>
              <div className="accent-rule" />
            </div>
          </div>
          <div>
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} style={{
                padding: '12px 18px',
                display: 'flex', gap: 11, alignItems: 'flex-start',
                borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--app-line-soft)' : 'none',
              }}>
                <Avatar initials={a.initials} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 500 }}>{a.who}</span>{' '}
                    <span style={{ color: 'var(--text-dim)' }}>{a.what}</span>{' '}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>{a.target}</span>
                  </div>
                  <div className="caption" style={{ marginTop: 2 }}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent tickets — table */}
      <div className="app-card" style={{ padding: 0 }}>
        <div className="app-card-hd">
          <div>
            <h2 className="h2">Tickets récents</h2>
            <div className="accent-rule" />
          </div>
          <button className="app-btn app-btn-secondary app-btn-sm" onClick={() => onNavigate('ocr-upload')}>
            <I.Plus size={12}/> Nouveau ticket
          </button>
        </div>
        <table className="app-tbl">
          <thead>
            <tr>
              <th>Fichier</th>
              <th>Fournisseur</th>
              <th style={{ textAlign: 'right' }}>Total TTC</th>
              <th>Statut</th>
              <th>Reçu</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {DEMO.OCR_HISTORY.slice(0, 5).map(t => (
              <tr key={t.id}>
                <td className="mono" style={{ fontSize: 12 }}>{t.file}</td>
                <td>{t.vendor}</td>
                <td className="mono right">{t.total ? fmtEur(t.total) : '—'}</td>
                <td>
                  {t.status === 'auto'   && <span className="app-badge app-badge-ok"><I.Check size={10} sw={3}/> Auto</span>}
                  {t.status === 'review' && <span className="app-badge app-badge-warn"><I.Alert size={10}/> Revu</span>}
                  {t.status === 'fail'   && <span className="app-badge app-badge-danger"><I.X size={10}/> Illisible</span>}
                </td>
                <td className="caption">{t.date}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="app-btn app-btn-ghost app-btn-sm" onClick={() => onNavigate('ocr-validate')}>
                    Ouvrir <I.Chevron size={12}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AgentTile = ({ icon, tone = 'ok', title, sub, cta, onClick, locked, available }) => {
  const toneColor = tone === 'info' ? 'var(--info)' : 'var(--accent)';
  const toneBg    = tone === 'info' ? 'var(--info-soft)' : 'var(--accent-soft)';
  return (
    <button onClick={onClick} disabled={locked}
            style={{
              appearance: 'none', textAlign: 'left',
              background: 'transparent', border: 0,
              padding: '22px 22px 22px',
              cursor: locked ? 'not-allowed' : 'pointer',
              borderRight: '1px solid var(--app-line)',
              display: 'flex', flexDirection: 'column', gap: 12,
              opacity: locked ? 0.5 : 1,
              transition: 'background 0.15s var(--ease)',
              fontFamily: 'inherit', color: 'inherit',
            }}
            onMouseEnter={(e) => !locked && (e.currentTarget.style.background = 'var(--app-card-hi)')}
            onMouseLeave={(e) => !locked && (e.currentTarget.style.background = 'transparent')}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: toneBg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: toneColor,
      }}>{icon}</div>
      <div>
        <div className="h3" style={{ marginBottom: 4, fontSize: 14 }}>{title}</div>
        <div className="meta">{sub}</div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 500,
        color: locked ? 'var(--text-mute)' : 'var(--accent)',
        marginTop: 4,
      }}>
        {locked && <I.Lock size={11}/>}
        {cta}
        {available && <I.ArrowRight size={12} />}
      </div>
    </button>
  );
};

// ── Clients list (browse the workspace) ───────────────────────────

const ClientsList = ({ onNavigate }) => {
  const [q, setQ] = React.useState('');
  const filtered = DEMO.ALL_CLIENTS.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.siren.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
  );
  return (
    <div className="app-page">
      <PageHeader
        title="Clients"
        subtitle="Vos sociétés clientes — fiches partagées entre tous les agents."
        actions={<button className="app-btn app-btn-primary"><I.Plus size={14}/> Nouveau client</button>}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <I.Search size={14} stroke="var(--text-mute)"
                    style={{ position: 'absolute', left: 14, top: 12 }} />
          <input className="app-input" placeholder="Rechercher par nom ou SIREN…" value={q}
                 onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
        </div>
      </div>

      <div className="app-card" style={{ padding: 0 }}>
        <table className="app-tbl">
          <thead>
            <tr>
              <th>Dénomination</th>
              <th>SIREN</th>
              <th>Forme</th>
              <th>Clôture</th>
              <th>Tickets</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('ocr-upload')}>
                <td><span style={{ fontWeight: 500 }}>{c.name}</span></td>
                <td className="mono">{c.siren}</td>
                <td className="meta">{c.form}</td>
                <td className="mono">{c.closing}</td>
                <td>{c.dossiers}</td>
                <td>
                  <span className={`app-badge ${c.status === 'En cours' ? 'app-badge-info' : 'app-badge-neutral'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <I.Chevron size={13} stroke="var(--text-mute)" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard, ClientsList });
