interface IllustrationProps {
  className?: string;
}

/**
 * Welcome page illustration: Chinese ink landscape (山水画).
 * Ethereal mountains, water, a small boat, and flying birds.
 * Evokes "轻墨" (light ink) — the Verso aesthetic.
 */
export function WelcomeIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Moon */}
      <circle cx="190" cy="32" r="16" fill="currentColor" opacity="0.05" />

      {/* Far mountains — most ethereal */}
      <path
        d="M-10 118 C20 96 48 102 72 108 C88 78 112 72 132 92 C148 76 170 70 192 88 C206 80 224 86 250 118"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.12"
        fill="currentColor"
        fillOpacity="0.02"
      />

      {/* Mid mountains */}
      <path
        d="M-10 124 C28 98 54 106 78 114 C98 86 122 80 148 98 C164 88 184 84 214 106 C228 96 242 104 250 124"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.2"
        fill="currentColor"
        fillOpacity="0.04"
      />

      {/* Near mountain — most prominent */}
      <path
        d="M8 130 C38 104 66 112 92 120 C108 98 128 92 154 113 C168 103 184 106 214 130"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.32"
        fill="currentColor"
        fillOpacity="0.05"
      />

      {/* Water line */}
      <path
        d="M-10 133 C32 128 82 135 122 130 C162 125 202 132 250 128"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.15"
      />

      {/* Fishing boat */}
      <path
        d="M113 138 Q119 130 125 138"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.28"
        strokeLinecap="round"
        fill="none"
      />
      {/* Mast */}
      <line
        x1="119"
        y1="130"
        x2="119"
        y2="120"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.22"
      />

      {/* Water ripples */}
      <path
        d="M102 144 Q108 142 114 144"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.08"
        fill="none"
      />
      <path
        d="M130 142 Q134 140 138 142"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.06"
        fill="none"
      />
      <path
        d="M87 148 Q92 146 97 148"
        stroke="currentColor"
        strokeWidth="0.3"
        opacity="0.05"
        fill="none"
      />

      {/* Flying birds */}
      <path
        d="M160 40 Q163 36 166 40"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.16"
        fill="none"
      />
      <path
        d="M174 33 Q176 30 178 33"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.12"
        fill="none"
      />
      <path
        d="M167 28 Q169 26 171 28"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
        fill="none"
      />
    </svg>
  );
}

/**
 * Empty-state illustration: Chinese ink bamboo (墨竹).
 * Two bamboo stalks with brush-stroke leaves.
 * Minimal, contemplative — the moment before writing.
 */
export function EmptyStateIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 180"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Main bamboo stalk */}
      <path
        d="M108 175 C107 155 106 135 105 115 C104 95 103 75 102 55 C101 40 100 28 99 18"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.32"
        strokeLinecap="round"
      />

      {/* Second thinner stalk — background depth */}
      <path
        d="M132 175 C131 158 130 140 129 120 C128 100 127 80 126 60 C125 45 124 35 124 28"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.15"
        strokeLinecap="round"
      />

      {/* Nodes on main stalk */}
      <line x1="103" y1="55" x2="107" y2="55" stroke="currentColor" strokeWidth="1.2" opacity="0.26" />
      <line x1="104" y1="95" x2="108" y2="95" stroke="currentColor" strokeWidth="1.2" opacity="0.22" />
      <line x1="105" y1="135" x2="109" y2="135" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />

      {/* Nodes on second stalk */}
      <line x1="127" y1="70" x2="130" y2="70" stroke="currentColor" strokeWidth="0.8" opacity="0.12" />
      <line x1="128" y1="110" x2="131" y2="110" stroke="currentColor" strokeWidth="0.8" opacity="0.1" />

      {/* === Leaves as filled brush-stroke shapes === */}

      {/* Top cluster */}
      <path d="M100 22 Q84 14 66 20 Q84 24 100 28" fill="currentColor" opacity="0.24" />
      <path d="M100 25 Q114 13 132 17 Q114 22 100 30" fill="currentColor" opacity="0.19" />
      <path d="M99 20 Q91 9 78 7 Q91 14 99 24" fill="currentColor" opacity="0.16" />

      {/* Middle cluster — first node */}
      <path d="M103 52 Q85 41 63 47 Q85 52 103 58" fill="currentColor" opacity="0.22" />
      <path d="M104 55 Q89 61 70 55 Q89 53 104 50" fill="currentColor" opacity="0.16" />
      <path d="M105 53 Q120 41 140 45 Q120 50 105 58" fill="currentColor" opacity="0.19" />

      {/* Middle cluster — second node */}
      <path d="M104 92 Q87 82 66 87 Q87 93 104 98" fill="currentColor" opacity="0.19" />
      <path d="M105 96 Q122 85 142 89 Q122 94 105 100" fill="currentColor" opacity="0.16" />

      {/* Lower leaf */}
      <path d="M106 132 Q91 123 73 127 Q91 133 106 138" fill="currentColor" opacity="0.15" />

      {/* Leaves on second stalk */}
      <path d="M126 67 Q140 57 154 61 Q140 66 126 72" fill="currentColor" opacity="0.11" />
      <path d="M127 108 Q114 99 98 103 Q114 108 127 114" fill="currentColor" opacity="0.11" />

      {/* Ground shadow */}
      <ellipse cx="116" cy="178" rx="28" ry="2" fill="currentColor" opacity="0.04" />
    </svg>
  );
}
