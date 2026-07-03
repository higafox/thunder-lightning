"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOpenAbout } from "./AboutProvider";

export function Topbar() {
  const pathname = usePathname();
  const openAbout = useOpenAbout();

  const onPlayer = pathname === "/" || pathname.startsWith("/video/");
  const onArchive = pathname.startsWith("/archive");

  return (
    <div className="topbar">
      <div className="brand">
        <Link className="brandLink" href="/">
          Thunder/Lightning
        </Link>{" "}
        · a love letter to music videos
      </div>
      <div className="navlinks">
        <Link className={`navlink${onPlayer ? " on" : ""}`} href="/">
          Player
        </Link>
        <Link className={`navlink${onArchive ? " on" : ""}`} href="/archive">
          Archive
        </Link>
        <button className="navlink" onClick={openAbout}>
          About
        </button>
      </div>
    </div>
  );
}
