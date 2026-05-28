// Logos marquee + Features grid + How it works
function LogosMarquee() {
  const logos = [
    'Cabinet Lefèvre', 'Comptae', 'Fiducial+', 'Logiciels Pro',
    'Atelier 14', 'Routage SAS', 'Studio Mavis', 'Groupe Hexa',
    'Maison Carrée', 'Transport BLR', 'Édifice & Co', 'Verso Audit',
  ];
  const doubled = [...logos, ...logos];

  return (
    <section style={{
      padding: '0',
      background: '#0d1c1b',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div className="marquee" style={{ gap: 0 }}>
        {doubled.map((l, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 0,
            color: 'rgba(245,249,248,0.35)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            whiteSpace: 'nowrap',
            padding: '18px 32px',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            {l}
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      label: 'Vision multimodale',
      title: 'Auditable du premier\nau dernier ticket',
      desc: 'Anthropic Claude, Gemini et Mistral OCR en cascade. Enop fournit des citations sur chaque champ extrait — vous savez exactement d\'où vient chaque montant.',
      visual: (
        <div style={{ width: '100%', background: '#f8faf9', border: '1px solid #e2e8e6', borderRadius: 4, overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          <div style={{ background: '#0d1c1b', color: '#f5f9f8', padding: '8px 14px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>journal_2026_03.xlsx</span><span style={{ color: '#00a882' }}>● live</span>
          </div>
          {[
            ['14/03', 'TotalEnergies', 'carburant', '85,42 €', 0.97],
            ['14/03', 'APRR', 'péage', '24,80 €', 0.99],
            ['15/03', 'Novotel Paris', 'hôtel', '182,00 €', 0.95],
          ].map(([d, v, t, m, c], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 80px 72px 48px', padding: '9px 14px', borderBottom: '1px solid #e8eeec', background: i === 0 ? 'rgba(0,168,130,0.06)' : 'white', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#7a9994' }}>{d}</span>
              <span style={{ color: '#0d1c1b', fontFamily: 'Inter, sans-serif' }}>{v}</span>
              <span style={{ color: '#00a882', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 500 }}>{t}</span>
              <span style={{ color: '#0d1c1b', fontWeight: 600, textAlign: 'right', fontFamily: 'Inter, sans-serif' }}>{m}</span>
              <span style={{ color: c > 0.96 ? '#00a882' : '#f0b429', textAlign: 'right' }}>{c}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: 'Détection intelligente',
      title: 'Tickets mixtes H+Q\net abandons exclus',
      desc: 'Carburant (H) séparé de la boutique (Q) sur les tickets TotalEnergies. Transactions refusées ou abandonnées automatiquement ignorées — zéro faux frais.',
      visual: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#f8faf9', border: '1px solid #e2e8e6', borderRadius: 4, padding: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#0d1c1b' }}>TotalEnergies A6</span>
              <span style={{ color: '#00a882', fontWeight: 600 }}>H+Q détecté</span>
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(0,168,130,0.08)', border: '1px solid rgba(0,168,130,0.2)', borderRadius: 3, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>H 20% — carburant</span><span style={{ fontWeight: 700, color: '#00a882' }}>85,42 €</span></div>
            </div>
            <div style={{ padding: '8px 10px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 3, opacity: 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Q 20% — boutique</span><span style={{ textDecoration: 'line-through' }}>8,90 €</span></div>
            </div>
          </div>
          <div style={{ background: 'rgba(224,90,58,0.06)', border: '1px solid rgba(224,90,58,0.2)', borderRadius: 4, padding: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#0d1c1b' }}>AVIA · Abandon débit</span>
              <span style={{ color: '#e05a3a', fontWeight: 600 }}>Ignoré</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: 'Export & intégrations',
      title: 'Votre journal\ncomptable en un clic',
      desc: 'Excel formaté, CSV, JSON. Templates compatibles Sage, Cegid, Pennylane, Tiime. API REST + webhooks pour pousser à chaud vers votre logiciel comptable.',
      visual: (
        <div style={{ background: '#f8faf9', border: '1px solid #e2e8e6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8e6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: 3, background: '#1d6f42', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>X</span>
            <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>journal_mars_2026.xlsx</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7a9994', fontFamily: "'JetBrains Mono', monospace" }}>62 lignes</span>
          </div>
          {['Sage 100', 'Pennylane', 'Cegid', 'Tiime', 'API REST'].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: i < 4 ? '1px solid #edf2f0' : 'none', fontSize: 13 }}>
              <span style={{ color: '#0d1c1b' }}>{s}</span>
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: '3px 8px', background: i < 4 ? 'rgba(0,168,130,0.1)' : 'rgba(240,180,41,0.1)', color: i < 4 ? '#00a882' : '#c49010', borderRadius: 3 }}>{i < 4 ? 'Connecté' : 'Disponible'}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="comment-ca-marche" className="light-section" style={{ padding: '0', borderBottom: '1px solid var(--line)' }}>
      {features.map((f, fi) => (
        <div key={fi} style={{
          display: 'grid',
          gridTemplateColumns: fi % 2 === 0 ? '1fr 1fr' : '1fr 1fr',
          gap: 0,
          borderTop: '1px solid var(--line)',
          minHeight: 520,
        }}>
          {/* Text col */}
          <div style={{
            padding: '80px 64px',
            order: fi % 2 === 0 ? 0 : 1,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            borderRight: fi % 2 === 0 ? '1px solid var(--line)' : 'none',
            borderLeft: fi % 2 !== 0 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20, fontWeight: 600 }}>
              —{f.label}
            </div>
            <h2 className="font-display" style={{ fontSize: 'clamp(32px, 3.5vw, 52px)', lineHeight: 1.12, margin: '0 0 20px', whiteSpace: 'pre-line' }}>
              {f.title}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text-dim)', margin: '0 0 36px', maxWidth: 460 }}>
              {f.desc}
            </p>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 14, color: 'var(--text)', textDecoration: 'none',
              borderBottom: '1px solid var(--line-strong)',
              paddingBottom: 4,
              width: 'fit-content',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--line-strong)'; }}>
              En savoir plus <span>→</span>
            </a>
          </div>
          {/* Visual col */}
          <div style={{
            padding: '60px 48px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-1)',
            order: fi % 2 === 0 ? 1 : 0,
          }}>
            {f.visual}
          </div>
        </div>
      ))}
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: 1,
      t: 'Vous chargez',
      d: 'Glissez vos tickets — PDF, photo, scan, batch entier. Enop accepte tout.',
    },
    {
      n: 2,
      t: 'Enop lit',
      d: 'Vision LLM + OCR Document AI. Identification fournisseur, type, lignes TVA, doublons.',
    },
    {
      n: 3,
      t: 'Enop juge',
      d: 'Un second modèle relit, vérifie la cohérence, baisse la confiance sur les ambiguïtés.',
    },
    {
      n: 4,
      t: 'Vous validez',
      d: 'Tableau de bord avec scores, montants modifiables. Un clic et c\'est dans votre Excel.',
    },
  ];

  return (
    <section style={{ padding: '140px 0', background: 'var(--bg-1)', color: 'var(--text)', borderBottom: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle grid (matches login aside) */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 80% 20%, var(--accent-soft), transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 72, flexWrap: 'wrap', gap: 24 }}>
          <div style={{ maxWidth: 640 }}>
            <span className="badge badge-mono" style={{ marginBottom: 20 }}>
              =Pipeline Enop
            </span>
            <h2 className="font-display" style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: 0 }}>
              Quatre étapes.<br />
              <span className="italic-serif" style={{ color: 'var(--accent)' }}>Aucune saisie.</span>
            </h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 320, lineHeight: 1.6 }}>
            De la photo prise sur le parking à la ligne d'écriture, sans un seul appui sur le clavier.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
          {steps.map((s) => (
            <div key={s.n} style={{ background: 'var(--bg)', padding: '40px 28px', minHeight: 280, display: 'flex', flexDirection: 'column' }}>
              <div className="font-display" style={{ fontSize: 96, lineHeight: 1, color: 'var(--accent)', margin: '0 0 24px' }}>
                {s.n}
              </div>
              <h3 className="font-display" style={{ fontSize: 28, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                {s.t}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-dim)', margin: 0, flex: 1 }}>
                {s.d}
              </p>
              <div style={{ marginTop: 24, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Étape 0{s.n}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.LogosMarquee = LogosMarquee;
window.Features = Features;
window.HowItWorks = HowItWorks;
