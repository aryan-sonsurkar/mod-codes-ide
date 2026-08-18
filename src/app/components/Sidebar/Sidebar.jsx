"use client";
import "./Sidebar.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { Settings } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="sidebar">
      <Link href="/" className="sidebar-brand">
        MODCODES
      </Link>
      <Link
        href="/projects"
        className={`projectsbtn${pathname === "/projects" ? " sidebar-active" : ""}`}
      >
        <FolderKanban /> Projects
      </Link>
      <Link
        href="/settings"
        className={`settingsbtn${pathname === "/settings" ? " sidebar-active" : ""}`}
      >
        <Settings /> Settings
      </Link>
    </div>
  );
}