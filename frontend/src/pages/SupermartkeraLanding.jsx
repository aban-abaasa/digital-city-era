import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBarChart2,
  FiCamera,
  FiCheckCircle,
  FiCreditCard,
  FiHeadphones,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiMoon,
  FiSun,
  FiShield,
  FiShoppingBag,
  FiStar,
  FiTruck,
  FiUsers,
  FiZap
} from 'react-icons/fi';
import { useTheme } from '../contexts/ThemeContext';

const serviceCards = [
  {
    icon: FiCreditCard,
    title: 'POS system',
    copy: 'Fast billing, receipts, and a clean checkout flow for busy supermarket teams.'
  },
  {
    icon: FiCamera,
    title: 'Scan and pay',
    copy: 'Barcode scanning and payment support that helps queues move faster.'
  },
  {
    icon: FiPackage,
    title: 'Inventory management',
    copy: 'Track stock, categories, and low items from one easy dashboard.'
  },
  {
    icon: FiBarChart2,
    title: 'Reports',
    copy: 'Sales and stock reports that help managers make better decisions.'
  },
  {
    icon: FiUsers,
    title: 'Team management',
    copy: 'Assign roles and keep staff workflows organized and simple.'
  },
  {
    icon: FiTruck,
    title: 'Supplier coordination',
    copy: 'Keep orders, deliveries, and stock replenishment in sync.'
  }
];

const customerBenefits = [
  'A clean and friendly shopping experience',
  'Fast sign-in for shoppers, staff, and managers',
  'Reliable inventory visibility behind the scenes',
  'Simple, affordable software for growing supermarkets'
];

const contactMethods = [
  { icon: FiMail, label: 'Email', value: 'hello@supermartkera.com' },
  { icon: FiPhone, label: 'Phone', value: '+256 700 000 000' },
  { icon: FiMapPin, label: 'Location', value: 'Kampala, Uganda' }
];

const themeStyles = {
  dark: {
    shell: 'bg-[#07111f] text-white',
    header: 'bg-white/5 border-white/10',
    panel: 'bg-slate-950/60 border-white/10',
    softPanel: 'bg-white/8 border-white/10',
    muted: 'text-slate-300',
    body: 'text-slate-300',
    accent: 'text-cyan-100',
    button: 'bg-white text-slate-950',
    outline: 'border-white/15 bg-white/8 text-white hover:bg-white/12',
    input: 'bg-slate-950/50 border-white/10 text-white placeholder:text-slate-500'
  },
  light: {
    shell: 'bg-[linear-gradient(180deg,#f8fafc_0%,#eff6ff_45%,#ffffff_100%)] text-slate-900',
    header: 'bg-white/80 border-slate-200',
    panel: 'bg-white border-slate-200 shadow-xl shadow-slate-200/40',
    softPanel: 'bg-slate-50 border-slate-200',
    muted: 'text-slate-600',
    body: 'text-slate-600',
    accent: 'text-slate-700',
    button: 'bg-slate-950 text-white',
    outline: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
    input: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }
};

