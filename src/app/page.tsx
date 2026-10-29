
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Cloud,
  FileText,
  FlaskConical,
  Globe2,
  GraduationCap,
  HeartPulse,
  Laptop,
  Menu,
  Monitor,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

const posters = [
  {
    id: "EP-001",
    title: "Artificial Intelligence in Modern Healthcare",
    authors: "Dr. Ananya Rao, K. Praveen",
    category: "Healthcare",
    institution: "Institute of Medical Sciences",
    color: "from-blue-100 to-cyan-50",
    accent: "text-blue-700",
    icon: HeartPulse,
  },
  {
    id: "EP-002",
    title: "Machine Learning for Early Disease Detection",
    authors: "S. Rahul, Dr. Meera Nair",
    category: "Technology",
    institution: "School of Computer Science",
    color: "from-violet-100 to-purple-50",
    accent: "text-violet-700",
    icon: FlaskConical,
  },
  {
    id: "EP-003",
    title: "Sustainable Innovation for a Greener Future",
    authors: "P. Harini, V. Karthik",
    category: "Research",
    institution: "Centre for Sustainable Research",
    color: "from-emerald-100 to-teal-50",
    accent: "text-emerald-700",
    icon: GraduationCap,
  },
];

const categories = ["All", "Healthcare", "Technology", "Research"];

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  const filteredPosters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posters.filter((poster) => {
      const matchesCategory =
        category === "All" || poster.category === category;

      const matchesSearch =
        !query ||
        poster.title.toLowerCase().includes(query) ||
        poster.authors.toLowerCase().includes(query) ||
        poster.id.toLowerCase().includes(query) ||
        poster.institution.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <FileText size={23} />
            </span>
            <span>
              <span className="block text-xl font-extrabold tracking-tight">
                ePoster<span className="text-blue-600">.</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.19em] text-slate-500">
                Research made visible
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#home"
              className="text-sm font-semibold text-slate-700 transition hover:text-blue-600"
            >
              Home
            </a>
            <a
              href="/posters"
              className="text-sm font-semibold text-slate-700 transition hover:text-blue-600"
            >
              Explore posters
            </a>
            <a
              href="#features"
              className="text-sm font-semibold text-slate-700 transition hover:text-blue-600"
            >
              Features
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                isOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
              title={
                isOnline
                  ? "Internet connection detected"
                  : "Internet connection unavailable"
              }
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? "Online" : "Offline"}
            </div>

            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              Submit ePoster <ArrowUpRight size={16} />
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 md:hidden"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-slate-100 bg-white px-5 py-5 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-4">
              <a href="#home" onClick={() => setMenuOpen(false)} className="text-sm font-semibold">
                Home
              </a>
              <Link
                href="/posters"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold"
              >
                Explore posters
              </Link>
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm font-semibold">
                Features
              </a>
              <Link
                href="/submit"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white"
              >
                Submit ePoster
              </Link>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
                {isOnline ? "Internet connection detected" : "Currently offline"}
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section id="home" className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.10),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_40%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 shadow-sm">
              <Sparkles size={15} className="text-blue-600" />
              <span className="text-xs font-bold tracking-wide text-slate-700">
                A smarter way to present research
              </span>
            </div>

            <h1 className="max-w-2xl text-4xl leading-[1.12] font-black tracking-tight text-slate-950 sm:text-5xl lg:text-[64px]">
              Great research
              <br />
              deserves a{" "}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                bigger stage.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Submit your scientific poster, showcase your discoveries, and
              explore innovative research — all in one beautifully simple
              conference platform.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-blue-700"
              >
                Submit your research <ArrowRight size={17} />
              </Link>
              <Link
                href="/posters"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              >
                Explore posters <ArrowUpRight size={17} />
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Easy submission
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                Reliable local storage
              </span>
            </div>
          </motion.div>

          {/* Visual preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="relative mx-auto w-full max-w-[520px]"
          >
            <div className="absolute -inset-5 rounded-[40px] bg-gradient-to-br from-blue-200/50 to-cyan-100/40 blur-2xl" />

            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/40 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Monitor size={21} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">Research gallery</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Conference showcase
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                  Preview
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-5">
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <HeartPulse size={21} />
                  </div>
                  <p className="mt-4 text-xs font-bold text-slate-800">
                    Clinical research
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Discover new findings
                  </p>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-blue-100">
                    <div className="h-1.5 w-3/4 rounded-full bg-blue-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <FlaskConical size={21} />
                  </div>
                  <p className="mt-4 text-xs font-bold text-slate-800">
                    New discoveries
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Explore innovations
                  </p>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-violet-100">
                    <div className="h-1.5 w-2/3 rounded-full bg-violet-500" />
                  </div>
                </div>

                <div className="col-span-2 rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-blue-300">
                        BUILT FOR CONFERENCES
                      </p>
                      <p className="mt-2 text-lg font-extrabold sm:text-xl">
                        Your research, beautifully presented.
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-400">
                        A simple space for ideas, discoveries, and meaningful
                        scientific conversations.
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
                      <GraduationCap size={25} />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Cloud size={15} />
                    Online access, with offline support being built
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 top-20 hidden items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:flex sm:-right-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} />
              </span>
              <span>
                <span className="block text-xs font-extrabold">Simple & organized</span>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Research in one place
                </span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature strip */}
      <section id="features" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-8 md:grid-cols-3 lg:px-10">
          <div className="flex items-start gap-4 border-b border-slate-100 py-6 md:border-r md:border-b-0 md:pr-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <FileText size={21} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Easy submissions</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                A streamlined process for sharing your scientific work.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 border-b border-slate-100 py-6 md:border-r md:border-b-0 md:px-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <BookOpen size={21} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Research discovery</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Find posters by title, author, category, and institution.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 py-6 md:pl-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Laptop size={21} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold">Offline-ready design</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Built toward reliable access when conference connectivity fails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Poster gallery */}
      <section id="posters" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
              <span className="h-1.5 w-6 rounded-full bg-blue-600" />
              Discover research
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Explore the poster gallery
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
              Discover ideas and research across different fields. These are
              sample cards for our UI preview; real submissions will be
              connected in a later step.
            </p>
          </div>

          <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 md:max-w-[300px]">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sample posters..."
              aria-label="Search sample posters"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                category === item
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/15"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosters.map((poster, index) => {
            const PosterIcon = poster.icon;

            return (
              <motion.article
                key={poster.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.35, delay: index * 0.07 }}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60"
              >
                <div className={`relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br ${poster.color}`}>
                  <div className="absolute inset-4 rounded-xl border border-white/70 bg-white/45" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white bg-white/90 shadow-lg">
                    <PosterIcon size={37} className={poster.accent} />
                  </div>
                  <span className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-slate-700">
                    {poster.id}
                  </span>
                  <span className="absolute bottom-4 right-4 rounded-lg bg-white/90 px-3 py-1.5 text-[10px] font-bold text-slate-600">
                    Sample preview
                  </span>
                </div>

                <div className="p-5">
                  <span className={`inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold ${poster.accent}`}>
                    {poster.category}
                  </span>
                  <h3 className="mt-4 min-h-[52px] text-lg leading-7 font-extrabold text-slate-900 transition group-hover:text-blue-700">
                    {poster.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-500">
                    {poster.authors}
                  </p>
                  <p className="mt-2 min-h-[40px] text-xs leading-5 text-slate-400">
                    {poster.institution}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-semibold text-slate-400">
                      Demonstration data
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">
                      Coming soon <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {filteredPosters.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
            <Search size={30} className="mx-auto text-slate-400" />
            <h3 className="mt-4 font-bold text-slate-800">No matching posters</h3>
            <p className="mt-2 text-sm text-slate-500">
              Try another search term or choose a different category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
              className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Call to action */}
      <section className="px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 px-6 py-12 text-white sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                <Sparkles size={14} /> Share your discovery
              </span>
              <h2 className="mt-5 text-3xl leading-tight font-black tracking-tight sm:text-4xl">
                Have research worth sharing?
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
                Get ready to showcase your work. Our submission experience is
                the next part of the ePoster journey.
              </p>
            </div>

            <Link
              href="/submit"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-sm font-extrabold text-blue-700 transition hover:-translate-y-1 hover:bg-blue-50"
            >
              Start a submission <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileText size={17} />
            </span>
            <span className="text-sm font-extrabold tracking-tight">
              ePoster<span className="text-blue-600">.</span>
            </span>
          </Link>

          <p className="text-xs leading-6 text-slate-500">
            A conference research showcase. Built for reliable access.
          </p>

          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <Globe2 size={14} />
            Online & offline-ready
          </span>
        </div>
      </footer>
    </main>
  );
}
