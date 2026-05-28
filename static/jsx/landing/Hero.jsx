// Hero with video background, transparent nav overlay
function Hero({ tweaks }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll('.h-stagger');
    els.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `opacity 1.1s var(--ease) ${0.3 + i * 0.14}s, transform 1.1s var(--ease) ${0.3 + i * 0.14}s`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }));
    });
  }, []);

  return (
    <section ref={ref} style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 96,
      paddingBottom: 0,
      overflow: 'hidden',
      color: 'var(--text)',
    }}>
      {/* Video background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: 'oklch(0.1 0.014 175)' }}>
        <video
          autoPlay loop muted playsInline
          poster=""
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: '100%', minHeight: '100%',
            width: 'auto', height: 'auto',
            objectFit: 'cover',
            opacity: 0.55,
            filter: 'saturate(0.7) contrast(1.05)',
          }}>
          {/* Drop your video file here, e.g. background.mp4 */}
          <source src="background.mp4" type="video/mp4" />
        </video>

        {/* Fallback gradient pattern (visible if video missing) */}
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.28 0.06 175 / 0.6), transparent 60%),' +
            'linear-gradient(180deg, oklch(0.14 0.014 175) 0%, oklch(0.18 0.022 175) 50%, oklch(0.12 0.014 175) 100%)',
        }} />

        {/* Vignettes for legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(180deg, oklch(0.14 0.014 175 / 0.55) 0%, oklch(0.14 0.014 175 / 0.2) 30%, oklch(0.14 0.014 175 / 0.5) 70%, oklch(0.14 0.014 175 / 0.95) 100%)',
        }} />

        {/* Subtle grid overlay (matches login aside) */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.45,
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), ' +
            'linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Top-left page ID marker (Endex-style) */}
      <div style={{
        position: 'absolute', top: 86, left: 32, zIndex: 2,
        fontSize: 11, color: 'var(--accent)',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1 L8 5 L2 9 Z" fill="var(--accent)" /></svg>
        <span style={{ color: 'var(--text-mute)' }}>1</span>
      </div>

      {/* Center content */}
      <div style={{ maxWidth: 1100, width: '100%', padding: '0 32px', position: 'relative', zIndex: 2, textAlign: 'center' }}>
        {/* Announcement bar */}
        <div className="h-stagger" style={{ marginBottom: 56 }}>
          <a href="#" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            textDecoration: 'none',
            padding: '8px 0',
          }}>
            <span style={{ width: 28, height: 1, background: 'currentColor', opacity: 0.5 }} />
            Annonce — levée de 4M€ avec Bpifrance
            <span style={{ opacity: 0.6 }}>↗</span>
            <span style={{ width: 28, height: 1, background: 'currentColor', opacity: 0.5 }} />
          </a>
        </div>

        {/* Headline */}
        <h1 className="h-stagger font-display" style={{
          fontSize: 'clamp(56px, 9vw, 128px)',
          lineHeight: 1.0,
          letterSpacing: '-0.025em',
          margin: '0 0 56px',
          fontWeight: 400,
        }}>
          IA Conçue Pour <span className="italic-serif" style={{ color: 'var(--accent)' }}>la</span> Compta
        </h1>

        {/* Email capture → redirige vers /signup avec l'email pré-rempli */}
        <form className="h-stagger"
              action="/signup"
              method="GET"
              style={{
                display: 'flex',
                gap: 0,
                maxWidth: 460,
                margin: '0 auto 24px',
                padding: 6,
                background: 'oklch(0.16 0.018 175 / 0.55)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid oklch(1 0 0 / 0.08)',
                borderRadius: 4,
              }}>
          <input
            type="email"
            name="email"
            placeholder="Email professionnel"
            required
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button type="submit" style={{
            padding: '12px 24px',
            background: 'oklch(0.97 0.008 170)',
            color: 'oklch(0.16 0.018 175)',
            border: 'none',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'oklch(0.97 0.008 170)'}>
            Créer mon compte
          </button>
        </form>

        <div className="h-stagger" style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 40, fontFamily: "'JetBrains Mono', monospace" }}>
          accès anticipé · écrivez à <a href="mailto:hello@enop.ai" style={{ color: 'var(--text-dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>hello@enop.ai</a>
        </div>

        <p className="h-stagger" style={{
          fontSize: 18,
          color: 'var(--text-dim)',
          margin: '0 auto 80px',
          maxWidth: 640,
          lineHeight: 1.55,
        }}>
          Un agent IA qui scanne vos tickets de frais, extrait le bon montant TTC et écrit votre journal comptable — sans une seule saisie manuelle.
        </p>

        <div className="h-stagger" style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          marginBottom: 24,
        }}>
          Déployé chez les plus grandes structures comptables
        </div>
      </div>

      {/* Bottom logo strip — full bleed */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%',
        borderTop: '1px solid oklch(1 0 0 / 0.08)',
        padding: '20px 0',
        background: 'oklch(0.1 0.014 175 / 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: 24,
          padding: '0 32px',
          fontSize: 10.5,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          flexWrap: 'wrap',
        }}>
          <span>240+ Cabinets D'expertise</span>
          <span>500 PME Industrielles</span>
          <span>Groupes Logistiques</span>
          <span>Chaînes De Restaurants</span>
          <span>Flottes Auto</span>
          <span>5M+ Tickets Traités</span>
        </div>
      </div>
    </section>
  );
}

window.Hero = Hero;
