
import React, { useState, useEffect, useMemo } from 'react';
import { Caminhao, Motorista, LoadType, Carga, Planta, Justificativa } from '../types';
import { calculateExpectedReturn, findPreviousLoadArrival } from '../utils/logic';
import { Plus, Truck, User, ArrowRight, X, Calendar, MapPin, Gauge, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle, Clock, Info, Navigation, History, Trash2, Pencil, Hash } from 'lucide-react';
import { format, differenceInMinutes, isAfter, startOfDay, endOfDay } from 'date-fns';

interface LoadsProps {
  state: any;
  actions: any;
  isAdmin?: boolean;
  onImport?: () => void;
}

export const Loads: React.FC<LoadsProps> = ({ state, actions, isAdmin, onImport }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ATIVAS' | 'HISTORICO'>('ATIVAS');
  const [now, setNow] = useState(new Date());

  const currentUser = state.currentUser;
  const userPlantId = currentUser?.PlantaId;

  const [selectedPlanta, setSelectedPlanta] = useState<string>(userPlantId || 'all');
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [selectedPlaca, setSelectedPlaca] = useState<string>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const availableCaminhoes = (state.caminhoes || []).filter((c: Caminhao) => !userPlantId || String(c.PlantaId) === String(userPlantId));
  const availableMotoristas = (state.motoristas || []).filter((m: Motorista) => !userPlantId || String(m.PlantaId) === String(userPlantId));

  const visibleCargas = useMemo(() => {
    return (state.cargas || []).filter((c: Carga) => {
      const isStatusMatch = filter === 'ATIVAS' ? c.StatusCarga === 'PENDENTE' : c.StatusCarga === 'CONCLUIDO';
      if (!isStatusMatch) return false;

      const currentViewPlant = userPlantId || selectedPlanta;
      if (currentViewPlant !== 'all' && String(c.PlantaId) !== String(currentViewPlant)) return false;
      
      if (selectedMotorista !== 'all' && String(c.MotoristaId) !== String(selectedMotorista)) return false;
      
      if (selectedPlaca !== 'all' && String(c.CaminhaoId) !== String(selectedPlaca)) return false;

      if (dateStart || dateEnd) {
        const loadDate = new Date(c.DataInicio);
        if (dateStart && isAfter(startOfDay(new Date(dateStart)), loadDate)) return false;
        if (dateEnd && isAfter(loadDate, endOfDay(new Date(dateEnd)))) return false;
      }
      return true;
    }).sort((a: Carga, b: Carga) => {
      if (filter === 'ATIVAS') return new Date(b.DataCriacao).getTime() - new Date(a.DataCriacao).getTime();
      return (new Date(b.ChegadaReal || 0).getTime()) - (new Date(a.ChegadaReal || 0).getTime());
    });
  }, [state.cargas, filter, userPlantId, selectedPlanta, selectedMotorista, selectedPlaca, dateStart, dateEnd]);

  const [formData, setFormData] = useState({ caminhaoId: '', motoristaId: '', tipo: 'CHEIA' as LoadType, dataInicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"), kmPrevisto: 0, roteiro: '' });
  const [editFormData, setEditFormData] = useState({ caminhaoId: '', motoristaId: '', tipo: 'CHEIA' as LoadType, dataInicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"), voltaPrevista: format(new Date(), "yyyy-MM-dd'T'HH:mm"), kmPrevisto: 0, roteiro: '' });
  const [finishData, setFinishData] = useState({ chegadaReal: format(new Date(), "yyyy-MM-dd'T'HH:mm"), kmReal: 0, just1: [] as string[], just2: [] as string[], diff1: 0, diff2: 0 });

  useEffect(() => {
    if (isEditing) {
      const carga = state.cargas.find((c: Carga) => c.CargaId === isEditing);
      if (carga) {
        setEditFormData({
          caminhaoId: carga.CaminhaoId,
          motoristaId: carga.MotoristaId,
          tipo: carga.TipoCarga,
          dataInicio: format(new Date(carga.DataInicio), "yyyy-MM-dd'T'HH:mm"),
          voltaPrevista: format(new Date(carga.VoltaPrevista), "yyyy-MM-dd'T'HH:mm"),
          kmPrevisto: carga.KmPrevisto,
          roteiro: carga.Roteiro || ''
        });
      }
    }
  }, [isEditing, state.cargas]);

  useEffect(() => {
    if (isFinishing) {
        const carga = state.cargas.find((c: any) => c.CargaId === isFinishing);
        if (carga) {
            const chegadaRealDate = new Date(finishData.chegadaReal);
            const prevArrival = findPreviousLoadArrival(carga.CaminhaoId, new Date(carga.DataInicio), state.cargas);
            let d1 = prevArrival ? differenceInMinutes(new Date(carga.DataInicio), prevArrival) : 0;
            const d2 = differenceInMinutes(chegadaRealDate, new Date(carga.VoltaPrevista));
            setFinishData(prev => ({ ...prev, diff1: d1, diff2: d2 }));
        }
    }
  }, [finishData.chegadaReal, isFinishing, state.cargas]);

  const handleCreateLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const caminhao = state.caminhoes.find((c: any) => String(c.CaminhaoId) === String(formData.caminhaoId));
    if (!caminhao) return;
    const voltaPrevista = calculateExpectedReturn(new Date(formData.dataInicio), formData.kmPrevisto, formData.tipo);
    actions.addCarga({
      PlantaId: caminhao.PlantaId,
      CaminhaoId: formData.caminhaoId,
      MotoristaId: formData.motoristaId,
      TipoCarga: formData.tipo,
      DataInicio: new Date(formData.dataInicio),
      KmPrevisto: formData.kmPrevisto,
      VoltaPrevista: voltaPrevista,
      Roteiro: formData.roteiro
    });
    setIsModalOpen(false);
  };

  const handleEditLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const carga = state.cargas.find((c: Carga) => c.CargaId === isEditing);
    if (!carga) return;
    actions.updateCarga({ 
        ...carga, 
        CaminhaoId: editFormData.caminhaoId, 
        MotoristaId: editFormData.motoristaId, 
        TipoCarga: editFormData.tipo, 
        DataInicio: new Date(editFormData.dataInicio), 
        VoltaPrevista: new Date(editFormData.voltaPrevista), 
        KmPrevisto: editFormData.kmPrevisto,
        Roteiro: editFormData.roteiro
    });
    setIsEditing(null);
  };

  const handleFinishLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const carga = state.cargas.find((c: any) => c.CargaId === isFinishing);
    if (!carga) return;
    if (finishData.diff1 > 60 && finishData.just1.length === 0) return alert("Justificativa de Gap obrigatória.");
    if (finishData.diff2 > 30 && finishData.just2.length === 0) return alert("Justificativa de Atraso obrigatória.");
    
    actions.updateCarga({ 
      ...carga, 
      StatusCarga: 'CONCLUIDO', 
      KmReal: finishData.kmReal, 
      ChegadaReal: new Date(finishData.chegadaReal), 
      Diff1_Gap: finishData.diff1, 
      Diff1_Justificativa: finishData.just1.join(', '), 
      Diff2_Atraso: finishData.diff2, 
      Diff2_Justificativa: finishData.just2.join(', ') 
    });
    setIsFinishing(null);
  };

  const inputClass = "w-full border border-blue-100 rounded-xl p-4 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base";
  const labelClass = "text-[10px] font-black text-blue-900 uppercase tracking-[0.15em] mb-1.5 ml-1 block opacity-50";

  // Filtros de justificativas predefinidas
  const justificationsGap = state.justificativas.filter((j: Justificativa) => j.Tipo === 'GAP');
  const justificationsAtraso = state.justificativas.filter((j: Justificativa) => j.Tipo === 'ATRASO');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm space-y-4 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Unidade / Planta</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <select 
                  disabled={!!userPlantId}
                  value={selectedPlanta} 
                  onChange={e => setSelectedPlanta(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none text-sm transition-all disabled:opacity-50"
              >
                  {!userPlantId && <option value="all">Todas as Plantas</option>}
                  {state.plantas.map((p: Planta) => <option key={p.PlantaId} value={p.PlantaId}>{p.NomedaUnidade}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Motorista</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <select value={selectedMotorista} onChange={e => setSelectedMotorista(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none text-sm transition-all"><option value="all">Todos os Motoristas</option>{availableMotoristas.map((m: Motorista) => <option key={m.MotoristaId} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}</select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Placa</label>
            <div className="relative">
              <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <select 
                  value={selectedPlaca} 
                  onChange={e => setSelectedPlaca(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none text-sm transition-all"
              >
                  <option value="all">Todas as Placas</option>
                  {availableCaminhoes.map((c: Caminhao) => <option key={c.CaminhaoId} value={c.CaminhaoId}>{c.Placa}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Início</label><div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} /><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-sm" /></div></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Até</label><div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} /><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-sm" /></div></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-blue-50 shadow-sm overflow-hidden">
          <button onClick={() => setFilter('ATIVAS')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'ATIVAS' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}><Navigation size={12} /> Ativas</button>
          <button onClick={() => setFilter('HISTORICO')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'HISTORICO' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}><History size={12} /> Histórico</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && <button onClick={onImport} className="bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl hover:bg-blue-100 flex items-center justify-center font-black uppercase text-[10px] tracking-widest transition-all"><FileSpreadsheet size={18} className="mr-2" /> Importar Cargas</button>}
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"><Plus size={18} className="mr-2" /> Nova Carga</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {visibleCargas.map((carga: Carga) => {
          const isLate = carga.StatusCarga === 'PENDENTE' && isAfter(now, new Date(carga.VoltaPrevista));
          const isHistory = filter === 'HISTORICO';
          return (
            <div key={carga.CargaId} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm p-6 sm:p-7 space-y-5 hover:shadow-xl transition-all duration-300 relative ${isLate ? 'border-orange-200 bg-orange-50/10' : 'border-blue-50'}`}>
               <div className="absolute top-6 right-4 flex gap-2 z-10">
                   <button onClick={() => setIsEditing(carga.CargaId)} className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={16} /></button>
                   {isAdmin && <button onClick={() => actions.deleteCarga(carga.CargaId)} className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>}
               </div>
               <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-blue-50 text-blue-700 text-[9px] font-black tracking-widest px-3 py-1.5 rounded-full uppercase leading-none w-fit">{carga.TipoCarga}</div>
                    <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase px-3 py-1.5 rounded-full ${isLate ? 'bg-orange-100 text-orange-700' : isHistory ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isLate ? <Clock size={10} /> : isHistory ? <CheckCircle2 size={10} /> : <Navigation size={10} />}
                        {isLate ? 'EM ATRASO' : isHistory ? 'CONCLUÍDO' : 'EM ROTA'}
                    </div>
                  </div>
                  <div className="text-right pr-14">
                      <p className="text-[9px] font-black text-blue-800/30 uppercase leading-none">{isHistory ? 'Finalizada em' : 'Criada em'}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{isHistory && carga.ChegadaReal ? format(new Date(carga.ChegadaReal), 'dd/MM HH:mm') : format(new Date(carga.DataCriacao), 'dd/MM HH:mm')}</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex items-center gap-4">
                      <div className="bg-slate-100 p-3 rounded-2xl text-slate-600"><Truck size={24} /></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xl font-black text-gray-900 italic leading-none truncate uppercase tracking-tighter">{state.caminhoes.find((c: any) => String(c.CaminhaoId) === String(carga.CaminhaoId))?.Placa || '---'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-blue-600 opacity-60">
                                <MapPin size={10} /><p className="text-[9px] font-black uppercase truncate">{state.plantas.find((p: any) => String(p.PlantaId) === String(carga.PlantaId))?.NomedaUnidade}</p>
                            </div>
                            {carga.Roteiro && (
                                <div title={`Roteiro: ${carga.Roteiro}`} className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shadow-sm min-w-0 shrink-0">
                                    <Hash size={11} className="text-slate-400" strokeWidth={3} />
                                    <p className="text-[10px] font-black uppercase truncate tracking-tight">{carga.Roteiro}</p>
                                </div>
                            )}
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm text-gray-400"><User size={18} /></div>
                      <p className="text-xs font-bold text-gray-700 truncate">{state.motoristas.find((m: any) => String(m.MotoristaId) === String(carga.MotoristaId))?.NomedoMotorista || 'Motorista'}</p>
                  </div>
               </div>

               {/* Seção de Tempos e Horários */}
               {isHistory && carga.ChegadaReal ? (() => {
                  const startDate = new Date(carga.DataInicio);
                  const endDate = new Date(carga.ChegadaReal);
                  const totalMin = differenceInMinutes(endDate, startDate);
                  
                  const km = Number(carga.KmReal || 0);
                  const hasValidKm = km > 0;
                  const estimatedRoadMin = hasValidKm ? Math.round((km / 38) * 60) : 0;
                  const unloadMin = Math.max(0, totalMin - estimatedRoadMin);

                  const formatTime = (min: number) => {
                    const h = Math.floor(min / 60);
                    const m = Math.round(min % 60);
                    return `${h}h ${String(m).padStart(2, '0')}m`;
                  };

                  return (
                    <div className="pt-2 space-y-3 bg-slate-50 p-4 rounded-2xl border border-blue-50/50">
                        <div className="grid grid-cols-2 gap-4 border-b border-blue-100 pb-3">
                            <div>
                                <span className="flex items-center text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                    <Calendar className="w-2.5 h-2.5 mr-1" /> Saída
                                </span>
                                <p className="text-sm font-black text-gray-700 italic">
                                    {format(startDate, 'dd/MM HH:mm')}
                                </p>
                            </div>
                            <div>
                                <span className="flex items-center text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Chegada
                                </span>
                                <p className="text-sm font-black text-gray-700 italic">
                                    {format(endDate, 'dd/MM HH:mm')}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="flex items-center text-[8px] font-black text-blue-500/60 uppercase tracking-widest mb-1">
                                    <Truck className="w-2.5 h-2.5 mr-1" /> Jornada
                                </span>
                                <p className="text-sm font-black text-blue-900 italic">
                                    {formatTime(totalMin)}
                                </p>
                            </div>
                            <div>
                                <span className="flex items-center text-[8px] font-black text-orange-500/60 uppercase tracking-widest mb-1">
                                    <Clock className="w-2.5 h-2.5 mr-1" /> Descarga (Est.)
                                </span>
                                <p className="text-sm font-black text-orange-900 italic">
                                    {hasValidKm ? formatTime(unloadMin) : '---'}
                                </p>
                            </div>
                        </div>
                    </div>
                  );
                })() : (
                  <div className="pt-2 grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/30 p-4 rounded-2xl">
                        <div className="flex items-center gap-1.5 mb-1 opacity-30"><Calendar size={10} /><span className="text-[8px] font-black uppercase">Saída</span></div>
                        <p className="text-sm font-black text-gray-800">{format(new Date(carga.DataInicio), 'dd/MM HH:mm')}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-blue-600/5">
                        <div className="flex items-center gap-1.5 mb-1 text-blue-600 opacity-40"><Gauge size={10} /><span className="text-[8px] font-black uppercase italic">Volta Prev.</span></div>
                        <p className={`text-sm font-black ${isLate ? 'text-orange-600' : 'text-blue-700'} italic`}>
                            {format(new Date(carga.VoltaPrevista), 'dd/MM HH:mm')}
                        </p>
                    </div>
                  </div>
                )}

               {!isHistory && (
                  <button onClick={() => setIsFinishing(carga.CargaId)} className="w-full bg-blue-900 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase border border-blue-900 py-4 rounded-2xl hover:bg-black active:scale-95 transition-all shadow-lg shadow-blue-100">Encerrar Rota <ArrowRight size={14} /></button>
               )}
            </div>
          );
        })}
        {visibleCargas.length === 0 && <div className="md:col-span-2 xl:col-span-3 py-20 text-center bg-white/50 rounded-[2rem] border border-dashed border-gray-200"><p className="text-gray-300 font-black uppercase text-xs tracking-widest">Nenhuma carga encontrada.</p></div>}
      </div>

      {(isFinishing || isModalOpen || isEditing) && (
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] w-full max-w-lg p-8 sm:p-10 shadow-2xl relative animate-in slide-in-from-bottom-20 duration-500">
            <button onClick={() => { setIsFinishing(null); setIsModalOpen(false); setIsEditing(null); }} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
            {isFinishing ? (
                <form onSubmit={handleFinishLoad} className="space-y-6 pb-6">
                    <h3 className="text-2xl font-black text-blue-950 uppercase italic mb-8">Encerrar Rota</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Km Real Final</label><input required type="number" value={finishData.kmReal} onChange={e => setFinishData({...finishData, kmReal: Number(e.target.value)})} className={inputClass} /></div>
                        <div><label className={labelClass}>Horário Chegada</label><input required type="datetime-local" value={finishData.chegadaReal} onChange={e => setFinishData({...finishData, chegadaReal: e.target.value})} className={inputClass} /></div>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-gray-50/50 p-4 rounded-3xl border border-blue-50">
                          <label className={labelClass}>Justificativa Gap {finishData.diff1 > 60 && <span className="text-red-500 font-black">(OBRIGATÓRIA)</span>}</label>
                          <select 
                            className={inputClass}
                            value=""
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val && !finishData.just1.includes(val)) {
                                    setFinishData({...finishData, just1: [...finishData.just1, val]});
                                }
                            }}
                          >
                            <option value="">Selecione uma justificativa...</option>
                            {justificationsGap.map(j => <option key={j.id} value={j.Texto}>{j.Texto}</option>)}
                          </select>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {finishData.just1.map((text, idx) => (
                               <div key={idx} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm animate-in zoom-in duration-200">
                                 {text}
                                 <button type="button" onClick={() => setFinishData({...finishData, just1: finishData.just1.filter(t => t !== text)})} className="hover:bg-blue-700 rounded-full p-0.5"><X size={12} /></button>
                               </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-gray-50/50 p-4 rounded-3xl border border-blue-50">
                          <label className={labelClass}>Justificativa Atraso {finishData.diff2 > 30 && <span className="text-orange-500 font-black">(OBRIGATÓRIA)</span>}</label>
                          <select 
                            className={inputClass}
                            value=""
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val && !finishData.just2.includes(val)) {
                                    setFinishData({...finishData, just2: [...finishData.just2, val]});
                                }
                            }}
                          >
                            <option value="">Selecione uma justificativa...</option>
                            {justificationsAtraso.map(j => <option key={j.id} value={j.Texto}>{j.Texto}</option>)}
                          </select>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {finishData.just2.map((text, idx) => (
                               <div key={idx} className="bg-orange-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm animate-in zoom-in duration-200">
                                 {text}
                                 <button type="button" onClick={() => setFinishData({...finishData, just2: finishData.just2.filter(t => t !== text)})} className="hover:bg-orange-700 rounded-full p-0.5"><X size={12} /></button>
                               </div>
                            ))}
                          </div>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl">Finalizar Agora</button>
                </form>
            ) : isEditing ? (
                <form onSubmit={handleEditLoad} className="space-y-6 pb-6">
                    <h3 className="text-2xl font-black text-blue-950 uppercase italic mb-8">Editar Carga</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Caminhão</label><select required value={editFormData.caminhaoId} onChange={e => setEditFormData({...editFormData, caminhaoId: e.target.value})} className={inputClass}>{availableCaminhoes.map((c: Caminhao) => <option key={c.id} value={c.CaminhaoId}>{c.Placa}</option>)}</select></div>
                        <div><label className={labelClass}>Motorista</label><select required value={editFormData.motoristaId} onChange={e => setEditFormData({...editFormData, motoristaId: e.target.value})} className={inputClass}>{availableMotoristas.map((m: Motorista) => <option key={m.id} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}</select></div>
                    </div>
                    <div><label className={labelClass}>Roteiro</label><input type="text" value={editFormData.roteiro} onChange={e => setEditFormData({...editFormData, roteiro: e.target.value})} className={inputClass} placeholder="Opcional" /></div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl">Salvar Alterações</button>
                </form>
            ) : (
                <form onSubmit={handleCreateLoad} className="space-y-6 pb-6">
                    <h3 className="text-2xl font-black text-blue-950 uppercase italic mb-8">Nova Carga SP</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Caminhão</label><select required value={formData.caminhaoId} onChange={e => setFormData({...formData, caminhaoId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableCaminhoes.map((c: Caminhao) => <option key={c.id} value={c.CaminhaoId}>{c.Placa}</option>)}</select></div>
                        <div><label className={labelClass}>Motorista</label><select required value={formData.motoristaId} onChange={e => setFormData({...formData, motoristaId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableMotoristas.map((m: Motorista) => <option key={m.id} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Tipo</label><select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as LoadType})} className={inputClass}><option value="CHEIA">CHEIA</option><option value="COMBINADA 2">COMB. 2</option></select></div>
                        <div><label className={labelClass}>Km Previsto</label><input required type="number" value={formData.kmPrevisto} onChange={e => setFormData({...formData, kmPrevisto: Number(e.target.value)})} className={inputClass} /></div>
                    </div>
                    <div><label className={labelClass}>Roteiro</label><input type="text" value={formData.roteiro} onChange={e => setFormData({...formData, roteiro: e.target.value})} className={inputClass} placeholder="Opcional" /></div>
                    <div><label className={labelClass}>Início da Rota</label><input required type="datetime-local" value={formData.dataInicio} onChange={e => setFormData({...formData, dataInicio: e.target.value})} className={inputClass} /></div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl">Salvar Carga</button>
                </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
