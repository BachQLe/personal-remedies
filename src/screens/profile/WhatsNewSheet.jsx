/**
 * WhatsNewSheet — Profile's mount point for the in-app news/alerts channel
 * (REMEDI_MASTER_PLAN.md §4.7; see src/api/messages.js for the data layer).
 *
 * This replaces the HomeScreen banner removed in commit 3c740d9 (boss review
 * item #5: "What is the purpose of X in the upper right corner..."). That
 * banner's bare-X dismiss icon was specifically what got rejected, so rows
 * here use an explicit labelled "Dismiss" button instead of an icon-only
 * control.
 *
 * The active-messages list is fetched once by ProfileScreen (which also
 * uses it to drive the unread dot on the "What's new" row) and handed down
 * as `messages` — this component does not re-fetch. Dismissing a row calls
 * messages.js's `dismissMessage(id)` (persists to storage.js) and reports
 * back via `onDismiss` so the parent's list — and therefore the unread dot
 * — stays in sync without a second fetch.
 */
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import { dismissMessage } from '../../api/messages.js';

// Severity → existing signal-token families (T6A tokens: benefit/caution/
// avoid/info; see tailwind.config.js). `notice`/`warning` map onto the
// caution/avoid tones that already carry that meaning elsewhere in the app
// (SignalChip); an unrecognized severity falls back to `info` rather than
// dropping the row, matching messages.js's own "pass unrecognized values
// through" stance.
const TONE = {
  info: { bg: 'bg-info-100', fg: 'text-info-600' },
  notice: { bg: 'bg-caution-100', fg: 'text-caution-700' },
  warning: { bg: 'bg-avoid-100', fg: 'text-avoid-700' },
};

function toneFor(severity) {
  return TONE[severity] ?? TONE.info;
}

export default function WhatsNewSheet({ messages, onDismiss, onClose }) {
  const handleDismiss = (id) => {
    dismissMessage(id);
    onDismiss?.(id);
  };

  return (
    <BottomSheet open onClose={onClose} title="What's new">
      {messages.length === 0 ? (
        <EmptyState
          icon="bell"
          title="You're all caught up"
          body="New announcements and alerts will show up here."
        />
      ) : (
        <div className="flex flex-col gap-3" style={{ minHeight: 200 }}>
          {messages.map((message) => {
            const tone = toneFor(message.severity);
            const dismissible = message.dismissible !== false;
            return (
              <div key={message.id} className={`rounded-lg p-4 ${tone.bg}`}>
                <p className={`text-sm font-semibold font-sans ${tone.fg}`}>{message.title}</p>
                <p className="text-sm text-char-700 font-sans mt-1 leading-normal">{message.body}</p>
                {dismissible && (
                  <div className="flex justify-end mt-2 -mr-2 -mb-2">
                    <button
                      onClick={() => handleDismiss(message.id)}
                      className="tap-target text-xs font-semibold font-sans text-char-500 hover:text-avoid-700 transition-colors duration-fast px-2 py-2"
                      aria-label={`Dismiss ${message.title}`}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
