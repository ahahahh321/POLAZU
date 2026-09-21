import type { ReactNode, SVGProps } from "react";

export type DesignerIconName =
  | "select" | "hand" | "frame" | "text" | "rectangle" | "image" | "comment"
  | "undo" | "redo" | "play" | "design" | "code" | "search" | "layers" | "pages" | "files" | "insert" | "palette"
  | "grid" | "ruler" | "snap" | "command" | "help" | "save" | "more" | "close" | "chevron"
  | "desktop" | "tablet" | "mobile" | "fit" | "zoomIn" | "zoomOut" | "eye" | "eyeOff" | "lock" | "unlock"
  | "alignLeft" | "alignCenter" | "alignRight" | "alignTop" | "alignMiddle" | "alignBottom" | "distributeH" | "distributeV"
  | "duplicate" | "trash" | "users" | "up" | "down" | "plus" | "minus" | "audit" | "warning" | "info" | "check" | "link" | "branch";

export default function DesignerIcon({ name, ...props }: { name: DesignerIconName } & SVGProps<SVGSVGElement>) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<DesignerIconName, ReactNode> = {
    select:<><path d="m5 3 13 9-7 2-3 7z"/><path d="m12 14 4 6"/></>,
    hand:<><path d="M7 11V7a2 2 0 0 1 4 0v3"/><path d="M11 10V5a2 2 0 0 1 4 0v5"/><path d="M15 10V7a2 2 0 0 1 4 0v7c0 4-3 7-7 7h-1c-2 0-3-1-4-3l-2-4a2 2 0 0 1 3-2l1 2"/></>,
    frame:<><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/></>,
    text:<><path d="M5 5h14M12 5v14M8 19h8"/></>,
    rectangle:<rect x="4" y="5" width="16" height="14" rx="2"/>,
    image:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 17 5-5 4 4 2-2 7 6"/></>,
    comment:<><path d="M5 5h14v10H9l-4 4z"/><path d="M8 9h8M8 12h5"/></>,
    undo:<path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/>,
    redo:<path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6"/>,
    play:<path d="m8 5 11 7-11 7z"/>, design:<><path d="M4 19 15 8l3 3L7 22H4z"/><path d="m14 9 2-2 3 3-2 2"/></>,
    code:<path d="m9 6-6 6 6 6M15 6l6 6-6 6M14 4l-4 16"/>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    layers:<><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    pages:<><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></>,
    files:<><path d="M3 6h7l2 2h9v12H3z"/><path d="M3 6V4h6l2 2"/></>,
    insert:<><path d="M4 4h16v16H4z"/><path d="M12 8v8M8 12h8"/></>,
    palette:<><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h2a7 7 0 0 0-2-11Z"/><circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1" fill="currentColor" stroke="none"/></>,
    grid:<><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></>,
    ruler:<><path d="M3 7h18v10H3z"/><path d="M7 7v5M11 7v3M15 7v5M19 7v3"/></>,
    snap:<><path d="M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3"/><path d="M8 12h8M12 8v8"/></>,
    command:<><path d="M9 6V4a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v16a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/></>,
    help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.2 2c-1 .7-1.7 1.2-1.7 2.5M12 17h.01"/></>,
    save:<><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
    more:<><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>, chevron:<path d="m9 6 6 6-6 6"/>,
    desktop:<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    tablet:<><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>, mobile:<><rect x="8" y="2" width="8" height="20" rx="2"/><path d="M11 18h2"/></>,
    fit:<><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></>, zoomIn:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6M7 10h6"/></>, zoomOut:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/></>,
    eye:<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12"/><circle cx="12" cy="12" r="2.5"/></>, eyeOff:<><path d="m3 3 18 18M10.6 6.2A11 11 0 0 1 12 6c6 0 10 6 10 6a18 18 0 0 1-3 3.8M6.2 6.2C3.6 8 2 12 2 12s4 6 10 6c1.4 0 2.7-.3 3.8-.8"/></>,
    lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, unlock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2"/></>,
    alignLeft:<><path d="M4 4v16M8 7h11v4H8zM8 14h7v4H8z"/></>, alignCenter:<><path d="M12 3v18M5 7h14v4H5zM7 14h10v4H7z"/></>, alignRight:<><path d="M20 4v16M5 7h11v4H5zM9 14h7v4H9z"/></>,
    alignTop:<><path d="M4 4h16M7 8v11h4V8zM14 8v7h4V8z"/></>, alignMiddle:<><path d="M3 12h18M7 5v14h4V5zM14 7v10h4V7z"/></>, alignBottom:<><path d="M4 20h16M7 5v11h4V5zM14 9v7h4V9z"/></>,
    distributeH:<><path d="M4 4v16M20 4v16M8 7h3v10H8zM14 5h3v14h-3z"/></>, distributeV:<><path d="M4 4h16M4 20h16M7 8h10v3H7zM5 14h14v3H5z"/></>,
    duplicate:<><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16V4h12"/></>, trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>, users:<><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-4 2.7-6 5.5-6s4.8 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14c3.2-.5 5.2 1.2 5.7 4.5"/></>,
    up:<path d="m6 15 6-6 6 6"/>, down:<path d="m6 9 6 6 6-6"/>, plus:<path d="M12 5v14M5 12h14"/>, minus:<path d="M5 12h14"/>,
    audit:<><path d="M4 4h16v16H4z"/><path d="m8 12 3 3 5-6"/></>, warning:<><path d="M12 3 2 21h20z"/><path d="M12 9v5M12 18h.01"/></>, info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>, check:<path d="m5 12 4 4L19 6"/>, link:<><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></>,
    branch:<><circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 9c5 0 8-1 8-3M8 15c5 0 8-2 8-7"/></>,
  };
  return <svg {...common} {...props}>{paths[name]}</svg>;
}
