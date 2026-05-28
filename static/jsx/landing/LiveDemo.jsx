// Live demo — ticket scan → extracted data → Excel row
function LiveDemo() {
  const [stage, setStage] = React.useState(0); // 0=idle, 1=scanning, 2=extracting, 3=done
  const [activeTicket, setActiveTicket] = React.useState(0);

  const tickets = [
    {
      vendor: 'TotalEnergies',
      city: 'A6 ST-AMBREUIL',
      date: '14/03/2026',
      lines: [
        { label: 'GAZOLE 70.07L', value: '85,42 €' },
        { label: 'PRIX/L', value: '1,219 €' },
      ],
      h: { ttc: '85,42', ht: '71,18', tva: '14,24' },
      q: { ttc: '8,90', ht: '7,42', tva: '1,48' },
      cb: '94,32',
      extracted: {
        type: 'carburant', ttc: '85,42', ht: '71,18', tva: '14,24',
        confidence: 0.97, note: 'Ticket mixte H+Q · Ligne H uniquement'
      },
    },
    {
      vendor: 'APRR',
      city: 'PÉAGE FLEURY',
      date: '14/03/2026',
      lines: [
        { label: 'CL.1 A6', value: '24,80 €' },
        { label: 'BARRIÈRE 421', value: '' },
      ],
      h: { ttc: '24,80', ht: '20,67', tva: '4,13' },
      q: null,
      cb: '24,80',
      extracted: {
        type: 'peage', ttc: '24,80', ht: '20,67', tva: '4,13',
        confidence: 0.99, note: 'Lecture nette'
      },
    },
    {
      vendor: 'STATION AVIA',
      city: 'NANTES SUD',
      date: '15/03/2026',
      lines: [
        { label: 'TRANSACTION', value: 'REFUSÉE' },
        { label: 'POMPE 8 VOLUME', value: '0.00' },
      ],
      h: null,
      q: null,
      cb: null,
      rejected: true,
      extracted: {
        rejected: true,
        note: 'Abandon débit détecté · ticket ignoré'
      },
    },
  ];

  React.useEffect(() => {
    let timers = [];
    const run = () => {
      setStage(0);
      timers.push(setTimeout(() => setStage(1), 600));
      timers.push(setTimeout(() => setStage(2), 2200));
      timers.push(setTimeout(() => setStage(3), 3600));
      timers.push(setTimeout(() => {
        setActiveTicket(t => (t + 1) % tickets.length);
        run();
      }, 6800));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  const ticket = tickets[activeTicket];

  return (
    <section id="produit" className="light-section" style={{
      padding: '140px 0',
      borderTop: '1px solid var(--line)',
      borderBottom: '1px solid var(--line)',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 56, gap: 32, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 640 }}>
            <div className="badge" style={{ marginBottom: 20 }}>
              <span className="dot" style={{ background: 'var(--accent)' }} />
              Démo en direct
            </div>
            <h2 className="font-display" style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
              margin: '0 0 20px',
            }}>
              Du papier au journal comptable<br />
              en <span className="italic-serif" style={{ color: 'var(--accent)' }}>4,2 secondes</span>.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-dim)', margin: 0, lineHeight: 1.55 }}>
              Enop reconnaît les fournisseurs, distingue les lignes H (carburant)
              des lignes Q (boutique), exclut les transactions abandonnées,
              et retrouve le bon TTC — celui imprimé sur le ticket, jamais calculé.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {tickets.map((_, i) => (
              <button key={i}
                onClick={() => setActiveTicket(i)}
                style={{
                  width: 36, height: 36, borderRadius: 999,
                  border: i === activeTicket ? '1px solid var(--text)' : '1px solid var(--line)',
                  background: i === activeTicket ? 'var(--text)' : 'transparent',
                  color: i === activeTicket ? 'var(--bg)' : 'var(--text-dim)',
                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* 3-column workspace */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr 1.2fr',
          gap: 0,
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lift)',
          minHeight: 540,
        }}>
          {/* Col 1: physical ticket */}
          <div style={{
            background: 'var(--bg-2)',
            borderRight: '1px solid var(--line)',
            padding: 32,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ReceiptPaper ticket={ticket} stage={stage} key={activeTicket} />
          </div>

          {/* Col 2: extraction panel */}
          <div style={{
            padding: 28,
            borderRight: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-mute)' }}>
                Extraction · vision
              </span>
              <span className={stage >= 2 ? 'badge badge-forest' : 'badge'} style={{ transition: 'all 0.4s' }}>
                <span className="dot" />
                {stage === 0 && 'En attente'}
                {stage === 1 && 'Scan...'}
                {stage === 2 && 'Lecture...'}
                {stage === 3 && (ticket.extracted.rejected ? 'Rejeté' : 'OK')}
              </span>
            </div>

            <ExtractionPanel ticket={ticket} stage={stage} />
          </div>

          {/* Col 3: Excel output */}
          <div style={{
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--forest)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>X</span>
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>journal_2026_03.xlsx</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: "'JetBrains Mono', monospace" }}>3 lignes · auto-sync</span>
            </div>
            <ExcelGrid stage={stage} ticket={ticket} activeIndex={activeTicket} />
          </div>
        </div>

        {/* Captions row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr 1.2fr',
          gap: 0,
          marginTop: 16,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          <div style={{ paddingLeft: 4 }}>01 · ticket source</div>
          <div>02 · données structurées</div>
          <div>03 · ligne comptable</div>
        </div>
      </div>
    </section>
  );
}

function ReceiptPaper({ ticket, stage }) {
  return (
    <div style={{
      width: 220,
      background: '#f4f1e8',
      padding: '24px 18px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10.5,
      lineHeight: 1.6,
      color: '#2a2620',
      position: 'relative',
      boxShadow: '0 12px 40px -8px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3), 0 0 0 1px oklch(0.82 0.18 170 / 0.12)',
      transform: 'rotate(-2deg)',
      borderRadius: 2,
    }}>
      {/* Torn edges */}
      <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 6, background: 'repeating-linear-gradient(90deg, transparent 0, transparent 3px, #f4f1e8 3px, #f4f1e8 6px)' }} />

      {/* Scan line overlay */}
      {stage === 1 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0, top: 0,
          height: 32,
          background: 'linear-gradient(to bottom, transparent, var(--accent-soft), var(--accent), var(--accent-soft), transparent)',
          opacity: 0.7,
          animation: 'scan-line 1.4s var(--ease) forwards',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em' }}>
        {ticket.vendor.toUpperCase()}
      </div>
      <div style={{ textAlign: 'center', color: '#6a6258', marginBottom: 10, fontSize: 9 }}>
        {ticket.city}
      </div>
      <div style={{ borderTop: '1px dashed #c8bfae', margin: '6px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6a6258' }}>
        <span>{ticket.date}</span>
        <span>14:32</span>
      </div>
      <div style={{ borderTop: '1px dashed #c8bfae', margin: '8px 0' }} />

      {ticket.lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{l.label}</span>
          <span>{l.value}</span>
        </div>
      ))}

      {ticket.h && (
        <>
          <div style={{ borderTop: '1px dashed #c8bfae', margin: '8px 0' }} />
          <div style={{
            padding: '4px 6px',
            background: stage >= 2 ? 'oklch(0.52 0.085 95 / 0.18)' : 'transparent',
            transition: 'background 0.6s',
            margin: '0 -6px',
            borderRadius: 2,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>H 20%</span><span>TTC {ticket.h.ttc}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#6a6258' }}>
              <span>HT {ticket.h.ht}</span><span>TVA {ticket.h.tva}</span>
            </div>
          </div>
        </>
      )}

      {ticket.q && (
        <div style={{ marginTop: 4, opacity: 0.55 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Q 20%</span><span>TTC {ticket.q.ttc}</span>
          </div>
        </div>
      )}

      {ticket.cb && (
        <>
          <div style={{ borderTop: '1px dashed #c8bfae', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total CB</span><span>{ticket.cb} €</span>
          </div>
        </>
      )}

      {ticket.rejected && (
        <div style={{
          marginTop: 8,
          padding: 6,
          background: 'oklch(0.48 0.14 30 / 0.12)',
          color: 'oklch(0.42 0.14 30)',
          fontSize: 9,
          textAlign: 'center',
          fontWeight: 700,
        }}>
          ABANDON DÉBIT
        </div>
      )}

      <div style={{ borderTop: '1px dashed #c8bfae', margin: '8px 0' }} />
      <div style={{ textAlign: 'center', fontSize: 8, color: '#9a9082' }}>
        ★ MERCI DE VOTRE VISITE ★
      </div>
    </div>
  );
}

function ExtractionPanel({ ticket, stage }) {
  if (stage < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 14, background: 'var(--bg-3)', borderRadius: 4, width: `${50 + (i * 8) % 40}%` }} />
        ))}
      </div>
    );
  }

  if (ticket.extracted.rejected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'float-in 0.5s var(--ease)' }}>
        <div style={{
          padding: 16,
          border: '1px solid oklch(0.48 0.14 30 / 0.3)',
          background: 'var(--rust-soft)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width={16} height={16} viewBox="0 0 16 16"><circle cx={8} cy={8} r={7} stroke="oklch(0.48 0.14 30)" strokeWidth={1.4} fill="none" /><path d="M5 5 L11 11 M11 5 L5 11" stroke="oklch(0.48 0.14 30)" strokeWidth={1.4} /></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust)' }}>Transaction abandonnée</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            Marqueurs détectés : « TRANSACTION REFUSÉE », « ABANDON DÉBIT ».
            Ce ticket ne représente aucune dépense réelle — exclu du journal.
          </p>
        </div>
      </div>
    );
  }

  const fields = [
    { k: 'date', v: ticket.date, mono: true },
    { k: 'fournisseur', v: ticket.vendor },
    { k: 'type', v: ticket.extracted.type, badge: true },
    { k: 'montant_ttc', v: `${ticket.extracted.ttc} €`, mono: true, hl: true },
    { k: 'montant_ht', v: `${ticket.extracted.ht} €`, mono: true },
    { k: 'montant_tva', v: `${ticket.extracted.tva} €`, mono: true },
    { k: 'confidence', v: ticket.extracted.confidence.toFixed(2), mono: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, animation: 'float-in 0.5s var(--ease)' }}>
      {fields.map((f, i) => (
        <div key={f.k} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
          borderRadius: 6,
          background: f.hl ? 'var(--accent-soft)' : 'transparent',
          animation: `float-in 0.5s var(--ease) ${i * 0.06}s both`,
        }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {f.k}
          </span>
          {f.badge ? (
            <span className="badge badge-accent">{f.v}</span>
          ) : (
            <span style={{
              fontSize: 14,
              fontFamily: f.mono ? "'JetBrains Mono', monospace" : 'inherit',
              fontWeight: f.hl ? 700 : 500,
              color: f.hl ? 'var(--accent)' : 'var(--text)',
            }}>{f.v}</span>
          )}
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '10px 12px', fontSize: 11, color: 'var(--text-mute)', borderTop: '1px solid var(--line-soft)', fontStyle: 'italic' }}>
        ↳ {ticket.extracted.note}
      </div>
    </div>
  );
}

