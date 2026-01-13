
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Planta, Carga } from '../types';
import { Clock, TrendingUp, CheckCircle2, Factory, Calendar, MapPin, Gauge, Activity } from 'lucide-react';
import { format, differenceInMinutes, isWithinInterval, startOfMonth, startOfDay, endOfDay, parseISO, subMonths } from 'date-fns';

interface IndicatorsProps {
  state: any;
}

export const Indicators: React.FC<IndicatorsProps> = ({ state }) => {
  const currentUser = state.currentUser;
  const userPlantId = currentUser?.PlantaId;

  // Inicia o filtro com a planta do usuário se ele for operador, caso contrário inicia com 'all'
  const [dateStart, setDateStart] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedPlanta, setSelectedPlanta] = useState<string>(userPlantId || 'all');

  const cargas = state.cargas || [];
  const plantas = state.plantas || [];

  const filteredCargas = useMemo(() => {
    return cargas.filter((c: Carga) => {
      const isFinalizada = c['StatusCarga'] === 'CONCLUIDO';
      
      // Lógica de separação por PlantaId: 
      // Se houver uma planta selecionada (ou travada pelo usuário), filtra estritamente por ela.
      const currentViewPlant = userPlantId || selectedPlanta;
      const isPlantaMatch = currentViewPlant === 'all' || c['PlantaId'] === currentViewPlant;
      
      const date = new Date(c['DataInicio']);
      const isDateMatch = isWithinInterval(date, {
        start: startOfDay(new Date(dateStart)),
        end: endOfDay(new Date(dateEnd))
      });
      return isFinalizada && isPlantaMatch && isDateMatch;
    });
  }, [cargas, userPlantId, selectedPlanta, dateStart, dateEnd]);

  const metrics = useMemo(() => {
    if (filteredCargas.length === 0) return {
      avgRouteTime: 0,
      avgKm: 0,
      avgUnloadTime: 0,
      totalKm: 0,
      kmPerDay: 0
    };

    const totalMinutes = filteredCargas.reduce((acc, c) => {
      if (!c.ChegadaReal) return acc;
      return acc + differenceInMinutes(new Date(c.ChegadaReal), new Date(c.DataInicio));
    }, 0);

    const totalKm = filteredCargas.reduce((acc, c) => acc + (c.KmReal || 0), 0);

    const totalUnloadMinutes = filteredCargas.reduce((acc, c) => {
        if (!c.ChegadaReal || !c.KmReal) return acc;
        const actualMinutes = differenceInMinutes(new Date(c.ChegadaReal), new Date(c.DataInicio));
        const estimatedTravelMinutes = (c.KmReal / 38) * 60;
        const unload = Math.max(0, actualMinutes - estimatedTravelMinutes);
        return acc + unload;
    }, 0);

    const uniqueDays = new Set(filteredCargas.map(c => format(new Date(c.DataInicio), 'yyyy-MM-dd'))).size;

    return {
      avgRouteTime: Math.round(totalMinutes / filteredCargas.length),
      avgKm: Math.round(totalKm / filteredCargas.length),
      avgUnloadTime: Math.round(totalUnloadMinutes / filteredCargas.length),
      totalKm: totalKm,
      kmPerDay: uniqueDays > 0 ? Math.round(totalKm / uniqueDays) : 0
    };
  }, [filteredCargas]);

  const chartData = useMemo(() => {
    const monthlyData: Record<string, number> = {};
    const currentViewPlant = userPlantId || selectedPlanta;
    
    const allFinalized = cargas.filter((c: Carga) => 
        c['StatusCarga'] === 'CONCLUIDO' && (currentViewPlant === 'all' || c['PlantaId'] === currentViewPlant)
    );

    allFinalized.forEach(c => {
        const month = format(new Date(c.DataInicio), 'MM/yyyy');
        monthlyData[month] = (monthlyData[month] || 0) + (c.KmReal || 0);
    });

    return Object.entries(monthlyData)
      .map(([name, km]) => ({ name, km }))
      .sort((a, b) => {
          const [mA, yA] = a.name.split('/').map(Number);
          const [mB, yB] = b.name.split('/').map(Number);
          return (yA * 12 + mA) - (yB * 12 + mB);
      });
  }, [cargas, userPlantId, selectedPlanta]);

  const Card = ({ title, value, unit, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-[2rem] border border-blue-50 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
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
      <div className="bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Unidade</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
            <select 
                disabled={!!userPlantId}
                value={selectedPlanta} 
                onChange={e => setSelectedPlanta(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none disabled:opacity-50"
            >
                {!userPlantId && <option value="all">Todas as Plantas</option>}
                {plantas.map((p: Planta) => (
                    <option key={p.PlantaId} value={p.PlantaId}>{p.NomedaUnidade}</option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Início</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
            <input 
                type="date" 
                value={dateStart} 
                onChange={e => setDateStart(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
            />
          </div>
        </div>
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Fim</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
            <input 
                type="date" 
                value={dateEnd} 
                onChange={e => setDateEnd(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Tempo em Rota" value={metrics.avgRouteTime} unit="min" icon={Clock} color="bg-blue-50 text-blue-600" />
        <Card title="Km Médio" value={metrics.avgKm} unit="km" icon={Gauge} color="bg-indigo-50 text-indigo-600" />
        <Card title="Tempo Descarga" value={metrics.avgUnloadTime} unit="min" icon={TrendingUp} color="bg-cyan-50 text-cyan-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Km Total Período" value={metrics.totalKm} unit="km" icon={Activity} color="bg-blue-600 text-white" />
        <Card title="Km Médio Dia" value={metrics.kmPerDay} unit="km/dia" icon={Calendar} color="bg-slate-900 text-white" />
      </div>

      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-blue-50 shadow-sm">
        <div className="flex justify-between items-center mb-10">
            <h3 className="text-lg font-black text-blue-950 uppercase italic tracking-tighter leading-none">KM Total por Mês</h3>
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <span className="text-[9px] font-black uppercase text-gray-400">Distância Percorrida</span>
            </div>
        </div>
        <div className="h-72 sm:h-96 w-full -ml-6 sm:ml-0">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="name" 
                        tick={{fontSize: 10, fontWeight: 900, fill: '#cbd5e1'}} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <YAxis 
                        tick={{fontSize: 10, fontWeight: 700, fill: '#cbd5e1'}} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <Tooltip 
                        contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '15px'}}
                        cursor={{fill: '#f8fafc'}}
                        formatter={(value) => [`${value} km`, 'Kilometragem']}
                    />
                    <Bar dataKey="km" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#1e1b4b' : '#2563eb'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
