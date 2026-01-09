
import React, { useState } from 'react';
import { Caminhao, Motorista, LoadType, Carga, Planta } from '../types';
import { calculateExpectedReturn, findPreviousLoadArrival } from '../utils/logic';
import { Plus, Truck, User, ArrowRight, X, Calendar, MapPin, Gauge } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

interface LoadsProps {
  state: any;
  actions: any;
}

export const Loads: React.FC<LoadsProps> = ({ state, actions }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ATIVAS' | 'HISTORICO'>('ATIVAS');

  const currentUser = state.currentUser;
  const userPlantId = currentUser?.['PlantaId'];

  const availableCaminhoes = (state.caminhoes || []).filter((c: Caminhao) => !userPlantId || c['PlantaId'] === userPlantId);
  const availableMotoristas = (state.motoristas || []).filter((m: Motorista) => !userPlantId || m['PlantaId'] === userPlantId);

  const visibleCargas = (state.cargas || []).filter((c: Carga) => {
    const isUserPlant = !userPlantId || c['PlantaId'] === userPlantId;
    const isStatusMatch = filter === 'ATIVAS' ? c['StatusCarga'] === 'ATIVA' : c['StatusCarga'] === 'FINALIZADA';
    return isUserPlant && isStatusMatch;
  }).sort((a: Carga, b: Carga) => b['DataCriacao'].getTime() - a['DataCriacao'].getTime());

  const [formData, setFormData] = useState({
    caminhaoId: '',
    motoristaId: '',
    tipo: 'CHEIA' as LoadType,
    dataInicio: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kmPrevisto: 0,
  });

  const [finishData, setFinishData] = useState({
    chegadaReal: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    kmReal: 0,
    just1: '',
    just2: '',
  });

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

  const handleFinishLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const carga = state.cargas.find((c: any) => c['CargaId'] === isFinishing);
    if (!carga) return;
    const chegadaRealDate = new Date(finishData.chegadaReal);
    const prevArrival = findPreviousLoadArrival(carga['CaminhaoId'], carga['DataInicio'], state.cargas);
    let diff1 = 0; if (prevArrival) { diff1 = differenceInMinutes(carga['DataInicio'], prevArrival); }
    const diff2 = differenceInMinutes(chegadaRealDate, carga['VoltaPrevista']);
    actions.updateCarga({
      ...carga,
      'StatusCarga': 'FINALIZADA', 'KmReal': finishData.kmReal, 'ChegadaReal': chegadaRealDate,
      'Diff1_Gap': diff1, 'Diff1_Jusitificativa': finishData.just1, 'Diff2.Atraso': diff2, 'Diff2.Justificativa': finishData.just2,
    });
    setIsFinishing(null);
  };

  const inputClass = "w-full border border-blue-100 rounded-xl p-4 bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base";
  const labelClass = "text-[10px] font-black text-blue-900 uppercase tracking-[0.15em] mb-1.5 ml-1 block opacity-50";

  return (
    <div className="space-y-6">
      {/* Tab Switching & Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-blue-50 shadow-sm overflow-hidden">
          <button onClick={() => setFilter('ATIVAS')} className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'ATIVAS' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}>Ativas</button>
          <button onClick={() => setFilter('HISTORICO')} className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${filter === 'HISTORICO' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-800/40'}`}>Histórico</button>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-700 flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">
          <Plus size={18} className="mr-2" /> Nova Carga
        </button>
      </div>

      {/* Grid of Loads */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {visibleCargas.map((carga: Carga) => (
          <div key={carga['CargaId']} className="bg-white border border-blue-50 rounded-[2rem] overflow-hidden shadow-sm p-6 sm:p-7 space-y-5 hover:shadow-xl transition-all duration-300">
             <div className="flex justify-between items-start">
                <div className="bg-blue-50 text-blue-700 text-[9px] font-black tracking-widest px-3 py-1.5 rounded-full uppercase leading-none">
                    {carga['TipoCarga']}
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-blue-800/30 uppercase leading-none">Criada em</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{format(carga['DataCriacao'], 'dd/MM HH:mm')}</p>
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

             <div className="pt-2 grid grid-cols-2 gap-4">
                <div className="bg-blue-50/30 p-4 rounded-2xl">
                    <div className="flex items-center gap-1.5 mb-1 opacity-30">
                        <Calendar size={10} />
                        <span className="text-[8px] font-black uppercase">Saída</span>
                    </div>
                    <p className="text-sm font-black text-gray-800">{format(carga['DataInicio'], 'dd/MM HH:mm')}</p>
                </div>
                <div className="bg-blue-600/5 p-4 rounded-2xl">
                    <div className="flex items-center gap-1.5 mb-1 text-blue-600 opacity-40">
                        <Gauge size={10} />
                        <span className="text-[8px] font-black uppercase italic">Volta Prev.</span>
                    </div>
                    <p className="text-sm font-black text-blue-700 italic">{format(carga['VoltaPrevista'], 'dd/MM HH:mm')}</p>
                </div>
             </div>

             {carga['StatusCarga'] === 'ATIVA' && (
                <button onClick={() => setIsFinishing(carga['CargaId'])} className="w-full bg-blue-900 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase border border-blue-900 py-4 rounded-2xl hover:bg-black active:scale-95 transition-all shadow-lg shadow-blue-100">
                  Encerrar Rota <ArrowRight size={14} />
                </button>
             )}
          </div>
        ))}
        {visibleCargas.length === 0 && (
            <div className="md:col-span-2 xl:col-span-3 py-20 text-center">
                <p className="text-gray-300 font-black uppercase text-xs tracking-widest">Nenhuma carga encontrada para este filtro.</p>
            </div>
        )}
      </div>

      {/* Modals - Mobile and Desktop Optimized */}
      {(isFinishing || isModalOpen) && (
        <div className="fixed inset-0 bg-blue-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] w-full max-w-lg p-8 sm:p-10 shadow-2xl relative animate-in slide-in-from-bottom-20 duration-500">
            <button 
                onClick={() => { setIsFinishing(null); setIsModalOpen(false); }}
                className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full text-gray-400"
            ><X size={20} /></button>
            
            {isFinishing ? (
                <>
                <h3 className="text-2xl font-black text-blue-950 mb-8 uppercase italic leading-none">Encerrar Rota</h3>
                <form onSubmit={handleFinishLoad} className="space-y-6 pb-6 sm:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Km Real Final</label><input required type="number" value={finishData.kmReal} onChange={e => setFinishData({...finishData, kmReal: Number(e.target.value)})} className={inputClass} /></div>
                        <div><label className={labelClass}>Horário Chegada</label><input required type="datetime-local" value={finishData.chegadaReal} onChange={e => setFinishData({...finishData, chegadaReal: e.target.value})} className={inputClass} /></div>
                    </div>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Justificativa Gap (Se &gt; 1h)</label><textarea value={finishData.just1} onChange={e => setFinishData({...finishData, just1: e.target.value})} className={inputClass} rows={2} /></div>
                        <div><label className={labelClass}>Justificativa Atraso (Se &gt; 30min)</label><textarea value={finishData.just2} onChange={e => setFinishData({...finishData, just2: e.target.value})} className={inputClass} rows={2} /></div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-95 transition-all">Finalizar Agora</button>
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