function ExcelGrid({ stage, ticket, activeIndex }) {
  const cols = ['Date', 'Fournisseur', 'Type', 'TTC', 'HT', 'TVA', 'Confiance'];
  const colWidths = [88, 130, 84, 78, 70, 70, 80];

  const baseRows = [
    { date: '12/03/2026', vendor: 'VINCI A11', type: 'peage', ttc: '18,40', ht: '15,33', tva: '3,07', conf: '0,98' },
    { date: '13/03/2026', vendor: 'L\'Atelier Bistro', type: 'repas', ttc: '42,50', ht: '38,64', tva: '3,86', conf: '0,95' },
  ];

  const newRow = !ticket.rejected ? {
    date: ticket.date,
    vendor: ticket.vendor,
    type: ticket.extracted.type,
    ttc: ticket.extracted.ttc,
    ht: ticket.extracted.ht,
    tva: ticket.extracted.tva,
    conf: ticket.extracted.confidence.toFixed(2).replace('.', ','),
  } : null;

  return (
    <div style={{ flex: 1, overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: colWidths.map(w => `${w}px`).join(' '), borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        {cols.map((c, i) => (
          <div key={c} style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: i < cols.length - 1 ? '1px solid var(--line)' : 'none' }}>
            {c}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {baseRows.map((r, ri) => (
        <ExcelRow key={ri} row={r} colWidths={colWidths} />
      ))}

      {/* New row — appears at stage 3 */}
      {stage === 3 && newRow && (
        <div key={activeIndex} style={{
          animation: 'float-in 0.7s var(--ease)',
        }}>
          <ExcelRow row={newRow} colWidths={colWidths} highlight />
        </div>
      )}

      {stage === 3 && ticket.rejected && (
        <div style={{
          padding: '12px 16px',
          fontSize: 11,
          color: 'var(--rust)',
          fontStyle: 'italic',
          animation: 'float-in 0.5s var(--ease)',
          borderTop: '1px dashed var(--line)',
          background: 'var(--rust-soft)',
        }}>
          → ticket #{activeIndex + 1} ignoré (abandon débit)
        </div>
      )}

      {/* Empty rows */}
      {[1, 2, 3, 4, 5].map(i => (
        <div key={`e${i}`} style={{
          display: 'grid',
          gridTemplateColumns: colWidths.map(w => `${w}px`).join(' '),
          height: 36,
          borderBottom: '1px solid var(--line-soft)',
        }}>
          {colWidths.map((_, ci) => (
            <div key={ci} style={{ borderRight: ci < colWidths.length - 1 ? '1px solid var(--line-soft)' : 'none' }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ExcelRow({ row, colWidths, highlight }) {
  const cells = [row.date, row.vendor, row.type, row.ttc + ' €', row.ht + ' €', row.tva + ' €', row.conf];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: colWidths.map(w => `${w}px`).join(' '),
      borderBottom: '1px solid var(--line-soft)',
      animation: highlight ? 'highlight-fade 2.4s var(--ease) forwards' : 'none',
    }}>
      {cells.map((c, ci) => (
        <div key={ci} style={{
          padding: '10px 12px',
          borderRight: ci < cells.length - 1 ? '1px solid var(--line-soft)' : 'none',
          fontSize: 12,
          color: ci === 3 && highlight ? 'var(--accent)' : 'var(--text)',
          fontWeight: ci === 3 && highlight ? 700 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {c}
        </div>
      ))}
    </div>
  );
}

window.LiveDemo = LiveDemo;
