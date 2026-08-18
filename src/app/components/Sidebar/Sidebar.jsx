import "./Sidebar.css";
import {FolderKanban} from "lucide-react";
import {Settings} from "lucide-react";

export default function Sidebar(){
  return (
<div className="sidebar">
      <h4>MODCODES</h4>
      <a href="/projects" className="homebtn"><FolderKanban />  Projects</a>
      <a href="/settings" className="settingsbtn"><Settings />  Settings</a>
</div>
);
}