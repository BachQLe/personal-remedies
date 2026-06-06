import PageShell from "../components/PageShell";

export default function PrivacyPolicy() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl container-px py-16 lg:py-24">
        <div className="prose prose-sm md:prose-base max-w-none">
          <h1 className="text-[42px] font-bold text-ink mb-2">Privacy Policy</h1>
          <p className="text-[16px] text-ink/60 mb-12">
            Last updated: January 2026
          </p>

          <section className="mb-12">
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              We are committed to protecting your privacy and operate under a strict set of privacy principles.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-[28px] font-bold text-ink mb-4">Information We Collect</h2>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              For our mobile app users, or visitors to our web site, we do not require disclosure of any information that can identify a user or visitor, such as a name or address.
            </p>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              If and when we collect information about the health issues of concern to you, it is gathered to ensure better service and to provide you a more personalized experience. Such information is collected only when voluntarily offered by the visitor to our web site or the users of our mobile apps.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-[28px] font-bold text-ink mb-4">Membership Information</h2>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              For individual membership to our web site, we will need to capture personal information such as name and address of our members in order to process their paid membership.
            </p>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              For membership for our corporate clients, we will not require any personal information such as name and address for the individuals served by our corporate client.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-[28px] font-bold text-ink mb-4">How We Protect Your Information</h2>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              Whether you are a mobile app user, visitor, member or a paid member, your personal information is not shared with any other party.
            </p>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              You are solely responsible for maintaining the secrecy of your passwords and account information. Please be careful and responsible whenever you're online.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-[28px] font-bold text-ink mb-4">Questions and Changes</h2>
            <p className="text-[16px] leading-[1.8] text-ink/85 mb-4">
              If you have any concerns, comments or complaints, be sure to let us know. Any changes in this privacy policy will be promptly disclosed in these pages.
            </p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
