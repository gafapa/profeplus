import type { ButtonHTMLAttributes } from "react";

type IconName =
  | "add"
  | "ai"
  | "up"
  | "down"
  | "edit"
  | "delete"
  | "link"
  | "unlink"
  | "save"
  | "close"
  | "assign"
  | "remove";

type IconButtonProps = {
  icon: IconName;
  label: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

function Icon({ icon }: { icon: IconName }) {
  switch (icon) {
    case "add":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6.5" y="7.5" width="11" height="9" rx="2.5" />
          <circle cx="10" cy="12" r="1" />
          <circle cx="14" cy="12" r="1" />
          <path d="M12 4v2M9 18h6M5 12H3M21 12h-2" />
        </svg>
      );
    case "up":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 14l6-6 6 6" />
        </svg>
      );
    case "down":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 10l6 6 6-6" />
        </svg>
      );
    case "edit":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" />
          <path d="m13.5 6.5 3.5 3.5" />
        </svg>
      );
    case "delete":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12M10 11v6M14 11v6" />
        </svg>
      );
    case "link":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 13a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1M14 11a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1" />
        </svg>
      );
    case "unlink":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8l8 8M16 8l-3-3a4 4 0 1 0-6 6l1 1M8 16l3 3a4 4 0 1 0 6-6l-1-1" />
        </svg>
      );
    case "save":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "assign":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M12 5v14" />
          <circle cx="19" cy="19" r="3" />
        </svg>
      );
    case "remove":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12M10 11v6M14 11v6" />
        </svg>
      );
    default:
      return null;
  }
}

export function IconButton({ icon, label, type = "button", className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-btn ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon icon={icon} />
    </button>
  );
}
