"use client";
import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("../../components/Workspace/Workspace"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", flexDirection:"column", alignItems: "center", justifyContent: "center", height: "100vh", color: "#a78bfa", fontFamily: "system-ui", gap:8 }}>
      <div style={{fontSize:20,fontWeight:600}}>MODCODES</div>
      <div style={{fontSize:13,color:"#B8B5C5"}}>Loading workspace...</div>
    </div>
  ),
});

export default function ProjectsPage() {
  return <Workspace />;
}