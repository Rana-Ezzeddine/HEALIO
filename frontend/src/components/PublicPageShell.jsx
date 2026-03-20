import Navbar from "./Navbar";
import PublicFooter from "./PublicFooter";

export default function PublicPageShell({ title, intro, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative z-10">
        <Navbar />

        <main className="px-6 pb-20 pt-32">
          <div className="mx-auto max-w-4xl">
            <div className="page-enter rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-xl backdrop-blur md:p-12">
              <span className="inline-flex rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-700">
                HEALIO Public Information
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">{intro}</p>
              <div className="mt-10 space-y-10">{children}</div>
            </div>
          </div>
        </main>

        <PublicFooter />
      </div>
    </div>
  );
}
