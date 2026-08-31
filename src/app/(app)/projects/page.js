"use client";
import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("../../components/Workspace/Workspace"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#a78bfa", fontFamily: "system-ui" }}>
      Loading MODCODES...
    </div>
  ),
});

export default function ProjectsPage() {
  return <Workspace />;
}