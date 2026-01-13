
import React, { useState, useEffect, useMemo } from 'react';
import { Caminhao, Motorista, LoadType, Carga, Planta } from '../types';
import { calculateExpectedReturn, findPreviousLoadArrival } from '../utils/logic';
import { Plus, Truck, User, ArrowRight, X, Calendar, MapPin, Gauge, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle, Clock, Info, Navigation, History, Trash2, Pencil } from 'lucide-react';
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

  const [selectedPlanta, setSelectedPlanta] = useState<string>('all');
  const [selectedMotorista, setSelectedMotorista] = useState<string>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentUser = state.currentUser;
  const userPlantId = currentUser?.['PlantaId'];

  const availableCaminhoes = (state.caminhoes || []).filter((c: Caminhao) => !userPlantId || c['PlantaId'] === userPlantId);
  const availableMotoristas = (state.motoristas || []).filter((m: Motorista) => !userPlantId || m['PlantaId'] === userPlantId);

  const visibleCargas = useMemo(() => {
    return (state.cargas || []).filter((c: Carga) => {
      const isStatusMatch = filter === 'ATIVAS' ? c['StatusCarga'] === 'PENDENTE' : c['StatusCarga'] === 'CONCLUIDO';
      if (!isStatusMatch) return false;

      if (userPlantId && c['PlantaId'] !== userPlantId) return false;
      if (selectedPlanta !== 'all' && c['PlantaId'] !== selectedPlanta) return false;
      if (selectedMotorista !== 'all' && c['MotoristaId'] !== selectedMotorista) return false;

      if (dateStart || dateEnd) {
        const loadDate = new Date(c['DataInicio']);
        if (dateStart) {
          if (isAfter(startOfDay(new Date(dateStart)), loadDate)) return false;
        }
        if (dateEnd) {
          if (isAfter(loadDate, endOfDay(new Date(dateEnd)))) return false;
        }
      }

      return true;
    }).sort((a: Carga, b: Carga) => {
      if (filter === 'ATIVAS') return new Date(b['DataCriacao']).getTime() - new Date(a['DataCriacao']).getTime();
      return (new Date(b['ChegadaReal'] || 0).getTime()) - (new Date(a['ChegadaReal'] || 0).getTime());
    });
  }, [state.cargas, filter, userPlantId, selectedPlanta, selectedMotorista, dateStart, dateEnd]);

  const [formData, setFormData] = useState({
    caminhaoId: '',
    motoristaId: '',
    tipo: 'CHEIA' as LoadType,
    dataInicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kmPrevisto: 0,
  });

  const [editFormData, setEditFormData] = useState({
    caminhaoId: '',
    motoristaId: '',
    tipo: 'CHEIA' as LoadType,
    dataInicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    voltaPrevista: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kmPrevisto: 0,
  });

  const [finishData, setFinishData] = useState({
    chegadaReal: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kmReal: 0,
    just1: '',
    just2: '',
    diff1: 0,
    diff2: 0
  });

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
        });
      }
    }
  }, [isEditing, state.cargas]);

  useEffect(() => {
    if (isFinishing) {
        const carga = state.cargas.find((c: any) => c['CargaId'] === isFinishing);
        if (carga) {
            const chegadaRealDate = new Date(finishData.chegadaReal);
            const prevArrival = findPreviousLoadArrival(carga['CaminhaoId'], new Date(carga['DataInicio']), state.cargas);
            
            let d1 = 0; 
            if (prevArrival) { 
                d1 = differenceInMinutes(new Date(carga['DataInicio']), prevArrival); 
            }
            
            const d2 = differenceInMinutes(chegadaRealDate, new Date(carga['VoltaPrevista']));
            setFinishData(prev => ({ ...prev, diff1: d1, diff2: d2 }));
        }
    }
  }, [finishData.chegadaReal, isFinishing, state.cargas]);

  const handleCreateLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const caminhao = state.caminhoes.find((c: any) => c['CaminhaoId'] === formData.caminhaoId);
    if (!caminhao) return;
    const voltaPrevista = calculateExpectedReturn(new Date(formData.dataInicio), formData.kmPrevisto, formData.tipo);
    actions.addCarga({
      'PlantaId': caminhao['PlantaId'],
      'CaminhaoId': formData.caminhaoId,
      'MotoristaId': formData.motoristaId,
      'TipoCarga': formData.tipo,
      'DataInicio': new Date(formData.dataInicio),
      'KmPrevisto': formData.kmPrevisto,
      'VoltaPrevista': voltaPrevista,
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
    });
    setIsEditing(null);
  };

  const handleDeleteLoadFromEdit = () => {
    if (isEditing && window.confirm("Tem certeza que deseja excluir esta carga permanentemente?")) {
      actions.deleteCarga(isEditing);
      setIsEditing(null);
    }
  };

  const handleFinishLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const carga = state.cargas.find((c: any) => c['CargaId'] === isFinishing);
    if (!carga) return;

    const gapNecessitaJustificativa = finishData.diff1 > 60;
    const atrasoNecessitaJustificativa = finishData.diff2 > 30;

    if (gapNecessitaJustificativa && !finishData.just1.trim()) {
        alert("O Gap entre viagens é superior a 1 hora. Por favor, insira uma justificativa.");
        return;
    }

    if (atrasoNecessitaJustificativa && !finishData.just2.trim()) {
        alert("O atraso da viagem é superior a 30 minutos. Por favor, insira uma justificativa.");
        return;
    }

    const chegadaRealDate = new Date(finishData.chegadaReal);
    
    actions.updateCarga({
      ...carga,
      'StatusCarga': 'CONCLUIDO', 
      'KmReal': finishData.kmReal, 
      'ChegadaReal': chegadaRealDate,
      'Diff1_Gap': finishData.diff1, 
      'Diff1_Justificativa': finishData.just1, 
      'Diff2_Atraso': finishData.diff2, 
      'Diff2_Justificativa': finishData.just2,
    });
    setIsFinishing(null);
  };

  const inputClass = "w-full border border-blue-100 rounded-xl p-4 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base";
  const labelClass = "text-[10px] font-black text-blue-900 uppercase tracking-[0.15em] mb-1.5 ml-1 block opacity-50";

  const gapError = finishData.diff1 > 60 && !finishData.just1.trim();
  const delayError = finishData.diff2 > 30 && !finishData.just2.trim();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm space-y-4 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Unidade / Planta</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <select 
                  value={selectedPlanta} 
                  onChange={e => setSelectedPlanta(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none text-sm transition-all"
              >
                  <option value="all">Todas as Plantas</option>
                  {state.plantas.map((p: Planta) => (
                      <option key={p.PlantaId} value={p.PlantaId}>{p.NomedaUnidade}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Motorista</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <select 
                  value={selectedMotorista} 
                  onChange={e => setSelectedMotorista(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 appearance-none text-sm transition-all"
              >
                  <option value="all">Todos os Motoristas</option>
                  {availableMotoristas.map((m: Motorista) => (
                      <option key={m.MotoristaId} value={m.MotoristaId}>{m.NomedoMotorista}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Data Início</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <input 
                  type="date" 
                  value={dateStart} 
                  onChange={e => setDateStart(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-blue-800/40 uppercase tracking-widest ml-1">Até</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
              <input 
                  type="date" 
                  value={dateEnd} 
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50/30 border border-blue-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-blue-50 shadow-sm overflow-hidden">
          <button onClick={() => setFilter('ATIVAS')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'ATIVAS' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}>
            <Navigation size={12} /> Ativas
          </button>
          <button onClick={() => setFilter('HISTORICO')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'HISTORICO' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}>
            <History size={12} /> Histórico
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && (
                <button onClick={onImport} className="bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl hover:bg-blue-100 flex items-center justify-center font-black uppercase text-[10px] tracking-widest transition-all">
                    <FileSpreadsheet size={18} className="mr-2" /> Importar Cargas
                </button>
            )}
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">
                <Plus size={18} className="mr-2" /> Nova Carga
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {visibleCargas.map((carga: Carga) => {
          const hasDivergence = (carga.Diff1_Gap || 0) > 60 || (carga.Diff2_Atraso || 0) > 30;
          const isLate = carga.StatusCarga === 'PENDENTE' && isAfter(now, new Date(carga.VoltaPrevista));
          const isHistory = filter === 'HISTORICO';
          const totalRouteMinutes = carga.ChegadaReal ? differenceInMinutes(new Date(carga.ChegadaReal), new Date(carga.DataInicio)) : 0;
          
          return (
            <div key={carga['CargaId']} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm p-6 sm:p-7 space-y-5 hover:shadow-xl transition-all duration-300 relative ${isLate ? 'border-orange-200 bg-orange-50/10' : isHistory ? (hasDivergence ? 'border-red-200 bg-red-50/5' : 'border-emerald-100 bg-emerald-50/5') : 'border-blue-50'}`}>
               
               {isHistory && (
                   <div className={`absolute left-0 top-0 bottom-0 w-2 ${hasDivergence ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
               )}

               <div className="absolute top-6 right-4 flex gap-2 z-10">
                   <button 
                       onClick={(e) => {
                           e.stopPropagation();
                           setIsEditing(carga['CargaId']);
                       }}
                       className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                       title="Editar Carga"
                   >
                       <Pencil size={16} />
                   </button>
                   {isAdmin && (
                       <button 
                           onClick={(e) => {
                               e.stopPropagation();
                               if (window.confirm("Tem certeza que deseja excluir esta carga permanentemente do SharePoint?")) {
                                   actions.deleteCarga(carga['CargaId']);
                               }
                           }}
                           className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                           title="Excluir Carga"
                       >
                           <Trash2 size={16} />
                       </button>
                   )}
               </div>

               <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-blue-50 text-blue-700 text-[9px] font-black tracking-widest px-3 py-1.5 rounded-full uppercase leading-none w-fit">
                        {carga['TipoCarga']}
                    </div>
                    {isHistory ? (
                        <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase px-3 py-1.5 rounded-full ${hasDivergence ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {hasDivergence ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                            {hasDivergence ? 'PENDÊNCIA REGISTRADA' : 'CONCLUÍDO'}
                        </div>
                    ) : (
                        <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase px-3 py-1.5 rounded-full ${isLate ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isLate ? <Clock size={10} /> : <Navigation size={10} />}
                            {isLate ? 'EM ATRASO' : 'PENDENTE (EM ROTA)'}
                        </div>
                    )}
                  </div>
                  <div className={`text-right pr-14`}>
                      <p className="text-[9px] font-black text-blue-800/30 uppercase leading-none">{isHistory ? 'Finalizada em' : 'Criada em'}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{isHistory && carga.ChegadaReal ? format(new Date(carga.ChegadaReal), 'dd/MM HH:mm') : format(new Date(carga.DataCriacao), 'dd/MM HH:mm')}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-4">
                      <div className="bg-slate-100 p-3 rounded-2xl text-slate-600"><Truck size={24} /></div>
                      <div className="flex-1 min-w-0">
                          <p className="text-xl font-black text-gray-900 italic leading-none truncate uppercase tracking-tighter">
                              {state.caminhoes.find((c: any) => c['CaminhaoId'] === carga['CaminhaoId'])?.['Placa'] || '---'}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-blue-600 opacity-60">
                              <MapPin size={10} />
                              <p className="text-[9px] font-black uppercase truncate">{state.plantas.find((p: any) => p['PlantaId'] === carga['PlantaId'])?.['NomedaUnidade']}</p>
                          </div>
                      </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm text-gray-400"><User size={18} /></div>
                      <p className="text-xs font-bold text-gray-700 truncate">{state.motoristas.find((m: any) => m['MotoristaId'] === carga['MotoristaId'])?.['NomedoMotorista'] || 'Motorista'}</p>
                  </div>
               </div>

               {isHistory && (
                   <div className="grid grid-cols-2 gap-2">
                       <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                           <p className="text-[8px] font-black text-blue-600 uppercase mb-1">Tempo em Rota</p>
                           <p className="text-xs font-black text-blue-900">{Math.floor(totalRouteMinutes / 60)}h {totalRouteMinutes % 60}m</p>
                       </div>
                       <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                           <p className="text-[8px] font-black text-indigo-600 uppercase mb-1">Km Real</p>
                           <p className="text-xs font-black text-indigo-900">{carga.KmReal || 0} km</p>
                       </div>
                   </div>
               )}

               {isHistory && hasDivergence && (
                   <div className="p-3 bg-red-50 rounded-2xl border border-red-100 space-y-1">
                       <p className="text-[8px] font-black text-red-600 uppercase flex items-center gap-1"><Info size={8} /> Justificativas pendentes:</p>
                       <div className="flex flex-wrap gap-2">
                           {carga.Diff1_Gap && carga.Diff1_Gap > 60 && <span className="text-[7px] font-black bg-red-200 text-red-800 px-1.5 py-0.5 rounded uppercase">Gap: {carga.Diff1_Gap}m</span>}
                           {carga.Diff2_Atraso && carga.Diff2_Atraso > 30 && <span className="text-[7px] font-black bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded uppercase">Atraso: {carga.Diff2_Atraso}m</span>}
                       </div>
                   </div>
               )}

               <div className="pt-2 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50/30 p-4 rounded-2xl">
                      <div className="flex items-center gap-1.5 mb-1 opacity-30">
                          <Calendar size={10} />
                          <span className="text-[8px] font-black uppercase">Saída</span>
                      </div>
                      <p className="text-sm font-black text-gray-800">{format(new Date(carga['DataInicio']), 'dd/MM HH:mm')}</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${carga.StatusCarga === 'CONCLUIDO' ? 'bg-slate-100' : 'bg-blue-600/5'}`}>
                      <div className={`flex items-center gap-1.5 mb-1 ${carga.StatusCarga === 'CONCLUIDO' ? 'text-gray-400' : 'text-blue-600'} opacity-40`}>
                          <Gauge size={10} />
                          <span className="text-[8px] font-black uppercase italic">{carga.StatusCarga === 'CONCLUIDO' ? 'Chegada Real' : 'Volta Prev.'}</span>
                      </div>
                      <p className={`text-sm font-black ${carga.StatusCarga === 'CONCLUIDO' ? 'text-gray-600' : isLate ? 'text-orange-600' : 'text-blue-700'} italic`}>
                          {carga.StatusCarga === 'CONCLUIDO' && carga.ChegadaReal ? format(new Date(carga.ChegadaReal), 'dd/MM HH:mm') : format(new Date(carga.VoltaPrevista), 'dd/MM HH:mm')}
                      </p>
                  </div>
               </div>

               {carga['StatusCarga'] === 'PENDENTE' && (
                  <button onClick={() => setIsFinishing(carga['CargaId'])} className="w-full bg-blue-900 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase border border-blue-900 py-4 rounded-2xl hover:bg-black active:scale-95 transition-all shadow-lg shadow-blue-100">
                    Encerrar Rota <ArrowRight size={14} />
                  </button>
               )}
            </div>
          );
        })}
        {visibleCargas.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 py-20 text-center bg-white/50 rounded-[2rem] border border-dashed border-gray-200">
                <p className="text-gray-300 font-black uppercase text-xs tracking-widest">Nenhuma carga encontrada nos filtros selecionados.</p>
            </div>
        )}
      </div>

      {(isFinishing || isModalOpen || isEditing) && (
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] w-full max-w-lg p-8 sm:p-10 shadow-2xl relative animate-in slide-in-from-bottom-20 duration-500">
            <button 
                onClick={() => { setIsFinishing(null); setIsModalOpen(false); setIsEditing(null); }}
                className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full text-gray-400"
            ><X size={20} /></button>
            
            {isFinishing ? (
                <>
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-blue-950 uppercase italic leading-none">Encerrar Rota</h3>
                    <div className="flex flex-col items-end">
                        {finishData.diff1 > 60 && <span className="text-[8px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-full uppercase mb-1">Gap: {finishData.diff1}m</span>}
                        {finishData.diff2 > 30 && <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-2 py-1 rounded-full uppercase">Atraso: {finishData.diff2}m</span>}
                    </div>
                </div>
                <form onSubmit={handleFinishLoad} className="space-y-6 pb-6 sm:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Km Real Final</label><input required type="number" value={finishData.kmReal} onChange={e => setFinishData({...finishData, kmReal: Number(e.target.value)})} className={inputClass} /></div>
                        <div><label className={labelClass}>Horário Chegada</label><input required type="datetime-local" value={finishData.chegadaReal} onChange={e => setFinishData({...finishData, chegadaReal: e.target.value})} className={inputClass} /></div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className={`${labelClass} flex justify-between`}>
                                {"Justificativa Gap (Se > 1h)"}
                                {finishData.diff1 > 60 && <span className="text-red-500 font-black italic">OBRIGATÓRIO</span>}
                            </label>
                            <textarea 
                                value={finishData.just1} 
                                onChange={e => setFinishData({...finishData, just1: e.target.value})} 
                                className={`${inputClass} ${gapError ? 'border-red-500 ring-2 ring-red-100' : ''}`} 
                                rows={2} 
                                placeholder={finishData.diff1 > 60 ? "Explique o motivo do gap superior a 1h..." : ""}
                            />
                        </div>
                        <div>
                            <label className={`${labelClass} flex justify-between`}>
                                {"Justificativa Atraso (Se > 30min)"}
                                {finishData.diff2 > 30 && <span className="text-orange-500 font-black italic">OBRIGATÓRIO</span>}
                            </label>
                            <textarea 
                                value={finishData.just2} 
                                onChange={e => setFinishData({...finishData, just2: e.target.value})} 
                                className={`${inputClass} ${delayError ? 'border-orange-500 ring-2 ring-orange-100' : ''}`} 
                                rows={2} 
                                placeholder={finishData.diff2 > 30 ? "Explique o motivo do atraso superior a 30min..." : ""}
                            />
                        </div>
                    </div>
                    
                    {(gapError || delayError) && (
                        <div className="flex items-center gap-2 bg-red-50 p-4 rounded-2xl text-red-600">
                            <AlertCircle size={18} />
                            <p className="text-[10px] font-black uppercase tracking-tight leading-tight">Preencha as justificativas obrigatórias para finalizar.</p>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:opacity-50"
                    >
                        Finalizar Agora
                    </button>
                </form>
                </>
            ) : isEditing ? (
                <>
                <h3 className="text-2xl font-black text-blue-950 mb-8 uppercase italic leading-none">Editar Carga</h3>
                <form onSubmit={handleEditLoad} className="space-y-6 pb-6 sm:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Caminhão (Placa)</label><select required value={editFormData.caminhaoId} onChange={e => setEditFormData({...editFormData, caminhaoId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableCaminhoes.map((c: Caminhao) => <option key={c.id} value={c.CaminhaoId}>{c.Placa}</option>)}</select></div>
                        <div><label className={labelClass}>Motorista</label><select required value={editFormData.motoristaId} onChange={e => setEditFormData({...editFormData, motoristaId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableMotoristas.map((m: Motorista) => <option key={m.id} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Km Previsto</label><input required type="number" value={editFormData.kmPrevisto} onChange={e => setEditFormData({...editFormData, kmPrevisto: Number(e.target.value)})} className={inputClass} /></div>
                        <div><label className={labelClass}>Tipo</label><select value={editFormData.tipo} onChange={e => setEditFormData({...editFormData, tipo: e.target.value as LoadType})} className={inputClass}><option value="CHEIA">CHEIA</option><option value="COMBINADA 2">COMB. 2</option></select></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Início</label><input required type="datetime-local" value={editFormData.dataInicio} onChange={e => setEditFormData({...editFormData, dataInicio: e.target.value})} className={inputClass} /></div>
                        <div><label className={labelClass}>Volta Prevista</label><input required type="datetime-local" value={editFormData.voltaPrevista} onChange={e => setEditFormData({...editFormData, voltaPrevista: e.target.value})} className={inputClass} /></div>
                    </div>
                    
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all">Salvar Alterações</button>
                    
                    <button 
                      type="button"
                      onClick={handleDeleteLoadFromEdit}
                      className="w-full text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 py-3 rounded-xl transition-colors mt-2"
                    >
                      Excluir Carga
                    </button>
                </form>
                </>
            ) : (
                <>
                <h3 className="text-2xl font-black text-blue-950 mb-8 uppercase italic leading-none">Nova Carga SP</h3>
                <form onSubmit={handleCreateLoad} className="space-y-6 pb-6 sm:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Caminhão (Placa)</label><select required value={formData.caminhaoId} onChange={e => setFormData({...formData, caminhaoId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableCaminhoes.map((c: Caminhao) => <option key={c.id} value={c.CaminhaoId}>{c.Placa}</option>)}</select></div>
                        <div><label className={labelClass}>Motorista</label><select required value={formData.motoristaId} onChange={e => setFormData({...formData, motoristaId: e.target.value})} className={inputClass}><option value="">Escolha...</option>{availableMotoristas.map((m: Motorista) => <option key={m.id} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Tipo</label><select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as LoadType})} className={inputClass}><option value="CHEIA">CHEIA</option><option value="COMBINADA 2">COMB. 2</option></select></div>
                        <div><label className={labelClass}>Km Previsto</label><input required type="number" value={formData.kmPrevisto} onChange={e => setFormData({...formData, kmPrevisto: Number(e.target.value)})} className={inputClass} /></div>
                    </div>
                    <div><label className={labelClass}>Início da Rota</label><input required type="datetime-local" value={formData.dataInicio} onChange={e => setFormData({...formData, dataInicio: e.target.value})} className={inputClass} /></div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all">Salvar Carga</button>
                </form>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
