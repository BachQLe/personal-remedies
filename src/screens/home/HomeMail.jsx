/** Home header mail icon → small sheet: Important notes (page) and News (in-app alerts). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Mail } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import WhatsNewSheet from '../profile/WhatsNewSheet.jsx';
import { getActiveMessages } from '../../api/messages.js';

const ROW_CLS =
  'w-full flex items-center gap-3 min-h-[2.75rem] py-3 text-left text-sm font-medium font-sans text-char-900 ' +
  'border-b border-sand-200 last:border-b-0';

export default function HomeMail() {
  const [sheet, setSheet] = useState(null); // null | 'menu' | 'news'
  const [messages, setMessages] = useState([]);
  const unread = messages.length > 0;

  useEffect(() => {
    let alive = true;
    getActiveMessages().then((active) => { if (alive) setMessages(active); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet('menu')}
        aria-label={unread ? 'Important notes and news, new' : 'Important notes and news'}
        className="relative inline-flex items-center justify-center w-11 h-11 -mt-3 -mb-3 -mr-1 shrink-0 rounded-full
          bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm transition duration-fast active:scale-95"
      >
        <Mail size={18} aria-hidden="true" />
        {unread && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-avoid-700" aria-hidden="true" />}
      </button>

      <BottomSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Notes & news">
        <Link to="/app/profile/important-notes" className={ROW_CLS}>
          <span className="flex-1">Important notes</span>
          <ChevronRight size={18} className="text-char-400" aria-hidden="true" />
        </Link>
        <button type="button" className={ROW_CLS} onClick={() => setSheet('news')}>
          <span className="flex-1">
            News
            {unread && <span className="sr-only"> (new)</span>}
          </span>
          {unread && <span className="w-2 h-2 rounded-full bg-avoid-700" aria-hidden="true" />}
          <ChevronRight size={18} className="text-char-400" aria-hidden="true" />
        </button>
      </BottomSheet>

      {sheet === 'news' && (
        <WhatsNewSheet
          messages={messages}
          onDismiss={(id) => setMessages((list) => list.filter((message) => message.id !== id))}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
