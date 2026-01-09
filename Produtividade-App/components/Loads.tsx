
import React, { useState } from 'react';
import { Caminhao, Motorista, LoadType, Carga, Planta } from '../types';
import { calculateExpectedReturn, findPreviousLoadArrival } from '../utils/logic';
import { Plus, Truck, User, ArrowRight } from 'lucide-react';
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
    
    let diff1 = 0;
    if (prevArrival) {
      diff1 = differenceInMinutes(carga['DataInicio'], prevArrival);
    }
    const diff2 = differenceInMinutes(chegadaRealDate, carga['VoltaPrevista']);

    actions.updateCarga({
      ...carga,
      'StatusCarga': 'FINALIZADA',
      'KmReal': finishData.kmReal,
      'ChegadaReal': chegadaRealDate,
      'Diff1_Gap': diff1,
      'Diff1_Jusitificativa': finishData.just1,
      'Diff2.Atraso': diff2,
      'Diff2.Justificativa': finishData.just2,
    });
    setIsFinishing(null);
  };

  const inputClass = "w-full border border-blue-100 rounded-lg p-3 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm";
  const labelClass = "text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex space-x-2 bg-white p-1.5 rounded-xl border border-blue-50 shadow-sm">
          <button onClick={() => setFilter('ATIVAS')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'ATIVAS' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-blue-800/60'}`}>Ativas</button>
          <button onClick={() => setFilter('HISTORICO')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'HISTORICO' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-blue-800/60'}`}>Histórico</button>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center font-black uppercase text-xs shadow-lg shadow-blue-100 transition-all">
          <Plus size={18} className="mr-2" /> Criar Carga
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {visibleCargas.map((carga: Carga) => (
          <div key={carga['CargaId']} className="bg-white border border-blue-50 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4 hover:shadow-md transition-all">
             <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black tracking-widest px-3 py-1 rounded-lg uppercase bg-blue-50 text-blue-700">{carga['TipoCarga']}</span>
                <span className="text-[10px] text-blue-800/40 font-black uppercase">{format(carga['DataCriacao'], 'dd/MM/yy HH:mm')}</span>
             </div>
             <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-2.5 rounded-xl text-blue-700"><Truck size={22} /></div>
                <div>
                   <p className="text-base font-black text-gray-800">{state.caminhoes.find((c: any) => c['CaminhaoId'] === carga['CaminhaoId'])?.['Placa'] || '---'}</p>
                   <p className="text-[10px] text-blue-600 font-bold uppercase">{state.plantas.find((p: any) => p['PlantaId'] === carga['PlantaId'])?.['NomedaUnidade']}</p>
                </div>
             </div>
             <div className="flex items-center gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-gray-500"><User size={22} /></div>
                <p className="text-sm text-gray-700 font-bold">{state.motoristas.find((m: any) => m['MotoristaId'] === carga['MotoristaId'])?.['NomedoMotorista'] || 'Motorista'}</p>
             </div>
             <div className="pt-4 border-t border-blue-50 grid grid-cols-2 gap-6">
                <div><p className="text-[9px] text-blue-800/40 uppercase font-black">Saída</p><p className="text-sm font-bold">{format(carga['DataInicio'], 'dd/MM HH:mm')}</p></div>
                <div><p className="text-[9px] text-blue-800/40 uppercase font-black">Volta Prevista</p><p className="text-sm font-black text-blue-700">{format(carga['VoltaPrevista'], 'dd/MM HH:mm')}</p></div>
             </div>
             {carga['StatusCarga'] === 'ATIVA' && (
                <button onClick={() => setIsFinishing(carga['CargaId'])} className="w-full mt-4 flex items-center justify-center gap-2 text-[10px] font-black text-blue-700 uppercase border border-blue-100 py-3 rounded-xl hover:bg-blue-50 transition-colors">
                  Finalizar Entrega <ArrowRight size={14} />
                </button>
             )}
          </div>
        ))}
      </div>

      {isFinishing && (
        <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl">
            <h3 className="text-2xl font-black text-blue-950 mb-6 uppercase">Finalizar Carga</h3>
            <form onSubmit={handleFinishLoad} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Km Real</label>
                  <input required type="number" value={finishData.kmReal} onChange={e => setFinishData({...finishData, kmReal: Number(e.target.value)})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Chegada Real</label>
                  <input required type="datetime-local" value={finishData.chegadaReal} onChange={e => setFinishData({...finishData, chegadaReal: e.target.value})} className={inputClass} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Justificativa Gap (Se &gt; 1h)</label>
                  <textarea value={finishData.just1} onChange={e => setFinishData({...finishData, just1: e.target.value})} className={inputClass} rows={2} placeholder="..." />
                </div>
                <div>
                  <label className={labelClass}>Justificativa Atraso (Se &gt; 30min)</label>
                  <textarea value={finishData.just2} onChange={e => setFinishData({...finishData, just2: e.target.value})} className={inputClass} rows={2} placeholder="..." />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">Confirmar Finalização</button>
              <button type="button" onClick={() => setIsFinishing(null)} className="w-full text-[10px] font-black uppercase text-blue-900/30">Voltar</button>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl">
            <h3 className="text-2xl font-black text-blue-950 mb-6 uppercase italic">Criar Carga SP</h3>
            <form onSubmit={handleCreateLoad} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Caminhão</label>
                  <select required value={formData.caminhaoId} onChange={e => setFormData({...formData, caminhaoId: e.target.value})} className={inputClass}>
                    <option value="">Selecione...</option>
                    {availableCaminhoes.map((c: Caminhao) => <option key={c.id} value={c.CaminhaoId}>{c.Placa}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Motorista</label>
                  <select required value={formData.motoristaId} onChange={e => setFormData({...formData, motoristaId: e.target.value})} className={inputClass}>
                    <option value="">Selecione...</option>
                    {availableMotoristas.map((m: Motorista) => <option key={m.id} value={m.MotoristaId}>{m.NomedoMotorista}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Tipo Carga</label>
                  <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as LoadType})} className={inputClass}>
                    <option value="CHEIA">CHEIA</option>
                    <option value="COMBINADA 2">COMBINADA 2</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Km Previsto</label>
                  <input required type="number" value={formData.kmPrevisto} onChange={e => setFormData({...formData, kmPrevisto: Number(e.target.value)})} className={inputClass} />
                </div>
              </div>
              <div className="space-y-2">
                  <label className={labelClass}>Data/Hora de Início</label>
                  <input required type="datetime-local" value={formData.dataInicio} onChange={e => setFormData({...formData, dataInicio: e.target.value})} className={inputClass} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">Salvar no SharePoint</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full text-[10px] font-black uppercase text-blue-900/30">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
