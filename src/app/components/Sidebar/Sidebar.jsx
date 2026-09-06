"use client";
import "./Sidebar.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { Settings } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <Link href="/" className="sidebar-brand" aria-label="MODCODES home">
        MODCODES
      </Link>
      <Link
        href="/projects"
        className={`projectsbtn${pathname === "/projects" ? " sidebar-active" : ""}`}
        aria-current={pathname === "/projects" ? "page" : undefined}
      >
        <FolderKanban aria-hidden="true" /> Projects
      </Link>
      <Link
        href="/settings"
        className={`settingsbtn${pathname === "/settings" ? " sidebar-active" : ""}`}
        aria-current={pathname === "/settings" ? "page" : undefined}
      >
        <Settings aria-hidden="true" /> Settings
      </Link>
    </nav>
  );
}