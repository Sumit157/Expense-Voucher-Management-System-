/**
 * Decorative expense-management illustration: receipt, analytics chart,
 * botanical accents and a rupee badge in brand greens. Purely ornamental.
 */
export function AuthIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Soft backdrop blob */}
      <ellipse cx="210" cy="215" rx="170" ry="165" fill="currentColor" opacity="0.14" />

      {/* Botanical: back leaf cluster (top) */}
      <g opacity="0.85">
        <path
          d="M258 62c22 28 18 62-6 84-18 16-42 20-58 12 8-30 30-62 64-96Z"
          fill="#19A974"
          opacity="0.55"
        />
        <path
          d="M258 62c-30 14-52 44-58 96"
          stroke="#087653"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M166 96c26 8 44 32 46 62 2 22-6 42-20 52-16-24-28-62-26-114Z"
          fill="#7FC9A6"
          opacity="0.6"
        />
        <path d="M166 96c8 34 12 76 0 114" stroke="#087653" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      </g>

      {/* Botanical: side fronds (left) */}
      <g opacity="0.7">
        <path
          d="M92 210c30-6 58 8 70 34 10 20 8 44-2 58-26-8-52-32-68-92Z"
          fill="#19A974"
          opacity="0.4"
        />
        <path d="M92 210c18 22 34 58 68 92" stroke="#087653" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        <path
          d="M118 320c22-14 34-40 30-68-4-22-18-38-32-42-8 28-8 68 2 110Z"
          fill="#7FC9A6"
          opacity="0.55"
        />
      </g>

      {/* Botanical: right sprig */}
      <g opacity="0.75">
        <path
          d="M348 240c-26 2-48 22-54 48-6 22 2 44 16 54 22-16 38-52 38-102Z"
          fill="#19A974"
          opacity="0.45"
        />
        <path d="M348 240c-14 26-28 64-38 102" stroke="#087653" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <path
          d="M330 150c18 12 28 34 24 56-4 18-18 32-32 34-4-24 0-56 8-90Z"
          fill="#7FC9A6"
          opacity="0.5"
        />
      </g>

      {/* Analytics card (behind, offset) */}
      <g>
        <rect x="196" y="206" width="150" height="118" rx="14" fill="#F4F2EA" />
        <rect
          x="196"
          y="206"
          width="150"
          height="118"
          rx="14"
          stroke="#D8E5DC"
          strokeWidth="2"
        />
        <rect x="214" y="284" width="18" height="24" rx="4" fill="#7FC9A6" />
        <rect x="242" y="266" width="18" height="42" rx="4" fill="#19A974" />
        <rect x="270" y="248" width="18" height="60" rx="4" fill="#087653" />
        <rect x="298" y="258" width="18" height="50" rx="4" fill="#19A974" opacity="0.7" />
        <rect x="214" y="226" width="64" height="8" rx="4" fill="#D8E5DC" />
      </g>

      {/* Receipt (front) */}
      <g>
        <path
          d="M136 96h116a10 10 0 0 1 10 10v188l-14-10-14 10-14-10-14 10-14-10-14 10-14-10-14 10-14-10V106a10 10 0 0 1 10-10Z"
          fill="#FFFFFF"
        />
        <path
          d="M136 96h116a10 10 0 0 1 10 10v188l-14-10-14 10-14-10-14 10-14-10-14 10-14-10-14 10-14-10V106a10 10 0 0 1 10-10Z"
          stroke="#D8E5DC"
          strokeWidth="2.5"
        />
        <rect x="156" y="124" width="76" height="10" rx="5" fill="#0F6B4D" opacity="0.85" />
        <rect x="156" y="148" width="92" height="7" rx="3.5" fill="#C9D6CE" />
        <rect x="156" y="164" width="84" height="7" rx="3.5" fill="#C9D6CE" />
        <rect x="156" y="180" width="92" height="7" rx="3.5" fill="#C9D6CE" />
        <rect x="156" y="196" width="60" height="7" rx="3.5" fill="#C9D6CE" />
        <rect x="156" y="222" width="48" height="8" rx="4" fill="#19A974" opacity="0.6" />
        <rect x="156" y="244" width="92" height="7" rx="3.5" fill="#C9D6CE" />
        <rect x="156" y="260" width="72" height="7" rx="3.5" fill="#C9D6CE" />
      </g>

      {/* Rupee badge */}
      <g>
        <circle cx="296" cy="168" r="34" fill="#0F6B4D" />
        <circle cx="296" cy="168" r="34" stroke="#087653" strokeWidth="2" />
        <text
          x="296"
          y="180"
          textAnchor="middle"
          fontSize="34"
          fontWeight="700"
          fill="#FFFFFF"
          fontFamily="Georgia, serif"
        >
          ₹
        </text>
      </g>
    </svg>
  );
}
