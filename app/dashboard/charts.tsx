'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { STATUT_COLORS, STATUT_LABELS } from '@/lib/types';
import { colorForName } from '@/lib/palette';

interface Props {
  byMonth: { month: string; total: number }[];
  byStatut: { statut: string; total: number }[];
  byOperation: { name: string; total: number }[];
  byPrestataire: { name: string; total: number }[];
  operationsCanonical: string[];
  prestatairesCanonical: string[];
  tauxParMois: { month: string; taux: number }[];
}

export default function DashboardCharts({
  byMonth, byStatut, byOperation, byPrestataire, operationsCanonical, prestatairesCanonical, tauxParMois,
}: Props) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="RDV par mois">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" fill="#0E8A3E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Tendance : taux de transformation par mois">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={tauxParMois}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Taux honore']} />
            <Line type="monotone" dataKey="taux" stroke="#C9A227" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Repartition par statut">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={byStatut}
              dataKey="total"
              nameKey="statut"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {byStatut.map((entry) => (
                <Cell key={entry.statut} fill={STATUT_COLORS[entry.statut] || '#ccc'} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [v, STATUT_LABELS[n] || n]} />
            <Legend formatter={(v: string) => STATUT_LABELS[v] || v} />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Repartition par operation">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={byOperation} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {byOperation.map((entry) => (
                <Cell key={entry.name} fill={colorForName(entry.name, operationsCanonical)} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Repartition par prestataire">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={byPrestataire} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {byPrestataire.map((entry) => (
                <Cell key={entry.name} fill={colorForName(entry.name, prestatairesCanonical)} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border border-black/5 p-4 ${full ? 'lg:col-span-2' : ''}`}>
      <h2 className="font-semibold text-ink mb-3">{title}</h2>
      {children}
    </div>
  );
}

