import "./chat-input.css";
export default function Chatinput() {
  return (
<div className="chat-input">
      <input  className="input" placeholder="Ask ModCodes anything...      "/>
      <button className="chat-button">Send</button>
      <button className="chat-button">Attach</button>
</div>
  );
}