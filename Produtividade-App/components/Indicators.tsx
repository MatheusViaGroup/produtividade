
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Planta, Motorista, Carga } from '../types';
import { Clock, TrendingUp, CheckCircle2, Factory } from 'lucide-react';

interface IndicatorsProps {
  state: any;
}

export const Indicators: React.FC<IndicatorsProps> = ({ state }) => {
  const cargas = state.cargas || [];
  const plantas = state.plantas || [];

  const completedCargas = useMemo(() => cargas.filter((c: Carga) => c['StatusCarga'] === 'FINALIZADA'), [cargas]);

  const statsByPlanta = useMemo(() => {
    return plantas.map((p: Planta) => {
      const pCargas = completedCargas.filter((c: Carga) => c['PlantaId'] === p['PlantaId']);
      if (pCargas.length === 0) return { name: p['NomedaUnidade'], diff1: 0, diff2: 0 };
      const avgDiff1 = pCargas.reduce((acc: number, cur: Carga) => acc + (cur['Diff1_Gap'] || 0), 0) / pCargas.length;
      const avgDiff2 = pCargas.reduce((acc: number, cur: Carga) => acc + (cur['Diff2.Atraso'] || 0), 0) / pCargas.length;
      return { name: p['NomedaUnidade'], diff1: Math.round(avgDiff1), diff2: Math.round(avgDiff2) };
    });
  }, [plantas, completedCargas]);

  const globalAverages = useMemo(() => {
    if (completedCargas.length === 0) return { diff1: 0, diff2: 0 };
    const avg1 = completedCargas.reduce((acc: number, cur: Carga) => acc + (cur['Diff1_Gap'] || 0), 0) / completedCargas.length;
    const avg2 = completedCargas.reduce((acc: number, cur: Carga) => acc + (cur['Diff2.Atraso'] || 0), 0) / completedCargas.length;
    return { diff1: Math.round(avg1), diff2: Math.round(avg2) };
  }, [completedCargas]);

  const Card = ({ title, value, unit, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-[2rem] border border-blue-50 shadow-sm flex items-center gap-5">
      <div className={`p-4 rounded-2xl ${color} shadow-sm`}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none">{title}</p>
        <p className="text-2xl font-black text-gray-900 mt-2 flex items-baseline gap-1 leading-none">
            {value} 
            {unit && <span className="text-[10px] font-bold text-gray-400 uppercase">{unit}</span>}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Gap Médio" value={globalAverages.diff1} unit="min" icon={Clock} color="bg-blue-50 text-blue-600" />
        <Card title="Atraso Médio" value={globalAverages.diff2} unit="min" icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
        <Card title="Finalizadas" value={completedCargas.length} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <Card title="Plantas Ativas" value={plantas.length} icon={Factory} color="bg-slate-50 text-slate-600" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-blue-50 shadow-sm">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-lg font-black text-blue-950 uppercase italic tracking-tighter leading-none">Métricas por Unidade</h3>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[9px] font-black uppercase text-gray-400">Gap</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-900"></div><span className="text-[9px] font-black uppercase text-gray-400">Atraso</span></div>
                </div>
            </div>
            <div className="h-72 sm:h-96 w-full -ml-6 sm:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsByPlanta}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 900, fill: '#cbd5e1'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 10, fontWeight: 700, fill: '#cbd5e1'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '15px'}}
                            cursor={{fill: '#f8fafc'}}
                        />
                        <Bar name="Gap" dataKey="diff1" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={20} />
                        <Bar name="Atraso" dataKey="diff2" fill="#1e1b4b" radius={[8, 8, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};
