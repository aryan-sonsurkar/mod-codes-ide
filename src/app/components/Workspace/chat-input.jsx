import "./chat-input.css";
import {Send} from "lucide-react";
import {Paperclip} from "lucide-react";

export default function Chatinput() {
  return (
<div className="chat-input">
      <input  className="input" placeholder="Ask ModCodes anything...      "/>
      <button className="chat-button"><Send /></button>
      <button className="chat-button"><Paperclip /></button>
</div>
  );
}