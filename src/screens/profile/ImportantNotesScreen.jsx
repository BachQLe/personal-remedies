/**
 * ImportantNotesScreen — /app/profile/important-notes. Three static sections
 * (Privacy, Not medical advice, About), each tagged DRAFT until the legal copy
 * lands. Copy lives in importantNotesContent.js.
 */
import { Link } from 'react-router-dom';
import BackButton from '../../components/shared/BackButton.jsx';
import { NOTE_SECTIONS } from './importantNotesContent.js';

function Section({ title, paragraphs, links }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-label text-xs uppercase tracking-eyebrow text-char-400 mb-2">
        {title}
        <span className="rounded-pill bg-sand-200 px-2 py-0.5 text-char-900">Draft</span>
      </h2>
      <div className="flex flex-col gap-2">
        {paragraphs.map((p) => (
          <p key={p} className="text-sm text-char-900 font-sans leading-relaxed">{p}</p>
        ))}
      </div>
      {links && (
        <nav aria-label={title} className="flex flex-col mt-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="py-4 border-b border-sand-200 last:border-b-0 text-sm font-medium font-sans text-forest-700 hover:opacity-80"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}

export default function ImportantNotesScreen() {
  return (
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">
      <div className="px-5 pt-[max(1rem,var(--safe-top))] pb-4 flex items-center gap-3">
        <BackButton fallback="/app/profile" />
        <h1 className="min-w-0 font-display text-title font-semibold text-blue-950 leading-tight">
          Important notes
        </h1>
      </div>
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-6 pb-28 flex flex-col gap-6">
        {NOTE_SECTIONS.map((section) => <Section key={section.title} {...section} />)}
      </div>
    </div>
  );
}
