import React from 'react';

export default function OceanBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden ocean-bg">
      {/* Deep Ocean Depth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0d0a]/90 via-[#0a1210]/95 to-[#050807] opacity-90" />

      {/* Floating Lights / Water Reflection */}
      <div className="absolute inset-0">
        <div className="water-light-1 absolute top-[20%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-[#22d3ee] blur-[120px] opacity-[0.03] mix-blend-screen" />
        <div className="water-light-2 absolute top-[60%] left-[70%] w-[50vw] h-[50vw] rounded-full bg-[#10b981] blur-[150px] opacity-[0.02] mix-blend-screen" />
        <div className="water-light-3 absolute top-[40%] left-[10%] w-[35vw] h-[35vw] rounded-full bg-[#0ea5e9] blur-[100px] opacity-[0.02] mix-blend-screen" />
      </div>

      {/* Animated SVG Waves */}
      <div className="absolute bottom-0 w-full h-[60vh] opacity-[0.12] flex items-end">
        <svg
          className="absolute w-[200%] h-full wave-layer-1"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#0ea5e9"
            fillOpacity="1"
            d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>

        <svg
          className="absolute w-[250%] h-[85%] wave-layer-2"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#10b981"
            fillOpacity="0.8"
            d="M0,96L60,112C120,128,240,160,360,160C480,160,600,128,720,112C840,96,960,96,1080,112C1200,128,1320,160,1380,176L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          ></path>
        </svg>

        <svg
          className="absolute w-[300%] h-[70%] wave-layer-3"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#22d3ee"
            fillOpacity="0.6"
            d="M0,256L48,229.3C96,203,192,149,288,154.7C384,160,480,224,576,218.7C672,213,768,139,864,128C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>

        <svg
          className="absolute w-[220%] h-[50%] wave-layer-4"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#064e3b"
            fillOpacity="0.9"
            d="M0,64L48,85.3C96,107,192,149,288,160C384,171,480,149,576,122.7C672,96,768,64,864,80C960,96,1056,160,1152,170.7C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          ></path>
        </svg>
      </div>
    </div>
  );
}
