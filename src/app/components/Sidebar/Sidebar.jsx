import "./Sidebar.css";
import {House} from "lucide-react";
import {FolderKanban} from "lucide-react";
import {Settings} from "lucide-react";

export default function Sidebar(){
  return (
<div className="sidebar">
      <h4>MODCODES</h4>
      <a href="/Home" className="homebtn"><House />  Home</a>
      <a href="/Projects" className="projectsbtn"><FolderKanban />  Projects</a>
      <a href="/Settings" className="settingsbtn"><Settings />  Settings</a>
</div>
);
}