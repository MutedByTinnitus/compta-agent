// Editorial pull-quote — Endex-style dark section
function Manifesto() {
  return (
    <section style={{
      padding: '160px 0',
      background: '#0d1c1b',
      color: '#f5f9f8',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'relative',
      overflow: 'hidden',
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
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 50% 60% at 20% 50%, rgba(0,229,180,0.08), transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 64px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 56 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#00e5b4', textTransform: 'uppercase', letterSpacing: '0.14em', paddingTop: 6 }}>
            —Manifeste
          </span>
        </div>

        <p className="font-display" style={{
          fontSize: 'clamp(40px, 5.5vw, 76px)',
          lineHeight: 1.1,
          letterSpacing: '-0.015em',
          margin: '0 0 72px',
          fontWeight: 400,
          color: '#f5f9f8',
          maxWidth: 1000,
        }}>
          La compta de frais, c'est <em style={{ color: '#00e5b4', fontStyle: 'italic' }}>2 % de stratégie</em> et 98 %
          de transcription.{' '}
          <span style={{ color: 'rgba(245,249,248,0.45)' }}>Enop prend les 98 %. Vous gardez ce qui compte.</span>
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: 'rgba(0,229,180,0.15)',
            border: '1px solid rgba(0,229,180,0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 18,
            color: '#00e5b4',
          }}>
            J
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f5f9f8' }}>Jean P.</div>
            <div style={{ fontSize: 12, color: 'rgba(245,249,248,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
              Fondateur · Enop
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.Manifesto = Manifesto;
