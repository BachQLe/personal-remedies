/**
 * PageShell — shared layout wrapper for standalone content pages.
 *
 * Props (unchanged): children
 */
import Nav from "./Nav";
import Footer from "./Footer";

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-paper-200 text-char-900 font-sans">
      <Nav offset={0} />
      <main style={{ paddingTop: 64 }}>{children}</main>
      <Footer />
    </div>
  );
}
