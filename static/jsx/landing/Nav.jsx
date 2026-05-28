// Sticky top navigation — Enop, transparent over hero video
function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    zIndex: 50,
    padding: scrolled ? '14px 0' : '22px 0',
    background: scrolled ? 'oklch(0.14 0.014 175 / 0.7)' : 'transparent',
    backdropFilter: scrolled ? 'blur(16px) saturate(1.4)' : 'none',
    WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(1.4)' : 'none',
    borderBottom: scrolled ? '1px solid oklch(1 0 0 / 0.06)' : '1px solid transparent',
    transition: 'all 0.4s var(--ease)',
  };

  const inner = {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  };

  const linkStyle = {
    padding: '8px 16px',
    color: 'oklch(0.85 0.012 170)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 400,
    transition: 'color 0.2s',
  };

  return (
    <nav style={navStyle}>
      <div style={inner}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text)' }}>
          <img src="logo-enop.svg" alt="" width={22} height={22} />
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, letterSpacing: '-0.01em' }}>
            Enop
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { l: 'Sécurité', h: '#produit' },
            { l: 'Carrières', h: '#' },
            { l: 'Cabinet', h: '#tarifs' },
            { l: 'Blog', h: '#' },
          ].map(item => (
            <a key={item.l} href={item.h} style={linkStyle}
               onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
               onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.85 0.012 170)'}>
              {item.l}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/login" style={{ ...linkStyle, fontSize: 13 }}
             onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
             onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.85 0.012 170)'}>
            Se connecter
          </a>
          <a href="/signup" style={{
            ...linkStyle,
            padding: '9px 18px',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: '1px solid var(--accent)',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 500,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.borderColor = 'var(--accent-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}>
            Créer un compte
          </a>
        </div>
      </div>
    </nav>
  );
}

window.Nav = Nav;
