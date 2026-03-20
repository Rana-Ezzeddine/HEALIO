import { Link } from "react-router-dom";

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-slate-800">HEALIO</p>
          <p className="mt-1">Secure care coordination for patients, caregivers, and doctors.</p>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <Link to="/support" className="transition hover:text-slate-900">
            Support
          </Link>
          <Link to="/privacy" className="transition hover:text-slate-900">
            Privacy
          </Link>
          <Link to="/terms" className="transition hover:text-slate-900">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
