// Landing page — composition des sections (TweaksPanel retiré pour la prod)

function App() {
  return (
    <div>
      <Nav />
      <Hero />
      <LogosMarquee />
      <LiveDemo />
      <Manifesto />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
