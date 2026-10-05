/**
 * ImportantNotesScreen — /app/profile/important-notes. Static disclaimer,
 * data-source note, legal links and publisher credit. Copy lives in
 * importantNotesContent.js.
 */
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/shared/BackButton.jsx';
import {
  DISCLAIMER_TITLE,
  DISCLAIMER_PARAGRAPHS,
  DATA_SOURCE_TITLE,
  DATA_SOURCE_PARAGRAPHS,
  LEGAL_LINKS,
  PUBLISHER_CREDIT,
} from './importantNotesContent.js';

function Section({ title, paragraphs }) {
  return (
    <section>
      <h2 className="font-label text-xs uppercase tracking-eyebrow text-char-400 mb-2">{title}</h2>
      <div className="flex flex-col gap-2">
        {paragraphs.map((p) => (
          <p key={p} className="text-sm text-char-900 font-sans leading-relaxed">{p}</p>
        ))}
      </div>
    </section>
  );
}

export default function ImportantNotesScreen() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">
      <div className="px-5 pt-10 pb-6 flex flex-col gap-3">
        <BackButton onClick={() => navigate('/app/profile')} />
        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight">
          Important notes
        </h1>
      </div>
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-6 pb-28 flex flex-col gap-6">
        <Section title={DISCLAIMER_TITLE} paragraphs={DISCLAIMER_PARAGRAPHS} />
        <Section title={DATA_SOURCE_TITLE} paragraphs={DATA_SOURCE_PARAGRAPHS} />
        <nav aria-label="Legal" className="flex flex-col">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="py-4 border-b border-sand-200 last:border-b-0 text-sm font-medium font-sans text-forest-700 hover:opacity-80"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-char-400 font-sans">{PUBLISHER_CREDIT}</p>
      </div>
    </div>
  );
}
