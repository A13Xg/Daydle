import type { RefObject, ReactNode } from "react";
import { ArcadeIcon, type ArcadeIconName } from "./ArcadeIcon";

export type ShellKind = "tab" | "stack" | "blank";
const TABS: ReadonlyArray<{
  href: string;
  label: string;
  icon: ArcadeIconName;
}> = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/games", label: "Discover", icon: "discover" },
  { href: "/statistics", label: "Statistics", icon: "statistics" },
  { href: "/friends", label: "Friends", icon: "friends" },
  { href: "/account", label: "Account", icon: "account" },
];

export function shellForPath(pathname: string): ShellKind {
  if (pathname === "/auth" || pathname === "/auth/callback") return "blank";
  if (
    pathname === "/lineup" ||
    pathname === "/history" ||
    pathname === "/notifications" ||
    pathname === "/how-it-works" ||
    /^\/games\/[a-z0-9-]+\/?$/.test(pathname)
  )
    return "stack";
  return "tab";
}

export function selectedTab(pathname: string): string | null {
  if (pathname === "/" || pathname === "/today") return "/today";
  if (pathname === "/games" || pathname.startsWith("/games/")) return "/games";
  return TABS.some((tab) => tab.href === pathname) ? pathname : null;
}

export function stackTitle(pathname: string): string {
  if (pathname === "/lineup") return "Edit lineup";
  if (pathname === "/history") return "Result history";
  if (pathname === "/notifications") return "Notifications";
  if (pathname === "/how-it-works") return "How it works";
  if (pathname.startsWith("/games/")) return "Game details";
  return "Daydle";
}

export function stackBackPath(pathname: string): string {
  if (pathname === "/lineup" || pathname === "/how-it-works" || pathname === "/history") return "/today";
  if (pathname.startsWith("/games/")) return "/games";
  return "/today";
}

export function ArcadeHeader({
  pathname,
  signedIn,
  onPaste,
  pasteTrigger,
}: {
  pathname: string;
  signedIn: boolean;
  onPaste: () => void;
  pasteTrigger: RefObject<HTMLButtonElement | null>;
}) {
  const kind = shellForPath(pathname);
  if (kind === "blank") return null;
  if (kind === "stack") {
    return (
      <header className="arcade-topbar stack-topbar">
        <div className="topbar-inner">
          <a
            href={stackBackPath(pathname)}
            className="icon-button"
            aria-label="Go back"
          >
            <ArcadeIcon name="back" />
          </a>
          <span className="stack-title">{stackTitle(pathname)}</span>
          <button
            type="button"
            className="icon-button"
            onClick={onPaste}
            ref={pasteTrigger}
            aria-label="Paste Results"
          >
            <ArcadeIcon name="paste" />
          </button>
        </div>
      </header>
    );
  }
  return (
    <header className="arcade-topbar">
      <div className="topbar-inner">
        <a className="brand" href="/today" aria-label="Daydle — Today">
          <img
            className="brand-mark"
            src="/arcade-emblem.svg"
            alt=""
            width="35"
            height="35"
          />
          <span className="brand-name">Daydle</span>
          <span className="brand-badge">ARCADE</span>
        </a>
        <div className="topbar-actions">
          <a
            className="icon-button"
            href="/games#catalog-search"
            aria-label="Search games"
          >
            <ArcadeIcon name="search" />
          </a>
          <a
            className="icon-button"
            href="/notifications"
            aria-label="Notifications (not yet available)"
          >
            <ArcadeIcon name="bell" />
          </a>
          <a
            className="icon-button profile-action"
            href={signedIn ? "/account" : "/auth"}
            aria-label={signedIn ? "My account" : "Sign in"}
          >
            <ArcadeIcon name="account" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function ArcadeTabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="arcade-tabbar" aria-label="Primary navigation">
      <div className="tabbar-inner">
        {TABS.map(({ href, label, icon }) => (
          <a
            key={href}
            href={href}
            className="tabbar-link"
            aria-current={selectedTab(pathname) === href ? "page" : undefined}
          >
            <ArcadeIcon name={icon} size={22} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export function ArcadePasteAction({
  onPaste,
  pasteTrigger,
}: {
  onPaste: () => void;
  pasteTrigger: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      type="button"
      className="paste-global"
      onClick={onPaste}
      ref={pasteTrigger}
    >
      <ArcadeIcon name="paste" size={20} />
      <span>Paste Results</span>
    </button>
  );
}

export function ArcadeBlank({ children }: { children: ReactNode }) {
  return <div className="blank-content">{children}</div>;
}
