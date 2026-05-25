// app/Dashboard.jsx — landing screen after login

const Dashboard = ({ onNavigate, user }) => {
  const firstName = (user?.name || '').split(' ')[0] || user?.email || 'Bienvenue';
  const [runs, setRuns] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/runs?per_page=10', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setRuns(data.runs || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // KPIs calculés depuis les runs réels
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const runsThisMonth = runs.filter(r => r.created_at && new Date(r.created_at) >= startMonth);
  const ticketsThisMonth = runsThisMonth.reduce((sum, r) =>
    sum + (r.tickets_good || 0) + (r.tickets_doubtful || 0), 0);
  const ticketsToValidate = runs.reduce((sum, r) => {
    // Un run "done" peut avoir des doubtful non-validés ; sans détail, on prend doubtful brut
    return sum + (r.tickets_doubtful || 0);
  }, 0);
  const totalTickets = runs.reduce((sum, r) =>
    sum + (r.tickets_good || 0) + (r.tickets_doubtful || 0), 0);
  const autoRate = totalTickets > 0
    ? Math.round(100 * runs.reduce((s, r) => s + (r.tickets_good || 0), 0) / totalTickets)
    : null;

  return (
    <div className="app-page">
      <PageHeader
        kicker={user?.org || 'Mon cabinet'}
        title="Tableau de bord"
        subtitle={`Bienvenue ${firstName}.`}
        actions={<button className="app-btn app-btn-primary" onClick={() => onNavigate('ocr-upload')}>
          <I.Camera size={14}/> Nouvelle saisie
        </button>}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <Stat label="Tickets ce mois"
              value={ticketsThisMonth}
              change={`${runsThisMonth.length} run${runsThisMonth.length > 1 ? 's' : ''}`}
              intent="ok" />
        <Stat label="À vérifier"
              value={ticketsToValidate}
              change={ticketsToValidate > 0 ? 'à traiter' : '—'}
              intent={ticketsToValidate > 0 ? 'warn' : 'neutral'} />
        <Stat label="Saisies au total"
              value={runs.length}
              change="historique" intent="neutral" />
        <Stat label="Taux d'automatisation"
              value={autoRate !== null ? `${autoRate}%` : '—'}
              change={totalTickets > 0 ? `sur ${totalTickets} tickets` : 'aucun ticket'}
              intent="neutral" />
      </div>

      {/* Agent launcher */}
      <div className="app-card" style={{ padding: 0, marginBottom: 24 }}>
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
            title="Nouvelle saisie"
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

      {/* Runs récents — table */}
      <div className="app-card" style={{ padding: 0 }}>
        <div className="app-card-hd">
          <div>
            <h2 className="h2">Saisies récentes</h2>
            <div className="accent-rule" />
          </div>
          <button className="app-btn app-btn-secondary app-btn-sm" onClick={() => onNavigate('history')}>
            Voir tout <I.Chevron size={12}/>
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="caption">
            Chargement…
          </div>
        ) : runs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="caption" style={{ marginBottom: 12 }}>Aucun run pour l'instant.</div>
            <button className="app-btn app-btn-primary app-btn-sm" onClick={() => onNavigate('ocr-upload')}>
              <I.Camera size={12}/> Lancer mon premier traitement
            </button>
          </div>
        ) : (
          <table className="app-tbl">
            <thead>
              <tr>
                <th>Fichiers</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>Pages</th>
                <th style={{ textAlign: 'right' }}>Auto</th>
                <th style={{ textAlign: 'right' }}>À vérifier</th>
                <th style={{ textAlign: 'right' }}>Illisibles</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 5).map(r => <RunRow key={r.id} run={r} onNavigate={onNavigate} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const RunRow = ({ run, onNavigate }) => {
  const date = run.created_at ? new Date(run.created_at) : null;
  const dateStr = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const firstFile = (run.filenames || [])[0] || '—';
  const moreFiles = Math.max(0, (run.filenames || []).length - 1);

  return (
    <tr>
      <td>
        <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
          {firstFile}
        </div>
        {moreFiles > 0 && <div className="caption">+{moreFiles} autre{moreFiles > 1 ? 's' : ''}</div>}
      </td>
      <td style={{ fontSize: 12.5 }}>
        {run.client_name || <span className="caption">—</span>}
      </td>
      <td className="mono right">{run.pages_total || '—'}</td>
      <td className="mono right">{run.tickets_good || 0}</td>
      <td className="mono right">{run.tickets_doubtful || 0}</td>
      <td className="mono right">{run.tickets_unreadable || 0}</td>
      <td>
        {run.status === 'done'   && <span className="app-badge app-badge-ok"><I.Check size={10} sw={3}/> Terminé</span>}
        {run.status === 'pending'&& <span className="app-badge app-badge-warn">En attente</span>}
        {run.status === 'running'&& <span className="app-badge app-badge-warn">En cours</span>}
        {run.status === 'failed' && <span className="app-badge app-badge-danger"><I.X size={10}/> Échec</span>}
      </td>
      <td className="caption">{dateStr}</td>
      <td style={{ textAlign: 'right' }}>
        <button className="app-btn app-btn-ghost app-btn-sm" onClick={() => onNavigate('history')}>
          Ouvrir <I.Chevron size={12}/>
        </button>
      </td>
    </tr>
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
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [editing, setEditing] = React.useState(null); // null | 'new' | client object

  const fetchClients = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/clients', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => setClients(data.clients || []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = clients.filter(c => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (c.name || '').toLowerCase().includes(needle)
        || (c.siren || '').includes(q.replace(/\s/g, ''));
  });

  return (
    <div className="app-page">
      <PageHeader
        title="Clients"
        subtitle={clients.length > 0
          ? `${clients.length} client${clients.length > 1 ? 's' : ''} actif${clients.length > 1 ? 's' : ''}.`
          : "Vos sociétés clientes — rattachez vos saisies à un client."}
        actions={<button className="app-btn app-btn-primary" onClick={() => setEditing('new')}>
          <I.Plus size={14}/> Nouveau client
        </button>}
      />

      {error && (
        <div className="app-alert app-alert-danger" style={{ marginBottom: 16 }}>
          <I.AlertCircle size={17} className="app-alert-icon"/>
          <div className="app-alert-msg">{error}</div>
        </div>
      )}

      {clients.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <I.Search size={14} stroke="var(--text-mute)"
                      style={{ position: 'absolute', left: 14, top: 12 }} />
            <input className="app-input" placeholder="Rechercher par nom ou SIREN…" value={q}
                   onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          </div>
        </div>
      )}

      <div className="app-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }} className="caption">Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="caption" style={{ marginBottom: 14 }}>
              Aucun client enregistré. Créez votre premier client pour rattacher vos saisies.
            </div>
            <button className="app-btn app-btn-primary" onClick={() => setEditing('new')}>
              <I.Plus size={13}/> Créer mon premier client
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="caption">
            Aucun résultat pour « {q} ».
          </div>
        ) : (
          <table className="app-tbl">
            <thead>
              <tr>
                <th>Dénomination</th>
                <th>SIREN</th>
                <th>Forme</th>
                <th>Clôture</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(c)}>
                  <td><span style={{ fontWeight: 500 }}>{c.name}</span></td>
                  <td className="mono">{c.siren || '—'}</td>
                  <td className="meta">{c.legal_form || '—'}</td>
                  <td className="mono">{c.fiscal_year_end || '—'}</td>
                  <td className="caption">
                    {c.contact_name || c.contact_email || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <I.Chevron size={13} stroke="var(--text-mute)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ClientEditModal
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchClients(); }}
        />
      )}
    </div>
  );
};

