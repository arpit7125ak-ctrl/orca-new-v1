const fs = require('fs');
const css = `
@layer utilities {
  @media (prefers-reduced-motion: no-preference) {
    .ocean-bg {
      animation: fadeInOcean 2s ease-out forwards;
    }
    
    .wave-layer-1 {
      animation: waveDrift 45s linear infinite alternate;
    }
    
    .wave-layer-2 {
      animation: waveDrift2 60s linear infinite alternate;
    }
    
    .wave-layer-3 {
      animation: waveDrift 75s linear infinite alternate;
    }

    .wave-layer-4 {
      animation: waveDrift2 90s linear infinite alternate;
    }

    .water-light-1 {
      animation: floatLight 18s ease-in-out infinite alternate;
    }
    
    .water-light-2 {
      animation: floatLight2 25s ease-in-out infinite alternate;
    }
    
    .water-light-3 {
      animation: floatLight 22s ease-in-out infinite alternate;
    }

    .card-enter {
      animation: cardFadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(8px);
    }
    
    .card-enter-1 { animation-delay: 0ms; }
    .card-enter-2 { animation-delay: 50ms; }
    .card-enter-3 { animation-delay: 100ms; }
    .card-enter-4 { animation-delay: 150ms; }
    
    .pulse-live {
      animation: livePulse 2s ease-in-out infinite;
    }

    .page-transition {
      animation: pageEnter 250ms ease-out forwards;
    }
  }

  @keyframes fadeInOcean {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes waveDrift {
    0% { transform: translateX(0%); }
    100% { transform: translateX(-25%); }
  }

  @keyframes waveDrift2 {
    0% { transform: translateX(-25%); }
    100% { transform: translateX(0%); }
  }

  @keyframes floatLight {
    0% { transform: translate(0, 0) scale(1); opacity: 0.02; }
    50% { transform: translate(5%, 10%) scale(1.1); opacity: 0.04; }
    100% { transform: translate(-5%, -5%) scale(0.9); opacity: 0.01; }
  }

  @keyframes floatLight2 {
    0% { transform: translate(0, 0) scale(0.9); opacity: 0.01; }
    50% { transform: translate(-10%, -5%) scale(1.05); opacity: 0.03; }
    100% { transform: translate(5%, 10%) scale(1); opacity: 0.02; }
  }

  @keyframes cardFadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes livePulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Hover effect for cards */
  .interactive-card {
    transition: transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease;
  }
  
  @media (prefers-reduced-motion: no-preference) {
    .interactive-card:hover {
      transform: translateY(-1px);
      border-color: rgba(46, 204, 113, 0.25); /* Subtle ocean border */
    }
  }
}
`;
fs.appendFileSync('src/index.css', css);
