import { useState } from "react";
import { Reveal } from "../components/Reveal";
import PageShell from "../components/PageShell";

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
      <section className="relative overflow-hidden bg-paper">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(196,113,90,0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.10]"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative mx-auto max-w-5xl container-px py-20 lg:py-28 text-center">
          <Reveal>
            <span className="tag">Contact Us</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="display mt-5 text-[32px] leading-[1.1] sm:text-[46px] sm:leading-[1.05] lg:text-[54px] lg:leading-[1.03] max-w-[24ch] mx-auto">
              Get in touch with our team
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-7 text-[17px] sm:text-[18px] leading-[1.6] text-ink-soft max-w-[62ch] mx-auto">
              Have a question or want to learn more about Personal Remedies? We'd love to hear from you. Send us a message and we'll get back to you as soon as possible.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-2xl container-px">
          <Reveal>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-[16px] font-semibold text-ink mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-lg border border-ink/[0.12] bg-white text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-terra focus:border-transparent transition"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-[16px] font-semibold text-ink mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-ink/[0.12] bg-white text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-terra focus:border-transparent transition"
                />
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-[16px] font-semibold text-ink mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className="w-full px-4 py-3 rounded-lg border border-ink/[0.12] bg-white text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-terra focus:border-transparent transition"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-[16px] font-semibold text-ink mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us what's on your mind..."
                  rows="6"
                  className="w-full px-4 py-3 rounded-lg border border-ink/[0.12] bg-white text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-terra focus:border-transparent transition resize-none"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-[15px] text-red-800">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {submitted && (
                <div className="p-4 rounded-lg bg-herb/15 border border-herb">
                  <p className="text-[15px] text-herb">
                    Thank you! We've received your message and will get back to you soon.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-7 py-3 bg-terra text-cream font-semibold text-[16px] rounded-lg hover:bg-terra/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-16 lg:py-24 bg-clay/[0.06] border-y border-ink/[0.06]">
        <div className="mx-auto max-w-3xl container-px">
          <Reveal>
            <h2 className="display text-[30px] leading-[1.1] sm:text-[42px] sm:leading-[1.06] text-center mb-12">
              Other ways to reach us
            </h2>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="bg-white rounded-2xl p-6 border border-ink/[0.06] shadow-card">
                <h3 className="text-[18px] font-semibold text-ink mb-2">Email</h3>
                <p className="text-[16px] text-ink/70">
                  <a href="mailto:hello@personalremedies.com" className="hover:text-terra transition">
                    hello@personalremedies.com
                  </a>
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="bg-white rounded-2xl p-6 border border-ink/[0.06] shadow-card">
                <h3 className="text-[18px] font-semibold text-ink mb-2">For Providers</h3>
                <p className="text-[16px] text-ink/70">
                  <a href="mailto:providers@personalremedies.com" className="hover:text-terra transition">
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