const ClientEditModal = ({ client, onClose, onSaved }) => {
  const isNew = !client;
  const [form, setForm] = React.useState(() => ({
    name: client?.name || '',
    siren: client?.siren || '',
    legal_form: client?.legal_form || '',
    fiscal_year_end: client?.fiscal_year_end || '',
    address_line1: client?.address_line1 || '',
    address_line2: client?.address_line2 || '',
    postal_code: client?.postal_code || '',
    city: client?.city || '',
    contact_name: client?.contact_name || '',
    contact_email: client?.contact_email || '',
    contact_phone: client?.contact_phone || '',
  }));
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const url = isNew ? '/api/clients' : `/api/clients/${client.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${resp.status}`);
      }
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!client) return;
    if (!confirm(`Supprimer le client « ${client.name} » ? Les saisies déjà liées ne seront pas supprimées mais perdront le lien.`)) return;
    setSaving(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const resp = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,18,22,0.7)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--app-card-hi, #14201b)',
        border: '1px solid var(--app-line)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          {isNew ? 'Nouveau client' : 'Modifier le client'}
        </div>
        <h2 style={{
          fontFamily: "'Lora', Georgia, serif", fontSize: 24, fontWeight: 500,
          margin: '0 0 22px', color: 'var(--text)',
        }}>
          {isNew ? 'Ajouter une société cliente' : form.name}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Dénomination *" value={form.name} onChange={v => setField('name', v)} />
          <Row>
            <Field label="SIREN" value={form.siren} onChange={v => setField('siren', v)} mono />
            <Field label="Forme juridique" value={form.legal_form} onChange={v => setField('legal_form', v)} />
            <Field label="Clôture" value={form.fiscal_year_end} onChange={v => setField('fiscal_year_end', v)} mono />
          </Row>
          <Field label="Adresse" value={form.address_line1} onChange={v => setField('address_line1', v)} />
          <Field label="Complément d'adresse" value={form.address_line2} onChange={v => setField('address_line2', v)} />
          <Row>
            <Field label="Code postal" value={form.postal_code} onChange={v => setField('postal_code', v)} mono />
            <Field label="Ville" value={form.city} onChange={v => setField('city', v)} />
          </Row>

          <div style={{ height: 1, background: 'var(--app-line)', margin: '6px 0' }} />

          <Field label="Contact référent" value={form.contact_name} onChange={v => setField('contact_name', v)} />
          <Row>
            <Field label="Email" value={form.contact_email} onChange={v => setField('contact_email', v)} />
            <Field label="Téléphone" value={form.contact_phone} onChange={v => setField('contact_phone', v)} />
          </Row>

          {err && (
            <div className="app-alert app-alert-danger" style={{ marginTop: 4 }}>
              <I.AlertCircle size={14} className="app-alert-icon"/>
              <div className="app-alert-msg">{err}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 22 }}>
          {!isNew ? (
            <button type="button" className="app-btn app-btn-ghost app-btn-sm" disabled={saving} onClick={remove}>
              <I.Trash size={12}/> Supprimer
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="app-btn app-btn-secondary" disabled={saving} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="app-btn app-btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? 'Enregistrement…' : (isNew ? 'Créer le client' : 'Enregistrer')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// Field/Row : composants partagés avec Ocr.jsx (déjà définis là-bas, fonctions globales)

// ── Historique complet des runs ──────────────────────────────────

const RunsHistory = ({ onNavigate, setRunResult }) => {
  const [runs, setRuns] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [dossiers, setDossiers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [clientFilter, setClientFilter] = React.useState(''); // '' = tous, 'null' = non classés, '<uuid>'
  const [dossierFilter, setDossierFilter] = React.useState('');
  const perPage = 20;

  // Liste clients
  React.useEffect(() => {
    fetch('/api/clients', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setClients(d.clients || []); })
      .catch(() => {});
  }, []);

  // Quand le filtre client change : recharger les dossiers correspondants
  React.useEffect(() => {
    setDossierFilter(''); // reset filtre dossier quand on change de client
    if (!clientFilter || clientFilter === 'null') {
      setDossiers([]);
      return;
    }
    fetch(`/api/dossiers?client_id=${encodeURIComponent(clientFilter)}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDossiers(d.dossiers || []); })
      .catch(() => setDossiers([]));
  }, [clientFilter]);

  const fetchRuns = React.useCallback((p, cf, df) => {
    setLoading(true);
    setError(null);
    let url = `/api/runs?page=${p}&per_page=${perPage}`;
    if (cf) url += `&client_id=${encodeURIComponent(cf)}`;
    if (df) url += `&dossier_id=${encodeURIComponent(df)}`;
    fetch(url, { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setRuns(data.runs || []);
        setTotal(data.total || 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchRuns(page, clientFilter, dossierFilter);
  }, [page, clientFilter, dossierFilter, fetchRuns]);

  // Reset à la page 1 quand on change un filtre
  React.useEffect(() => { setPage(1); }, [clientFilter, dossierFilter]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="app-page">
      <PageHeader
        kicker="Activité"
        title="Historique des saisies"
        subtitle={total > 0 ? `${total} saisie${total > 1 ? 's' : ''} au total` : 'Toutes vos saisies automatisées.'}
        actions={<button className="app-btn app-btn-primary" onClick={() => onNavigate('ocr-upload')}>
          <I.Camera size={14}/> Nouvelle saisie
        </button>}
      />

      {error && (
        <div className="app-alert app-alert-danger" style={{ marginBottom: 16 }}>
          <I.AlertCircle size={17} className="app-alert-icon"/>
          <div className="app-alert-msg">{error}</div>
        </div>
      )}

      {clients.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="caption">Filtrer :</span>
          <select value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    background: 'var(--app-card-hi)',
                    border: '1px solid var(--app-line)',
                    borderRadius: 6, color: 'var(--text)',
                    fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
                    minWidth: 220,
                  }}>
            <option value="">Tous les clients</option>
            <option value="null">— Non classés —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {dossiers.length > 0 && (
            <select value={dossierFilter}
                    onChange={(e) => setDossierFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      background: 'var(--app-card-hi)',
                      border: '1px solid var(--app-line)',
                      borderRadius: 6, color: 'var(--text)',
                      fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
                      minWidth: 200,
                    }}>
              <option value="">Tous les dossiers</option>
              <option value="null">— Sans dossier —</option>
              {dossiers.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="app-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }} className="caption">
            Chargement…
          </div>
        ) : runs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="caption" style={{ marginBottom: 14 }}>
              {clientFilter
                ? "Aucun run pour ce filtre."
                : "Aucune saisie pour l'instant. Lancez votre première saisie automatique."}
            </div>
            {!clientFilter && (
              <button className="app-btn app-btn-primary" onClick={() => onNavigate('ocr-upload')}>
                <I.Camera size={13}/> Démarrer
              </button>
            )}
          </div>
        ) : (
          <table className="app-tbl">
            <thead>
              <tr>
                <th>Fichiers</th>
                <th>Client</th>
                <th>Dossier</th>
                <th style={{ textAlign: 'right' }}>Pages</th>
                <th style={{ textAlign: 'right' }}>Auto</th>
                <th style={{ textAlign: 'right' }}>À vérifier</th>
                <th style={{ textAlign: 'right' }}>Illisibles</th>
                <th style={{ textAlign: 'right' }}>Coût</th>
                <th>Statut</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => <RunHistoryRow key={r.id} run={r} onNavigate={onNavigate} setRunResult={setRunResult} />)}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <button className="app-btn app-btn-secondary app-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}>
            <I.ChevronLeft size={12}/> Précédent
          </button>
          <span style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text-dim)' }}>
            Page {page} / {totalPages}
          </span>
          <button className="app-btn app-btn-secondary app-btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Suivant <I.Chevron size={12}/>
          </button>
        </div>
      )}
    </div>
  );
};

const RunHistoryRow = ({ run, onNavigate, setRunResult }) => {
  const date = run.created_at ? new Date(run.created_at) : null;
  const dateStr = date ? date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';
  const firstFile = (run.filenames || [])[0] || '—';
  const moreFiles = Math.max(0, (run.filenames || []).length - 1);
  const cost = run.cost_eur != null ? `${run.cost_eur.toFixed(3)} €` : '—';

  const reopen = () => {
    if (run.status !== 'done') return;
    // Construire un runResult compatible avec OcrValidation
    setRunResult({
      run_id: run.legacy_run_id || run.legacy_job_id,
      db_run_id: run.id,
      summary: {
        total: run.pages_total,
        exploites: (run.tickets_good || 0) + (run.tickets_doubtful || 0),
        inexploites: run.tickets_unreadable || 0,
      },
      review: {
        good_count: run.tickets_good || 0,
        count: run.tickets_doubtful || 0,
        rescan_count: run.tickets_unreadable || 0,
      },
      cost: run.cost_eur != null ? { total_eur: run.cost_eur } : {},
      _reopened: true,
    });
    onNavigate('ocr-validate');
  };

  const downloadExcel = (e) => {
    e.stopPropagation();
    if (run.excel_path) window.location.href = `/api/download/${run.excel_path}`;
  };

  return (
    <tr style={{ cursor: 'pointer' }} onClick={reopen}>
      <td>
        <div className="mono" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
          {firstFile}
        </div>
        {moreFiles > 0 && <div className="caption">+{moreFiles} autre{moreFiles > 1 ? 's' : ''}</div>}
      </td>
      <td style={{ fontSize: 12.5 }}>
        {run.client_name || <span className="caption">— Non classé —</span>}
      </td>
      <td style={{ fontSize: 12.5 }}>
        {run.dossier_label || <span className="caption">—</span>}
      </td>
      <td className="mono right">{run.pages_total || '—'}</td>
      <td className="mono right">{run.tickets_good || 0}</td>
      <td className="mono right">{run.tickets_doubtful || 0}</td>
      <td className="mono right">{run.tickets_unreadable || 0}</td>
      <td className="mono right">{cost}</td>
      <td>
        {run.status === 'done'   && <span className="app-badge app-badge-ok"><I.Check size={10} sw={3}/> Terminé</span>}
        {run.status === 'pending'&& <span className="app-badge app-badge-warn">En attente</span>}
        {run.status === 'running'&& <span className="app-badge app-badge-warn">En cours</span>}
        {run.status === 'failed' && <span className="app-badge app-badge-danger"><I.X size={10}/> Échec</span>}
      </td>
      <td className="caption">{dateStr}</td>
      <td style={{ textAlign: 'right' }}>
        {run.excel_path && run.status === 'done' && (
          <button className="app-btn app-btn-ghost app-btn-sm" onClick={downloadExcel} title="Télécharger Excel">
            <I.Download size={12}/>
          </button>
        )}
      </td>
    </tr>
  );
};

// ── Dossiers (exercices comptables des clients) ──────────────────

const DossiersList = ({ onNavigate }) => {
  const [dossiers, setDossiers] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [clientFilter, setClientFilter] = React.useState('');
  const [editing, setEditing] = React.useState(null); // null | 'new' | dossier object

  const fetchAll = React.useCallback(() => {
    setLoading(true); setError(null);
    const dossiersUrl = clientFilter
      ? `/api/dossiers?client_id=${encodeURIComponent(clientFilter)}`
      : '/api/dossiers';
    Promise.all([
      fetch(dossiersUrl, { credentials: 'same-origin' }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
      fetch('/api/clients', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : { clients: [] }),
    ])
      .then(([dData, cData]) => {
        setDossiers(dData.dossiers || []);
        setClients(cData.clients || []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [clientFilter]);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const noClients = clients.length === 0;

  return (
    <div className="app-page">
      <PageHeader
        title="Dossiers"
        subtitle={noClients
          ? "Créez d'abord un client pour pouvoir y rattacher des dossiers."
          : `Exercices comptables de vos clients.${dossiers.length > 0 ? ` ${dossiers.length} dossier${dossiers.length > 1 ? 's' : ''}.` : ''}`}
        actions={!noClients && (
          <button className="app-btn app-btn-primary" onClick={() => setEditing('new')}>
            <I.Plus size={14}/> Nouveau dossier
          </button>
        )}
      />

      {error && (
        <div className="app-alert app-alert-danger" style={{ marginBottom: 16 }}>
          <I.AlertCircle size={17} className="app-alert-icon"/>
          <div className="app-alert-msg">{error}</div>
        </div>
      )}

      {noClients ? (
        <div className="app-card app-card-body" style={{ textAlign: 'center', padding: 40 }}>
          <div className="caption" style={{ marginBottom: 14 }}>
            Vous n'avez pas encore de client. Un dossier est toujours rattaché à un client.
          </div>
          <button className="app-btn app-btn-primary" onClick={() => onNavigate('clients')}>
            <I.Clients size={13}/> Créer un client
          </button>
        </div>
      ) : (
        <>
          {clients.length > 1 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <span className="caption">Filtrer :</span>
              <select value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      style={{
                        padding: '7px 12px',
                        background: 'var(--app-card-hi)',
                        border: '1px solid var(--app-line)',
                        borderRadius: 6, color: 'var(--text)',
                        fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
                        minWidth: 240,
                      }}>
                <option value="">Tous les clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="app-card" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }} className="caption">Chargement…</div>
            ) : dossiers.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div className="caption" style={{ marginBottom: 14 }}>
                  {clientFilter
                    ? "Aucun dossier pour ce client. Créez-en un pour démarrer."
                    : "Aucun dossier. Créez un dossier (ex : « Exercice 2025 ») pour organiser vos saisies par exercice."}
                </div>
                <button className="app-btn app-btn-primary" onClick={() => setEditing('new')}>
                  <I.Plus size={13}/> Nouveau dossier
                </button>
              </div>
            ) : (
              <table className="app-tbl">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Client</th>
                    <th>Période</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map(d => (
                    <DossierRow key={d.id} dossier={d} onClick={() => setEditing(d)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {editing && (
        <DossierEditModal
          dossier={editing === 'new' ? null : editing}
          clients={clients}
          preselectedClientId={clientFilter || null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

const DossierRow = ({ dossier, onClick }) => {
  const fmt = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const periode = (dossier.date_start || dossier.date_end)
    ? `${fmt(dossier.date_start) || '?'} → ${fmt(dossier.date_end) || '?'}`
    : '—';
  return (
    <tr style={{ cursor: 'pointer' }} onClick={onClick}>
      <td><span style={{ fontWeight: 500 }}>{dossier.label}</span></td>
      <td>{dossier.client_name || '—'}</td>
      <td className="caption">{periode}</td>
      <td>
        {dossier.status === 'closed'
          ? <span className="app-badge" style={{ background: 'rgba(255,255,255,0.06)' }}>Clôturé</span>
          : <span className="app-badge app-badge-ok"><I.Check size={9} sw={3}/> Ouvert</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        <I.Chevron size={13} stroke="var(--text-mute)" />
      </td>
    </tr>
  );
};

const DossierEditModal = ({ dossier, clients, preselectedClientId, onClose, onSaved }) => {
  const isNew = !dossier;
  const [form, setForm] = React.useState(() => ({
    client_id: dossier?.client_id || preselectedClientId || (clients[0]?.id || ''),
    label: dossier?.label || '',
    date_start: dossier?.date_start || '',
    date_end: dossier?.date_end || '',
    status: dossier?.status || 'open',
  }));
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e) => {
    e?.preventDefault();
    if (!form.client_id) { setErr('Client requis'); return; }
    if (!form.label.trim()) { setErr('Label requis'); return; }
    setSaving(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const url = isNew ? '/api/dossiers' : `/api/dossiers/${dossier.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${resp.status}`);
      }
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!dossier) return;
    if (!confirm(`Supprimer le dossier « ${dossier.label} » ? Les saisies liées perdront le rattachement.`)) return;
    setSaving(true); setErr(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const resp = await fetch(`/api/dossiers/${dossier.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,18,22,0.7)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--app-card-hi, #14201b)',
        border: '1px solid var(--app-line)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
      }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          {isNew ? 'Nouveau dossier' : 'Modifier le dossier'}
        </div>
        <h2 style={{
          fontFamily: "'Lora', Georgia, serif", fontSize: 24, fontWeight: 500,
          margin: '0 0 22px', color: 'var(--text)',
        }}>
          {isNew ? 'Créer un dossier' : form.label}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="caption" style={{ fontSize: 11 }}>Client *</span>
            <select value={form.client_id}
                    onChange={(e) => setField('client_id', e.target.value)}
                    disabled={!isNew}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--app-card-hi)',
                      border: '1px solid var(--app-line)',
                      borderRadius: 6, color: 'var(--text)',
                      fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
                    }}>
              <option value="">— Choisir —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <Field label="Label * (ex : Exercice 2025)" value={form.label} onChange={v => setField('label', v)} />

          <Row>
            <Field label="Début de période" value={form.date_start} onChange={v => setField('date_start', v)} mono />
            <Field label="Fin de période" value={form.date_end} onChange={v => setField('date_end', v)} mono />
          </Row>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="caption" style={{ fontSize: 11 }}>Statut</span>
            <select value={form.status}
                    onChange={(e) => setField('status', e.target.value)}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--app-card-hi)',
                      border: '1px solid var(--app-line)',
                      borderRadius: 6, color: 'var(--text)',
                      fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
                    }}>
              <option value="open">Ouvert</option>
              <option value="closed">Clôturé</option>
            </select>
          </label>

          {err && (
            <div className="app-alert app-alert-danger" style={{ marginTop: 4 }}>
              <I.AlertCircle size={14} className="app-alert-icon"/>
              <div className="app-alert-msg">{err}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 22 }}>
          {!isNew ? (
            <button type="button" className="app-btn app-btn-ghost app-btn-sm" disabled={saving} onClick={remove}>
              <I.Trash size={12}/> Supprimer
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="app-btn app-btn-secondary" disabled={saving} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="app-btn app-btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : (isNew ? 'Créer le dossier' : 'Enregistrer')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Paramètres (profil + cabinet) ────────────────────────────────

const Settings = ({ user }) => {
  const [tab, setTab] = React.useState('profile');
  return (
    <div className="app-page">
      <PageHeader
        title="Paramètres"
        subtitle="Gérez votre profil et les informations de votre cabinet."
      />

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '1px solid var(--app-line)' }}>
        <TabBtnSimple active={tab === 'profile'} onClick={() => setTab('profile')} label="Mon profil" />
        <TabBtnSimple active={tab === 'cabinet'} onClick={() => setTab('cabinet')} label="Mon cabinet" />
      </div>

      {tab === 'profile' && <ProfileSettings user={user} />}
      {tab === 'cabinet' && <CabinetSettings user={user} />}
    </div>
  );
};

