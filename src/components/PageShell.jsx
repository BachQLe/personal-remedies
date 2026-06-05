import Nav from "./Nav";
import Footer from "./Footer";

// Shared layout for standalone content pages: fixed nav + footer.
export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <Nav offset={0} />
      <main style={{ paddingTop: 64 }}>{children}</main>
      <Footer />
    </div>
  );
}
