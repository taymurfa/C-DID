'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Target,
  TrendingUp,
  Users,
  BarChart3,
  Award,
  Zap,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { getCurrentUser, login, loginEmailPassword, register, User } from '@/lib/auth';
import { ImageWithFallback } from '@/components/ImageWithFallback';

/** Official horizontal wordmark (same asset as selectquote.com). */
const SQ_LOGO_SVG =
  'https://images.ctfassets.net/vr7x4vru4gls/6gAXznpmKOkZja9CuI9NQv/57b1f0ec4692144fa1b085716564563d/SelectQuote_Horiz_Logo_COLOR-200_Artboard_1.svg';

/** Hero imagery aligned with SelectQuote’s consumer site (Contentful CDN). */
const HERO_IMG =
  'https://images.ctfassets.net/vr7x4vru4gls/4wJst9HFtFM6FIHplmaCUu/3fbd3e919a0ffccb267bdc8703675958/Hero-2-min.jpg?fm=jpg&w=1200&q=80';
const SERVICE_IMG =
  'https://images.unsplash.com/photo-1739527324181-e02978b400c0?w=1080&q=80';

export default function Home() {
  const loginRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const features = [
    {
      icon: Target,
      title: 'Strategic alignment',
      description:
        'Align individual, team, and company OKRs with SelectQuote’s mission: helping people protect what matters with the right coverage at the best price.',
    },
    {
      icon: TrendingUp,
      title: 'Performance tracking',
      description:
        'Track the metrics that matter across Life, Auto & Home, Medicare, and corporate teams—in one transparent view.',
    },
    {
      icon: Users,
      title: 'Cross-team visibility',
      description:
        'Sales, Service, Operations, and Technology see shared goals so handoffs stay smooth and customer impact stays central.',
    },
    {
      icon: BarChart3,
      title: 'Data-driven insight',
      description:
        'Lead reviews with roll-up dashboards and history—not just slides—so decisions match what customers and the business need.',
    },
    {
      icon: Award,
      title: 'Recognition and wins',
      description:
        'Celebrate the key results that improve customer experience, efficiency, and growth.',
    },
    {
      icon: Zap,
      title: 'Quarterly rhythm',
      description:
        'Match fast-moving insurance markets with clear quarterly OKRs and steady check-ins.',
    },
  ];

  const stats = [
    { label: 'Colleagues', value: '2,000+', description: 'Across departments nationwide' },
    { label: 'Company OKRs', value: '25+', description: 'Strategic initiatives each cycle' },
    { label: 'Team success', value: 'Strong', description: 'Goals tracked with ownership' },
    { label: 'North Star', value: 'Customers', description: 'Outcomes tied to trust & value' },
  ];

  useEffect(() => {
    loadUser();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      await login();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Login failed';
      setError(errorMessage);
      console.error('Login error:', e);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loggedInUser = await loginEmailPassword(email, password);
      setUser(loggedInUser);
      if (typeof window !== 'undefined') {
        window.location.href = '/my-okrs';
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const newUser = await register(email, password, name);
      setUser(newUser);
      if (typeof window !== 'undefined') {
        window.location.href = '/my-okrs';
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const errorDisplay =
    error === 'auth0_not_configured' || error?.includes('Auth0 not configured')
      ? 'Auth0 is not configured on the server. Set AUTH0_ISSUER_BASE_URL (or AUTH0_DOMAIN), AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET on the API (or for local dev only, ALLOW_INSECURE_AUTH0_DEV=1 with FLASK_ENV=development), then restart.'
      : error ? `Error: ${error}` : null;

  return (
    <div className="min-h-screen bg-white font-sq-body text-[#646464] antialiased">
      <div className="bg-[#07aec7] text-center text-xs sm:text-sm py-2.5 px-3 sm:px-4 leading-snug font-sq-body text-white shadow-[0_2px_18px_0_rgba(0,0,0,0.12)]">
        <span className="font-sq-heading font-bold">SelectQuote Insurance Services</span>
        <span className="hidden sm:inline"> · </span>
        <span className="block sm:inline text-white/95">
          Employee OKR portal — work that ladders to how we protect families and financial well-being.
        </span>{' '}
        <a
          href="https://www.selectquote.com/"
          className="font-sq-heading text-white font-semibold underline decoration-white/80 underline-offset-2 hover:text-white hover:decoration-white whitespace-nowrap"
          target="_blank"
          rel="noopener noreferrer"
        >
          Customer site
        </a>
      </div>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white sticky top-0 z-40 border-b border-gray-200 shadow-[0_2px_18px_0_rgba(0,0,0,0.3)]"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center gap-3 sm:gap-4 min-w-0"
            >
              <Link href="/" className="flex items-center gap-3 sm:gap-4 min-w-0 shrink-0">
                <ImageWithFallback
                  src={SQ_LOGO_SVG}
                  alt="SelectQuote"
                  width={202}
                  height={56}
                  className="h-8 w-auto sm:h-10 object-contain object-left"
                />
                <span className="hidden sm:block min-w-0 border-l border-gray-200 pl-4">
                  <span className="font-sq-heading text-xs font-semibold text-[#646464] leading-tight block">
                    OKR management system
                  </span>
                </span>
              </Link>
            </motion.div>
            {isLoading ? (
              <span className="text-sm text-[#646464]">Loading…</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#646464] hidden sm:inline max-w-[200px] truncate">
                  {user.name || user.email}
                </span>
                <Link
                  href="/my-okrs"
                  className="font-sq-heading px-4 py-2.5 sm:px-6 bg-[#F47B20] text-white rounded font-semibold hover:bg-[#e06f15] transition-colors shadow-sm text-sm sm:text-base touch-manipulation"
                >
                  My OKRs
                </Link>
              </div>
            ) : (
              <motion.a
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToLogin();
                }}
                className="font-sq-heading px-4 py-2.5 sm:px-6 bg-[#F47B20] text-white rounded font-semibold hover:bg-[#e06f15] transition-colors shadow-sm shrink-0 text-sm sm:text-base touch-manipulation"
              >
                Employee sign in
              </motion.a>
            )}
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {errorDisplay && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorDisplay}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-10 sm:py-12 lg:py-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFF5EF] text-[#F18549] rounded-full text-sm font-sq-heading font-bold mb-6 border border-[#FDD5BA]">
              <Clock className="w-4 h-4 shrink-0" aria-hidden />
              Q2 2026 planning
            </div>

            {isLoading ? (
              <p className="text-lg">Loading your session…</p>
            ) : user ? (
              <>
                <h2 className="font-sq-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#231F20] mb-6 leading-tight text-balance">
                  Welcome back,
                  <span className="text-[#F47B20]"> {user.name?.split(' ')[0] || 'there'}</span>
                </h2>
                <p className="text-lg mb-8 leading-relaxed">
                  You are signed in. Open My OKRs to continue, or visit your profile to update details.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    href="/my-okrs"
                    className="font-sq-heading px-8 py-4 bg-[#F47B20] text-white rounded font-semibold hover:bg-[#e06f15] transition-colors shadow-md text-lg flex items-center justify-center gap-2"
                  >
                    <Shield className="w-5 h-5" aria-hidden />
                    Go to My OKRs
                  </Link>
                  <Link
                    href="/profile"
                    className="font-sq-heading px-8 py-4 bg-white text-[#231F20] rounded font-semibold hover:bg-gray-50 transition-colors shadow border border-gray-300 text-lg flex items-center justify-center"
                  >
                    Profile
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-sq-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-[#231F20] mb-6 leading-tight text-balance">
                  Empowering SelectQuote teams through
                  <span className="text-[#F47B20]"> clear goals</span>
                </h2>
                <p className="text-lg mb-8 leading-relaxed">
                  Managers and leaders own objectives; teams execute and update key results; everyone can see how our
                  work supports customers—from Life to Auto &amp; Home to Medicare. Strategy stays visible from the
                  front line to leadership.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="#login"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToLogin();
                    }}
                    className="font-sq-heading px-8 py-4 bg-[#F47B20] text-white rounded font-semibold hover:bg-[#e06f15] transition-colors shadow-md text-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-5 h-5" aria-hidden />
                    Access your OKRs
                  </motion.a>
                </div>
                <p className="text-sm text-[#646464] mb-4 font-medium">
                  We do the shopping. You do the saving —{' '}
                  <span className="text-[#231F20]">here we align on how we deliver that promise.</span>
                </p>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#F47B20] rounded-full" />
                    <span>Objectives owned by leadership, visible org-wide</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#4CABC4] rounded-full" />
                    <span>Progress updated as teams report</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative mb-16 sm:mb-14 lg:mb-0"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <ImageWithFallback
                src={HERO_IMG}
                alt="SelectQuote — helping customers find the right insurance"
                className="w-full h-auto block"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white pointer-events-none">
                <p className="font-sq-heading text-base sm:text-lg font-bold">Driving success together</p>
                <p className="text-xs sm:text-sm text-white/90">How we align on what matters for customers and colleagues</p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute -bottom-6 left-3 right-3 sm:left-6 sm:right-6 grid grid-cols-2 gap-3 sm:gap-4"
            >
              <div className="bg-white rounded-lg shadow-xl p-4 border border-gray-100">
                <div className="font-sq-heading text-2xl font-bold text-[#F47B20]">Roll-up</div>
                <div className="text-xs text-[#646464]">Company-wide visibility</div>
              </div>
              <div className="bg-white rounded-lg shadow-xl p-4 border border-gray-100">
                <div className="font-sq-heading text-2xl font-bold text-[#4CABC4]">Live</div>
                <div className="text-xs text-[#646464]">Check-ins &amp; updates</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-16 border-y border-gray-200 my-16"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="font-sq-heading text-2xl sm:text-3xl md:text-4xl font-bold text-[#231F20] mb-2 break-words">{stat.value}</div>
                <div className="text-sm font-sq-heading font-semibold text-[#231F20] mb-1">{stat.label}</div>
                <div className="text-xs text-[#646464]">{stat.description}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-16"
        >
          <div className="text-center mb-12">
            <h3 className="font-sq-heading text-2xl sm:text-3xl md:text-4xl font-bold text-[#231F20] mb-4 text-balance px-1">
              Built for SelectQuote teams
            </h3>
            <p className="text-base sm:text-lg max-w-3xl mx-auto leading-relaxed px-1">
              Clarity on who owns what, how success is measured, and how goals ladder to our mission.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all border border-gray-100"
              >
                <div className="w-12 h-12 bg-[#FFF5EF] rounded-lg flex items-center justify-center mb-4 border border-[#FDD5BA]">
                  <feature.icon className="w-6 h-6 text-[#F47B20]" aria-hidden />
                </div>
                <h4 className="font-sq-heading text-xl font-semibold text-[#231F20] mb-3">{feature.title}</h4>
                <p className="leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-16"
        >
          <div className="bg-gradient-to-br from-[#e8f4f7] to-[#FFF8F3] rounded-2xl overflow-hidden shadow-xl border border-gray-100">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-sq-heading font-semibold mb-6 w-fit shadow-sm text-[#231F20]">
                  <Award className="w-4 h-4 text-[#F47B20]" aria-hidden />
                  Customer-first outcomes
                </div>
                <h3 className="font-sq-heading text-3xl font-bold text-[#231F20] mb-4">
                  Every goal should show up in customer experience
                </h3>
                <p className="mb-6 leading-relaxed">
                  Our OKRs are not just numbers—they connect to the trust millions of families place in SelectQuote. Key
                  results make strategy measurable; this portal keeps owners and timelines in one place.
                </p>
                <div className="space-y-4">
                  {[
                    { n: '1', title: 'Satisfaction & trust', desc: 'Goals tied to NPS, quality, and service excellence' },
                    { n: '2', title: 'Operational excellence', desc: 'Speed, accuracy, and how we show up for colleagues' },
                    { n: '3', title: 'Growth with integrity', desc: 'Results that scale the business the right way' },
                  ].map((step) => (
                    <div key={step.n} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[#F47B20] rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-sq-heading font-bold text-sm">{step.n}</span>
                      </div>
                      <div>
                        <div className="font-sq-heading font-semibold text-[#231F20]">{step.title}</div>
                        <div className="text-sm text-[#646464]">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative h-64 lg:h-auto min-h-[240px]">
                <ImageWithFallback
                  src={SERVICE_IMG}
                  alt="Licensed agents and teams serving SelectQuote customers"
                  className="w-full h-full object-cover absolute inset-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          ref={loginRef}
          id="login"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-16 scroll-mt-28 sm:scroll-mt-24"
        >
          {user ? (
            <div className="bg-gradient-to-r from-[#4CABC4] to-[#3589a0] rounded-2xl shadow-2xl p-8 sm:p-12 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative z-10 text-center max-w-xl mx-auto">
                <h3 className="font-sq-heading text-3xl sm:text-4xl font-bold text-white mb-4">You are signed in</h3>
                <p className="text-lg text-white/95 mb-8">
                  Continue to My OKRs or open your profile.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link
                    href="/my-okrs"
                    className="font-sq-heading px-8 py-4 bg-[#F47B20] text-white rounded-xl font-semibold hover:bg-[#e06f15] transition-colors shadow-lg"
                  >
                    Go to My OKRs
                  </Link>
                  <Link
                    href="/profile"
                    className="font-sq-heading px-8 py-4 border-2 border-white/90 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-[#4CABC4] to-[#3589a0] rounded-2xl shadow-2xl p-8 sm:p-12 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative z-10">
                <div className="text-center mb-12">
                  <h3 className="font-sq-heading text-3xl sm:text-4xl font-bold text-white mb-4">
                    Sign in to your OKR dashboard
                  </h3>
                  <p className="text-lg text-white/95 max-w-2xl mx-auto leading-relaxed">
                    Access your goals, track progress, and collaborate with your team. Use your SelectQuote Google
                    Workspace account when SSO is enabled, or email for supported environments.
                  </p>
                </div>

                {!showEmailLogin ? (
                  <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <motion.button
                      type="button"
                      onClick={handleLogin}
                      whileHover={{ scale: 1.03, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-all text-left w-full cursor-pointer"
                    >
                      <div className="flex items-center justify-center mb-6">
                        <GoogleMark />
                      </div>
                      <h4 className="font-sq-heading text-xl font-bold text-[#231F20] mb-2 text-center">
                        Sign in with Google
                      </h4>
                      <p className="text-[#646464] text-center mb-4 leading-relaxed">
                        Use your SelectQuote Google Workspace account when single sign-on is configured
                      </p>
                      <div className="flex items-center justify-center text-[#F47B20] font-sq-heading font-semibold">
                        <span>Continue with Google</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={() => setShowEmailLogin(true)}
                      whileHover={{ scale: 1.03, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-all text-left w-full cursor-pointer"
                    >
                      <div className="flex items-center justify-center mb-6">
                        <div className="w-16 h-16 bg-[#FFE8D6] rounded-full flex items-center justify-center">
                          <Shield className="w-8 h-8 text-[#F47B20]" aria-hidden />
                        </div>
                      </div>
                      <h4 className="font-sq-heading text-xl font-bold text-[#231F20] mb-2 text-center">
                        Sign in with email
                      </h4>
                      <p className="text-[#646464] text-center mb-4 leading-relaxed">
                        Company email and password where email authentication is enabled (including demo environments)
                      </p>
                      <div className="flex items-center justify-center text-[#F47B20] font-sq-heading font-semibold">
                        <span>Continue with email</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </motion.button>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
                    <form onSubmit={isRegistering ? handleRegister : handleEmailPasswordLogin} className="space-y-4">
                      {isRegistering && (
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Name (optional)
                          </label>
                          <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F47B20] focus:border-[#F47B20]"
                            placeholder="Your name"
                          />
                        </div>
                      )}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F47B20] focus:border-[#F47B20]"
                          placeholder="you@selectquote.com"
                        />
                      </div>
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F47B20] focus:border-[#F47B20]"
                          placeholder="••••••••"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#F47B20] text-white px-6 py-3 rounded-lg font-sq-heading font-semibold hover:bg-[#e06f15] transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Please wait…' : isRegistering ? 'Sign up' : 'Log in'}
                      </button>
                      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                          }}
                          className="text-left text-[#07aec7] hover:text-[#0590a8] font-semibold touch-manipulation"
                        >
                          {isRegistering ? 'Already have an account? Log in' : 'Need an account? Sign up'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmailLogin(false);
                            setError(null);
                            setEmail('');
                            setPassword('');
                            setName('');
                          }}
                          className="text-gray-600 hover:text-gray-800 touch-manipulation sm:text-right"
                        >
                          Back
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="mt-8 text-center">
                  <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 px-3 py-2 sm:px-4 bg-white/20 backdrop-blur-sm rounded-lg text-left sm:inline-flex sm:text-center">
                    <Shield className="w-4 h-4 shrink-0 text-white" aria-hidden />
                    <span className="text-xs sm:text-sm text-white/95 text-balance">
                      Secure access for SelectQuote employees and authorized users
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-12"
        >
          <div className="bg-[#F3F3F3] rounded-xl p-8 border border-gray-200">
            <div className="text-center max-w-2xl mx-auto">
              <h4 className="font-sq-heading text-xl font-bold text-[#231F20] mb-3">Need help signing in?</h4>
              <p className="mb-6 leading-relaxed">
                Your IT team can help with SSO (Auth0), MFA, and account issues. For demos or pilots, administrators
                provide environment setup steps and test credentials.
              </p>
              <p className="text-sm text-[#646464]">
                For roles and openings across SelectQuote, visit{' '}
                <a
                  href="https://www.selectquote.com/careers/"
                  className="text-[#07aec7] font-semibold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Careers at SelectQuote
                </a>
                .
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="bg-[#231F20] text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <Link href="/" className="inline-block">
                  <ImageWithFallback
                    src={SQ_LOGO_SVG}
                    alt="SelectQuote"
                    width={202}
                    height={56}
                    className="h-9 w-auto max-w-[200px] object-contain object-left brightness-0 invert opacity-90 hover:opacity-100 transition-opacity"
                  />
                </Link>
                <div className="font-sq-heading text-xs text-white/60 mt-2">OKR platform</div>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Helping people protect what matters—with unbiased comparisons from trusted carriers. This internal
                portal keeps our teams aligned on that mission.
              </p>
            </div>
            <div>
              <h4 className="font-sq-heading font-semibold mb-4 text-white">Quick links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  <Link href="/my-okrs" className="hover:text-white transition-colors">
                    My OKRs
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-white transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <a
                    href="https://www.selectquote.com/"
                    className="hover:text-white transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    SelectQuote.com
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-sq-heading font-semibold mb-4 text-white">Employees</h4>
              <p className="text-sm text-white/70 leading-relaxed">
                For customer-facing products and legal information, use the public site. Licensed entity name varies
                by state: SelectQuote Insurance Services, SelectQuote Insurance Agency.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-white/60">
            <div>© {new Date().getFullYear()} SelectQuote Insurance Services. All rights reserved.</div>
            <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
              <a
                href="https://www.selectquote.com/legal"
                className="hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Legal
              </a>
              <span>Internal OKR tool</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-12 h-12" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