const SupermartkeraLanding = () => {
  const { theme, toggleTheme } = useTheme();
  const palette = themeStyles[theme];
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = (event) => {
    event.preventDefault();

    const subject = encodeURIComponent(`Supermartkera enquiry from ${contactForm.name || 'website visitor'}`);
    const body = encodeURIComponent(
      `Name: ${contactForm.name}\nEmail: ${contactForm.email}\nCompany: ${contactForm.company}\n\nMessage:\n${contactForm.message}`
    );

    window.location.href = `mailto:hello@supermartkera.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className={`min-h-screen ${palette.shell}`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-20 left-10 h-72 w-72 rounded-full blur-3xl ${theme === 'dark' ? 'bg-cyan-400/20' : 'bg-cyan-200/50'}`} />
        <div className={`absolute top-44 right-0 h-80 w-80 rounded-full blur-3xl ${theme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-200/50'}`} />
        <div className={`absolute bottom-10 left-1/3 h-96 w-96 rounded-full blur-3xl ${theme === 'dark' ? 'bg-amber-400/10' : 'bg-amber-100/70'}`} />
      </div>

      <header className={`relative z-10 border-b backdrop-blur-xl ${palette.header}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 shadow-lg shadow-cyan-500/20">
              <FiShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-500/70">Supermarket operating system</p>
              <h1 className="text-xl font-semibold tracking-wide">Supermartkera</h1>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition md:hidden ${palette.outline}`}
          >
            {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={toggleTheme}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${palette.outline}`}
            >
              {theme === 'dark' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${palette.outline}`}
            >
              Contact us
            </button>
              <Link
                to="/login"
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02] ${palette.button}`}
              >
                Open sign in
                <FiArrowRight className="h-4 w-4" />
              </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8 lg:pt-16">
        <section className="grid gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200">
              <FiStar className="h-4 w-4 text-amber-300" />
              Clean UX for customers, staff, and managers
            </div>

            <div className="space-y-5">
              <h2 className={`max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl ${palette.accent}`}>
                A professional landing page for supermarkets that want to run better.
              </h2>
              <p className={`max-w-2xl text-lg leading-8 md:text-xl ${palette.body}`}>
                Supermartkera helps supermarket teams manage POS, scan-and-pay, inventory, reports,
                and supplier activity in one clean, affordable place.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-600 px-6 py-4 font-semibold text-slate-950 shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                Open sign in
                <FiArrowRight className="h-5 w-5" />
              </Link>
              <button
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
                className={`inline-flex items-center gap-3 rounded-2xl border px-6 py-4 font-semibold backdrop-blur-md transition hover:scale-[1.01] ${palette.outline}`}
              >
                Explore services
                <FiArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { value: 'POS', label: 'Checkout ready' },
                { value: 'Scan', label: 'Barcode friendly' },
                { value: 'Stock', label: 'Inventory control' },
                { value: 'Reports', label: 'Decision support' }
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 backdrop-blur-md ${palette.softPanel}`}>
                  <p className="text-2xl font-black">{item.value}</p>
                  <p className={`mt-1 text-xs uppercase tracking-[0.25em] ${palette.muted}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-cyan-400/20 via-transparent to-fuchsia-400/20 blur-2xl" />
            <div className={`relative rounded-[2rem] border p-6 ${palette.panel}`}>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-cyan-200/70' : 'text-slate-500'}`}>
                      What Supermartkera does
                    </p>
                    <h3 className={`mt-2 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      One system. Clear control. Better service.
                    </h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                    <FiZap className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    'A smoother shopping experience for customers',
                    'Faster checkout with POS and scan-and-pay',
                    'Easy inventory management for supermarkets',
                    'Clear reports for better business decisions'
                  ].map((feature) => (
                    <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                      <p className="text-sm leading-6 text-slate-200">{feature}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="mt-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Services</p>
              <h3 className={`mt-3 text-3xl font-bold md:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Built around how supermarkets actually work.
              </h3>
            </div>
            <p className={`max-w-2xl text-sm leading-7 md:text-right ${palette.muted}`}>
              From billing to stock movement, the platform keeps the workflow simple for staff and
              clear for management.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {serviceCards.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className={`rounded-[1.75rem] border p-6 transition hover:-translate-y-1 ${palette.softPanel}`}>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h4 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{service.title}</h4>
                  <p className={`mt-3 leading-7 ${palette.muted}`}>{service.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <FiShield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">Why it feels good</p>
                <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Simple for daily use, professional for business.
                </h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {customerBenefits.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                  <p className="text-sm leading-6 text-slate-200">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <FiUsers className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Customer-friendly</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Designed so shoppers enjoy a smoother experience without extra friction.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-200">
                <FiHeadphones className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Affordable support</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                A budget-friendly system that still feels polished, fast, and modern.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200">
                <FiTruck className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Supplier-ready</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Keep deliveries and replenishment aligned with store demand.
              </p>
            </div>
            <div className={`rounded-[1.5rem] border p-6 ${palette.softPanel}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-200">
                <FiStar className="h-6 w-6" />
              </div>
              <h4 className={`mt-4 text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Reports-first</h4>
              <p className={`mt-3 text-sm leading-7 ${palette.muted}`}>
                Turn everyday data into useful store decisions.
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-500/70">Contact us</p>
            <h3 className={`mt-3 text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Talk to the Supermartkera team.</h3>
            <p className={`mt-4 text-sm leading-7 ${palette.muted}`}>
              Ask about setup, pricing, onboarding, POS, inventory, scan-and-pay, or reports.
            </p>

            <div className="mt-8 space-y-4">
              {contactMethods.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`flex items-center gap-4 rounded-2xl border p-4 ${palette.softPanel}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleContactSubmit} className={`rounded-[2rem] border p-6 ${palette.panel}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Your name</label>
                <input
                  name="name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Email address</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                  placeholder="jane@store.com"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Company or store</label>
              <input
                name="company"
                value={contactForm.company}
                onChange={handleContactChange}
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                placeholder="Your supermarket name"
              />
            </div>

            <div className="mt-4">
              <label className={`mb-2 block text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>Message</label>
              <textarea
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                rows="5"
                className={`w-full rounded-2xl border px-4 py-3 outline-none transition focus:border-cyan-300/60 ${palette.input}`}
                placeholder="Tell us what you need: POS, scan and pay, inventory, reports, or full supermarket management."
              />
            </div>

            <button
              type="submit"
              className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-600 px-6 py-4 font-semibold text-slate-950 shadow-xl shadow-cyan-500/15 transition hover:scale-[1.01]"
            >
              <FiMail className="h-5 w-5" />
              Contact us now
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default SupermartkeraLanding;
