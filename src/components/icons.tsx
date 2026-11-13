/** iconos de trazo, dibujados acá para que todos tengan el mismo grosor */

type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const IconFront = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="3.5" width="14" height="17" rx="1.2" />
    <path d="M12 3.5v17M10 11v2M14 11v2" />
  </svg>
);
export const IconThree = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
    <path d="M12 11v9M4 7.5 12 11l8-3.5" />
  </svg>
);
export const IconSide = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <rect x="8" y="3.5" width="8" height="17" rx="1" />
    <path d="M16 6h2.5M16 18h2.5" />
  </svg>
);
export const IconTop = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="8" width="17" height="8" rx="1" />
    <path d="M9 8v8M15 8v8" />
  </svg>
);
export const IconBack = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 7 5 11l4 4" />
    <path d="M5 11h9a5 5 0 0 1 0 10h-2" />
  </svg>
);
export const IconDoor = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 20V4h9v16" />
    <path d="M14 4l5 2v16l-5-2" />
    <path d="M16.5 12v1.5" />
  </svg>
);
export const IconXray = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <rect x="4" y="3.5" width="16" height="17" rx="1.2" strokeDasharray="2.5 2.5" />
    <path d="M7 9h10M7 14h10" />
  </svg>
);
export const IconExplode = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx=".8" />
  </svg>
);
export const IconBulb = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 17h6M10 20h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z" />
  </svg>
);
export const IconCheck = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconCamera = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.6" r="3.4" />
  </svg>
);
