import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const stroke = (props: P) => ({
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export function IconWhatsapp(props: P) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export const IconMail = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7.5 8 6 8-6" />
  </svg>
);
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...stroke(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />
  </svg>
);
export const IconBag = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...stroke(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...stroke(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 15V4m0 0L8 8m4-4 4 4" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
    <path d="M5 19h14" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7" />
  </svg>
);
export const IconDuplicate = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="4.5" y="4.5" width="11" height="11" rx="2" />
    <path d="M8.5 19.5h9a2 2 0 0 0 2-2v-9" />
  </svg>
);
export const IconEdit = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M5 19h3.5L19 8.5 15.5 5 5 15.5V19Z" />
    <path d="m13.5 7 3.5 3.5" />
  </svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M5 12h14m0 0-5-5m5 5-5 5" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconRuler = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M3 8v8M21 8v8M3 12h18" />
    <path d="M8 10.5v3M12 10v4M16 10.5v3" />
  </svg>
);
export const IconLayers = (p: P) => (
  <svg {...stroke(p)}>
    <path d="m12 4 8 4.2-8 4.2-8-4.2L12 4Z" />
    <path d="m4 12.2 8 4.2 8-4.2M4 16l8 4.2 8-4.2" />
  </svg>
);
export const IconPalette = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.7 2-1.7h1.6a3.9 3.9 0 0 0 3.9-3.9c0-3.9-3.8-6.9-8.5-6.9Z" />
    <circle cx="8" cy="11" r="1" />
    <circle cx="11" cy="7.5" r="1" />
    <circle cx="15.5" cy="8.5" r="1" />
  </svg>
);
export const IconGrid = (p: P) => (
  <svg {...stroke(p)}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M10 4v16M15 4v16M4 12h6" />
  </svg>
);
export const IconBulb = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3.5a5.5 5.5 0 0 0-3.4 9.8c.6.5.9 1.1.9 1.9h5c0-.8.3-1.4.9-1.9A5.5 5.5 0 0 0 12 3.5Z" />
  </svg>
);
export const IconDecor = (p: P) => (
  <svg {...stroke(p)}>
    <path d="M12 3.5c-3 2.4-4.5 4.6-4.5 6.6a4.5 4.5 0 0 0 9 0c0-2-1.5-4.2-4.5-6.6Z" />
    <path d="M12 14.6V20.5M8.5 20.5h7" />
  </svg>
);
