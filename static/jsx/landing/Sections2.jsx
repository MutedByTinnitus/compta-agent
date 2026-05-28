// Pricing + FAQ + CTA + Footer
function Pricing() {
  const plans = [
    {
      name: 'Solo',
      price: '29',
      tickets: '500',
      desc: 'Pour artisans, freelances, TPE',
      features: ['500 tickets / mois', 'Export Excel + CSV', 'Historique 1 an', 'Email + chat'],
      cta: 'Démarrer',
      highlight: false,
    },
    {
      name: 'Cabinet',
      price: '149',
      tickets: '5 000',
      desc: 'Pour experts-comptables et services compta',
      features: ['5 000 tickets / mois', 'Multi-clients illimité', 'API + webhooks', 'Audit trail', 'Support prioritaire'],
      cta: 'Essayer 14 jours',
      highlight: true,
    },
    {
      name: 'Sur mesure',
      price: null,
      tickets: '∞',
      desc: 'Volumes élevés, on-premise, intégrations',
      features: ['Volume illimité', 'Déploiement on-prem', 'SLA 99,9 %', 'Modèles fine-tunés', 'CSM dédié'],
      cta: 'Nous contacter',
      highlight: false,
    },
  ];

  return (
    <section id="tarifs" className="light-section" style={{ padding: '140px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="badge" style={{ marginBottom: 20 }}>Tarifs</span>
          <h2 className="font-display" style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            Simple. <span className="italic-serif" style={{ color: 'var(--accent)' }}>Transparent.</span>
          </h2>
          <p style={{ fontSize: 17, color: 'var(--text-dim)', margin: 0 }}>
            Pas de surprise. Pas d'engagement. Annulable à tout moment.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {plans.map((p) => (
            <div key={p.name} style={{
              padding: 32,
              border: p.highlight ? '1px solid var(--accent)' : '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              background: p.highlight ? 'oklch(0.82 0.18 170 / 0.08)' : 'var(--bg-1)',
              color: 'var(--text)',
              boxShadow: p.highlight ? '0 0 60px oklch(0.82 0.18 170 / 0.18)' : 'none',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {p.highlight && (
                <div style={{ position: 'absolute', top: -10, left: 24, padding: '4px 10px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 2, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Le plus choisi
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h3 className="font-display" style={{ fontSize: 28, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{p.name}</h3>
                  <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>{p.desc}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0 24px' }}>
                {p.price ? (
                  <>
                    <span className="font-display" style={{ fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em' }}>{p.price}</span>
                    <span style={{ fontSize: 16, opacity: 0.7 }}>€ / mois</span>
                  </>
                ) : (
                  <span className="font-display italic-serif" style={{ fontSize: 40, lineHeight: 1, color: 'var(--accent)' }}>Sur devis</span>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-dim)' }}>
                    <span style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--accent)', marginTop: 8, flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <a href="/signup" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px 18px',
                borderRadius: 2,
                background: p.highlight ? 'var(--accent)' : 'var(--text)',
                color: 'var(--bg)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
              }}>
                {p.cta} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: 'Quels formats de tickets Enop accepte ?',
      a: 'PDF (mono ou multi-pages), JPG, PNG, HEIC, scans. Vous pouvez aussi envoyer un dossier entier ou connecter une boîte mail dédiée — Enop ingère tout en batch.',
    },
    {
      q: 'Que se passe-t-il sur un ticket illisible ?',
      a: 'Enop attribue une confiance de 0,3 et marque la raison ("encre effacée", "ticket plié"…). Vous voyez la pile des tickets faibles dans le dashboard et pouvez décider à la main, ou rejeter en lot.',
    },
    {
      q: 'Mes tickets quittent-ils l\'Europe ?',
      a: 'Par défaut, traitement sur Anthropic Europe et Google Cloud Paris. En plan Sur mesure, déploiement on-premise sur votre infrastructure — vos tickets ne sortent jamais.',
    },
    {
      q: 'Comment Enop gère les tickets mixtes carburant + boutique ?',
      a: 'Sur les tickets TotalEnergies / Esso / Shell avec deux sections TVA (codes H et Q), Enop extrait uniquement la ligne H — le carburant — et signale qu\'il s\'agit d\'un ticket mixte. La ligne Q (boutique) est ignorée.',
    },
    {
      q: 'Et l\'export comptable ?',
      a: 'Excel formaté, CSV, JSON. Templates pour Sage, Cegid, Pennylane, Tiime, Quickbooks. API REST pour les intégrations sur mesure. Webhooks pour pousser à chaud.',
    },
    {
      q: 'Puis-je tester avant de payer ?',
      a: '14 jours gratuits, sans CB demandée. Vous pouvez traiter jusqu\'à 200 tickets pendant l\'essai. À la fin, vous gardez vos exports — qu\'on travaille ensemble ou non.',
    },
  ];

  const [open, setOpen] = React.useState(0);

  return (
    <section id="faq" className="light-section" style={{ padding: '140px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 80, alignItems: 'flex-start' }}>
          <div style={{ position: 'sticky', top: 120 }}>
            <span className="badge" style={{ marginBottom: 20 }}>Questions</span>
            <h2 className="font-display" style={{ fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Tout ce que <span className="italic-serif" style={{ color: 'var(--accent)' }}>vous</span><br />
              voulez savoir.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Pas la réponse à votre question ?<br />
              <a href="mailto:hello@enop.ai" style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 4 }}>hello@enop.ai</a>
            </p>
          </div>

          <div>
            {items.map((it, i) => (
              <div key={i} style={{
                borderTop: i === 0 ? '1px solid var(--line)' : 'none',
                borderBottom: '1px solid var(--line)',
              }}>
                <button
                  onClick={() => setOpen(open === i ? -1 : i)}
                  style={{
                    width: '100%',
                    padding: '24px 0',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 24,
                    color: 'var(--text)',
                    fontSize: 18,
                    fontFamily: 'inherit',
                  }}>
                  <span style={{ fontWeight: 500 }}>{it.q}</span>
                  <span style={{
                    width: 32, height: 32, borderRadius: 999,
                    border: '1px solid var(--line)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transform: open === i ? 'rotate(45deg)' : 'rotate(0)',
                    transition: 'transform 0.3s var(--ease)',
                    fontSize: 16,
                    color: 'var(--text-dim)',
                  }}>+</span>
                </button>
                <div style={{
                  maxHeight: open === i ? 200 : 0,
                  overflow: 'hidden',
                  transition: 'max-height 0.4s var(--ease), opacity 0.4s var(--ease)',
                  opacity: open === i ? 1 : 0,
                }}>
                  <p style={{ padding: '0 0 24px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-dim)', margin: 0, maxWidth: 580 }}>
                    {it.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{
      padding: '180px 0',
      background: 'var(--bg)',
      color: 'var(--text)',
      position: 'relative',
      overflow: 'hidden',
      borderTop: '1px solid var(--line)',
    }}>
      {/* Subtle grid (matches login aside) */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 80% at 50% 50%, var(--accent-soft), transparent 70%)',
      }} />
      {/* Tetris-style accent blocks */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 32px', opacity: 0.7 }}>
        {[40, 80, 120, 60, 140, 100, 180, 90, 70, 110, 50, 130].map((h, i) => (
          <div key={i} style={{
            flex: 1, height: h,
            background: `linear-gradient(180deg, transparent, var(--accent) 100%)`,
            opacity: 0.15 + (i % 3) * 0.15,
            borderRadius: 1,
          }} />
        ))}
      </div>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative' }}>
        <h2 className="font-display" style={{
          fontSize: 'clamp(48px, 7vw, 96px)',
          lineHeight: 1,
          letterSpacing: '-0.025em',
          margin: '0 0 32px',
        }}>
          Arrêtez de saisir.<br />
          <span className="italic-serif" style={{ color: 'var(--accent)' }}>Commencez à clôturer.</span>
        </h2>
        <p style={{ fontSize: 18, color: 'var(--text-dim)', maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.55 }}>
          14 jours d'essai. 200 tickets traités gratuitement.
          Aucune carte demandée. Vous gardez vos exports.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '16px 28px',
            background: 'var(--text)',
            color: 'var(--bg)',
            textDecoration: 'none',
            borderRadius: 2,
            fontSize: 15,
            fontWeight: 500,
          }}>
            Lancer un essai →
          </a>
          <a href="mailto:hello@enop.ai?subject=Demande%20de%20d%C3%A9mo%20Enop.ai" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '16px 24px',
            color: 'var(--text)',
            textDecoration: 'none',
            border: '1px solid var(--line-strong)',
            borderRadius: 2,
            fontSize: 15,
          }}>
            Réserver une démo
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: '#0d1c1b', color: '#f5f9f8', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle grid (matches login aside) */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 32px 0', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, paddingBottom: 64, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <img src="logo-enop.svg" alt="" width={24} height={24} />
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 22 }}>Enop</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(245,249,248,0.5)', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
              L'agent IA comptable construit en France pour les comptables français.
            </p>
          </div>
          {[
            { t: 'Sécurité',  l: ['Sécurité', 'Trust Center', 'Sous-traitants'] },
            { t: 'Légal',     l: ['Confidentialité', 'CGU', 'Mentions'] },
            { t: 'Contact',   l: ['Formulaire', 'Enterprise Sales', 'Contact'] },
          ].map(c => (
            <div key={c.t}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 16, color: '#f5f9f8' }}>{c.t}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.l.map(li => (
                  <li key={li} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, borderBottom: '1px dotted rgba(255,255,255,0.1)', height: 1 }} />
                    <a href="#" style={{ fontSize: 13, color: 'rgba(245,249,248,0.55)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{li}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{
          padding: '20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'rgba(245,249,248,0.35)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span>© 2026 Enop SAS · Paris · RCS 932 481 552</span>
          <span>🇫🇷 · RGPD</span>
        </div>
      </div>

      {/* Giant watermark */}
      <div style={{
        textAlign: 'center',
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 'clamp(100px, 22vw, 300px)',
        fontWeight: 400,
        lineHeight: 0.9,
        color: 'rgba(245,249,248,0.04)',
        userSelect: 'none',
        pointerEvents: 'none',
        letterSpacing: '-0.02em',
        overflow: 'hidden',
        paddingBottom: 0,
        marginTop: -20,
      }}>
        Enop
      </div>
    </footer>
  );
}

window.Pricing = Pricing;
window.FAQ = FAQ;
window.CTA = CTA;
window.Footer = Footer;
