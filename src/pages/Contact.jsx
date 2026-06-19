import { useState } from "react";
import { Reveal } from "../components/Reveal";
import PageShell from "../components/PageShell";

const inputClasses =
  "w-full px-4 py-3 rounded-md border border-sand-200 bg-white text-char-900 font-sans placeholder-char-400 focus:outline-none focus:border-forest-600 focus:shadow-[0_0_0_3px_rgba(30,71,54,0.22)] transition-all duration-fast";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate form
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      // TODO: Replace with your actual backend endpoint
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-paper-200">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(30,71,54,0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">Contact us</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[32px] leading-[1.1] sm:text-[46px] sm:leading-[1.05] lg:text-[54px] lg:leading-[1.03] max-w-[24ch] mx-auto">
              Get in touch with our team
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-char-500 max-w-[62ch] mx-auto font-sans">
              Have a question or want to learn more about Personal Remedies? We'd love to hear from you. Send us a message and we'll get back to you as soon as possible.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 lg:py-28 bg-paper-200">
        <div className="mx-auto max-w-2xl container-px">
          <Reveal>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-[15px] font-medium text-char-900 mb-2 font-sans">
                  Full name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={inputClasses}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[15px] font-medium text-char-900 mb-2 font-sans">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className={inputClasses}
                />
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-[15px] font-medium text-char-900 mb-2 font-sans">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className={inputClasses}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-[15px] font-medium text-char-900 mb-2 font-sans">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us what's on your mind..."
                  rows="6"
                  className={`${inputClasses} resize-none`}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-md bg-signal-avoid-tint border border-signal-avoid">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-signal-avoid text-[20px]">error</span>
                    <p className="text-[15px] text-signal-avoid font-sans">{error}</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {submitted && (
                <div className="p-4 rounded-md bg-signal-beneficial-tint border border-signal-beneficial">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-rounded text-signal-beneficial text-[20px]">check_circle</span>
                    <p className="text-[15px] text-signal-beneficial font-sans">
                      Thank you! We've received your message and will get back to you soon.
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="pill-forest w-full text-[16px] px-7 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send message"}
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-16 lg:py-24 bg-paper-100 border-y border-sand-200">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center mb-12">
              Other ways to reach us
            </h2>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="ds-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-rounded text-forest-700 text-[24px]">mail</span>
                  <h3 className="text-[18px] font-semibold text-char-900 font-sans">Email</h3>
                </div>
                <p className="text-[16px] text-char-500 font-sans">
                  <a href="mailto:hello@personalremedies.com" className="hover:text-forest-700 transition-colors duration-fast">
                    hello@personalremedies.com
                  </a>
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="ds-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-rounded text-plum-700 text-[24px]">local_hospital</span>
                  <h3 className="text-[18px] font-semibold text-char-900 font-sans">For providers</h3>
                </div>
                <p className="text-[16px] text-char-500 font-sans">
                  <a href="mailto:providers@personalremedies.com" className="hover:text-forest-700 transition-colors duration-fast">
                    providers@personalremedies.com
                  </a>
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
