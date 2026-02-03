export default function DashboardPatient(){
  return(
   <div className="min-h-screen bg-gradient-to-b from-sky-100 to-white">
    <header className="max-w-6xl flex p-6 items-center justify-between mx-auto">
      <div>
        <h1 className="font-bold text-slate-800 text-3xl">Welcome, </h1>
        <p className="text-sm font-semibold text-slate-600">Role: Patient</p>
      </div>
      <div className="flex gap-3">
        <button
        type="button"
        className="bg-sky-600 px-4 py-2 text-white rounded-lg px-4 py-2 hover:bg-sky-500">
          Notifications
        </button>
        <button
        type="button"
        className="bg-sky-600 px-4 py-2 text-white rounded-lg px-4 py-2 hover:bg-sky-500">
          Profile
        </button>
        <button
        type="button"
        className="bg-white px-4 py-2 text-slate-800 border border-slate-800 rounded-lg px-4 py-2 hover:bg-sky-50">
          Logout
        </button>
      </div>
    </header>
    <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 ">
      <section className="col-span-2 bg-white">
        <h2>Upcoming appointments</h2>
      </section>
    </main>
   </div>
  );
}