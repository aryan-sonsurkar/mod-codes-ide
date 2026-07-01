export default function Home() {
  return (
    <div className="app">
    <div className="sidebar">
      <h4>MODCODES</h4>
      <a href="/Home">Home</a>
      <a href="/Projects">Projects</a>
      <a href="/Settings">Settings</a>
    </div>
    <div className="workspace">
      <h1>Welcome to ModCodes</h1>
      <p>An AI-powered development environment built from scratch by Aryan Sonsurkar.</p>
      <input placeholder="Let's build with modcodes bro"/>
    </div>
    </div>
  );
}