const TabBtnSimple = ({ active, onClick, label }) => (
  <button onClick={onClick} style={{
    appearance: 'none', background: 'transparent', cursor: 'pointer',
    border: 'none', borderBottom: '2px solid ' + (active ? 'var(--accent)' : 'transparent'),
    padding: '10px 16px', color: active ? 'var(--text)' : 'var(--text-dim)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  }}>{label}</button>
);

const ProfileSettings = ({ user }) => {
  const [form, setForm] = React.useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  });
  const [pwForm, setPwForm] = React.useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);  // { kind: 'ok'|'err', text }
  const [pwSaving, setPwSaving] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState(null);

  // Charger les valeurs réelles depuis /api/me (le `user` du Shell peut être incomplet)
  React.useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setForm(f => ({
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          email: d.email || '',
        }));
      })
      .catch(() => {});
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPwField = (k, v) => setPwForm(f => ({ ...f, [k]: v }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setMsg({ kind: 'ok', text: 'Profil mis à jour.' });
    } catch (e2) {
      setMsg({ kind: 'err', text: e2.message });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwSaving(true); setPwMsg(null);
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ kind: 'err', text: 'La confirmation ne correspond pas.' });
      setPwSaving(false);
      return;
    }
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const r = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify({
          current_password: pwForm.current_password,
          new_password: pwForm.new_password,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setPwMsg({ kind: 'ok', text: 'Mot de passe modifié.' });
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e2) {
      setPwMsg({ kind: 'err', text: e2.message });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1000 }}>
      <form onSubmit={saveProfile} className="app-card app-card-body">
        <div className="label" style={{ marginBottom: 14 }}>Informations personnelles</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row>
            <Field label="Prénom" value={form.first_name} onChange={v => setField('first_name', v)} />
            <Field label="Nom" value={form.last_name} onChange={v => setField('last_name', v)} />
          </Row>
          <Field label="Email" value={form.email} onChange={v => setField('email', v)} />

          {msg && (
            <div className={`app-alert ${msg.kind === 'ok' ? 'app-alert-ok' : 'app-alert-danger'}`}>
              {msg.kind === 'ok'
                ? <I.CheckCircle size={14} className="app-alert-icon"/>
                : <I.AlertCircle size={14} className="app-alert-icon"/>}
              <div className="app-alert-msg">{msg.text}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="app-btn app-btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>

      <form onSubmit={changePassword} className="app-card app-card-body">
        <div className="label" style={{ marginBottom: 14 }}>Mot de passe</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PasswordField label="Mot de passe actuel"
                         value={pwForm.current_password}
                         onChange={v => setPwField('current_password', v)} />
          <PasswordField label="Nouveau mot de passe (8+ caractères)"
                         value={pwForm.new_password}
                         onChange={v => setPwField('new_password', v)} />
          <PasswordField label="Confirmer le nouveau"
                         value={pwForm.confirm}
                         onChange={v => setPwField('confirm', v)} />

          {pwMsg && (
            <div className={`app-alert ${pwMsg.kind === 'ok' ? 'app-alert-ok' : 'app-alert-danger'}`}>
              {pwMsg.kind === 'ok'
                ? <I.CheckCircle size={14} className="app-alert-icon"/>
                : <I.AlertCircle size={14} className="app-alert-icon"/>}
              <div className="app-alert-msg">{pwMsg.text}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="app-btn app-btn-primary"
                    disabled={pwSaving || !pwForm.current_password || !pwForm.new_password}>
              {pwSaving ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const PasswordField = ({ label, value, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
    <span className="caption" style={{ fontSize: 11 }}>{label}</span>
    <input type="password" value={value || ''} autoComplete="new-password"
           onChange={(e) => onChange(e.target.value)}
           style={{
             width: '100%', boxSizing: 'border-box',
             background: 'var(--app-card-hi)',
             border: '1px solid var(--app-line)',
             borderRadius: 6, padding: '7px 10px',
             color: 'var(--text)', fontFamily: 'inherit',
             fontSize: 12.5, outline: 'none',
           }}/>
  </label>
);

const CabinetSettings = ({ user }) => {
  const isAdmin = user?.role === 'admin';
  const [form, setForm] = React.useState({ name: '', siret: '' });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [plan, setPlan] = React.useState('');

  React.useEffect(() => {
    fetch('/api/organization', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setForm({ name: d.name || '', siret: d.siret || '' });
          setPlan(d.plan || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const r = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setMsg({ kind: 'ok', text: 'Cabinet mis à jour.' });
    } catch (e2) {
      setMsg({ kind: 'err', text: e2.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="caption" style={{ padding: 40, textAlign: 'center' }}>Chargement…</div>;

  return (
    <form onSubmit={save} className="app-card app-card-body" style={{ maxWidth: 600 }}>
      <div className="label" style={{ marginBottom: 14 }}>Informations du cabinet</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nom du cabinet" value={form.name} onChange={v => setField('name', v)} readOnly={!isAdmin} />
        <Field label="SIRET (14 chiffres)" value={form.siret} onChange={v => setField('siret', v)} readOnly={!isAdmin} mono />

        <div style={{
          padding: 12, background: 'var(--app-card-hi)', borderRadius: 8,
          fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5,
        }}>
          Plan actuel : <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{plan || 'beta'}</span>
        </div>

        {!isAdmin && (
          <div className="app-alert app-alert-warn">
            <I.Alert size={14} className="app-alert-icon"/>
            <div className="app-alert-msg">
              Seuls les administrateurs du cabinet peuvent modifier ces informations.
            </div>
          </div>
        )}

        {msg && (
          <div className={`app-alert ${msg.kind === 'ok' ? 'app-alert-ok' : 'app-alert-danger'}`}>
            {msg.kind === 'ok'
              ? <I.CheckCircle size={14} className="app-alert-icon"/>
              : <I.AlertCircle size={14} className="app-alert-icon"/>}
            <div className="app-alert-msg">{msg.text}</div>
          </div>
        )}

        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="app-btn app-btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </form>
  );
};

Object.assign(window, { Dashboard, ClientsList, DossiersList, RunsHistory, Settings });
