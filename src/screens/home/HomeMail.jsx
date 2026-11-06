/** Home header mail icon → News (in-app alerts). Important notes has its own Home button. */
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import WhatsNewSheet from '../profile/WhatsNewSheet.jsx';
import { getActiveMessages } from '../../api/messages.js';

export default function HomeMail() {
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen(true)}
        aria-label={unread ? 'News, new' : 'News'}
        className="relative inline-flex items-center justify-center w-11 h-11 -mt-3 -mb-3 -mr-1 shrink-0 rounded-full
          bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm transition duration-fast active:scale-95"
      >
        <Mail size={18} aria-hidden="true" />
        {unread && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-avoid-700" aria-hidden="true" />}
      </button>

      {open && (
        <WhatsNewSheet
          messages={messages}
          onDismiss={(id) => setMessages((list) => list.filter((message) => message.id !== id))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
