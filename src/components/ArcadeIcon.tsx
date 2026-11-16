export type ArcadeIconName =
  | "today" | "discover" | "statistics" | "friends" | "account"
  | "search" | "bell" | "back" | "paste" | "check" | "arrow"
  | "spark" | "info" | "edit" | "clock";

export function ArcadeIcon({
  name,
  size = 22,
}: {
  name: ArcadeIconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: false as const,
  };
  switch (name) {
    case "today":
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 9h18"/><path d="m8 15 2 2 5-5"/></svg>;
    case "discover":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>;
    case "statistics":
      return <svg {...common}><path d="M4 20V13M10 20V5M16 20v-9M22 20V8"/><path d="M2 20h22"/></svg>;
    case "friends":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "account":
      return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case "search":
      return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>;
    case "back":
      return <svg {...common}><path d="m14 18-6-6 6-6"/></svg>;
    case "paste":
      return <svg {...common}><rect x="5" y="5" width="14" height="17" rx="2"/><path d="M9 5a3 3 0 0 1 6 0M9 12h6M9 16h5"/></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
    case "spark":
      return <svg {...common}><path d="m12 2 2.3 6.7L21 11l-6.7 2.3L12 20l-2.3-6.7L3 11l6.7-2.3L12 2ZM20 19v4M18 21h4"/></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>;
    case "edit":
      return <svg {...common}><path d="m3 17 11-11 4 4-11 11H3v-4ZM12 8l4 4"/></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  }
}
