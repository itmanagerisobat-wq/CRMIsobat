export default function CartePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Carte de France</h1>
      <div className="bg-white rounded-lg border border-black/5 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/carte-france.jpg" alt="Carte des departements, regions et zones climatiques de France" className="w-full h-auto rounded" />
      </div>
    </div>
  );
}
