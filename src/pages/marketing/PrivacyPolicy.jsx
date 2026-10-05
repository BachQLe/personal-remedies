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
            Last updated: October 2026
          </p>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Overview
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Introduction
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                Personal Remedies is published by Personal Remedies, LLC ("we", "us"). This policy explains what the Personal Remedies app and website collect, where it is stored, who else is involved, and how you can delete it.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Data collection
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              What we collect
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                Personal Remedies stores the information you enter so it can personalize food guidance: your first name and age group; the health conditions, allergies, dietary pattern, religious dietary restriction, medications and daily calorie target you choose to add; the recipes you save; and your meal plans. Health-related information is optional, but the app cannot rank foods for you without at least one health condition.
              </p>
              <p>
                If you create an account to back up your information, we also collect your email address. If you sign in with Google, Google tells us the email address on that account.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Storage
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Where it is stored
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                By default this information is stored only on your device. If you choose "Back up & sync" and sign in, a copy of your profile, saved recipes and meal plan is stored in our cloud database, which is provided by Supabase and hosted in the United States. It is set up so that only your account can read it. Your recent searches and your "cooked" history stay on your device and are not uploaded.
              </p>
              <p>
                You sign in with a one-time code sent to your email, or with a Google account.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Health
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Your health information
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                The health conditions, allergies and medications you enter are sensitive. We use them only to rank and filter foods and recipes for you inside the app. We do not use them for advertising and we do not sell them. You can change or remove any item at any time in Profile, and you can withdraw your information by deleting your account (see "Keeping and deleting your data").
              </p>
              <p>
                By continuing past the health-information consent step in onboarding you agree that we may process it for this purpose.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Retention
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Keeping and deleting your data
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                We keep your cloud-synced information for as long as your account exists. You can delete your account in the app: go to Profile, then tap "Delete account & data". If you are not signed in, the same row reads "Delete my data" and clears the data on your device.
              </p>
              <p>
                Deleting your account removes your email address and your synced profile, saved recipes and meal plans from our servers, and clears the data on your device. Backup copies held by our storage provider may persist for a limited time before they are overwritten. You can also ask us to delete your information by emailing hello@personalremedies.com.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Third parties
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Who else is involved
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                We use a small number of service providers to run Personal Remedies: Supabase (account sign-in and cloud storage of your synced information), Vercel (to deliver the web app) and Nutridigm (the source of our food guidance). When you view food guidance, the app sends Nutridigm the identifiers of the health conditions in your profile and of the foods you are viewing, but not your name or email address. Food photos are loaded from Unsplash. If you sign in with Google, Google handles that sign-in under its own privacy practices.
              </p>
              <p>
                We do not use any analytics, advertising or crash-reporting service.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Commitments
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              What we do not do
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                We do not sell your personal information. We do not use it for advertising, and we do not track you across other companies' apps or websites.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Children
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Children
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                Personal Remedies is intended for adults. We do not knowingly collect information from anyone under 13. If you believe a child has given us information, contact hello@personalremedies.com and we will delete it.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Your choices
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Your choices and contact
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                You can view and edit your information in the app. You can ask us for a copy of your information, or ask us to delete it, by emailing hello@personalremedies.com. Depending on where you live, you may have additional rights; contact us to exercise them.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Security
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Security
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                Synced information is stored so that only the signed-in owner of the account can read it. No system is perfectly secure, so please keep your device and email account protected. There is no password to lose, because we sign you in with a one-time code sent to your email or with your Google account.
              </p>
            </div>
          </section>

          <div className="h-px bg-sand-200 mb-12" />

          <section className="mb-12">
            <p className="font-label text-[12px] uppercase tracking-[.14em] text-char-500 mb-4">
              Updates
            </p>
            <h2 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 mb-4">
              Changes to this policy
            </h2>
            <div className="font-sans text-[16px] leading-[1.65] text-char-900 space-y-4">
              <p>
                We will post changes here and update the date above. If a change is significant we will tell you in the app.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
