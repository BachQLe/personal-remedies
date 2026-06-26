import PageShell from "../../components/marketing/PageShell";

export default function PrivacyPolicy() {
  return (
    <PageShell>
      <div className="bg-paper-200 min-h-screen">
        <div className="mx-auto max-w-[60ch] px-6 py-16 lg:py-24">
          {/* Page header */}
          <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-3">
            Legal
          </p>
          <h1 className="font-display font-semibold tracking-[-0.02em] text-[36px] md:text-[42px] text-blue-950 mb-2">
            Privacy policy
          </h1>
          <p className="font-sans text-[16px] text-char-500 mb-12">
            Last updated: January 2026
          </p>

          <div className="h-px bg-sand-200 mb-12" />

          {/* Section: Intro */}
          <section className="mb-12">
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                We are committed to protecting your privacy and operate under a strict set of privacy principles.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          {/* Section: Information We Collect */}
          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Data collection
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Information we collect
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                For our mobile app users, or visitors to our web site, we do not require disclosure of any information that can identify a user or visitor, such as a name or address.
              </p>
              <p>
                If and when we collect information about the health issues of concern to you, it is gathered to ensure better service and to provide you a more personalized experience. Such information is collected only when voluntarily offered by the visitor to our web site or the users of our mobile apps.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          {/* Section: Membership Information */}
          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Membership
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Membership information
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                For individual membership to our web site, we will need to capture personal information such as name and address of our members in order to process their paid membership.
              </p>
              <p>
                For membership for our corporate clients, we will not require any personal information such as name and address for the individuals served by our corporate client.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          {/* Section: How We Protect Your Information */}
          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Security
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              How we protect your information
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                Whether you are a mobile app user, visitor, member or a paid member, your personal information is not shared with any other party.
              </p>
              <p>
                You are solely responsible for maintaining the secrecy of your passwords and account information. Please be careful and responsible whenever you're online.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          {/* Section: Questions and Changes */}
          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Contact
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Questions and changes
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                If you have any concerns, comments or complaints, be sure to let us know. Any changes in this privacy policy will be promptly disclosed in these pages.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
