
import React, { useState, useRef } from 'react';
import { Planta, Caminhao, Usuario, Motorista, Role, LoadType } from '../types';
import { Trash2, Search, PlusCircle, LayoutGrid, List, FileUp, CheckCircle, AlertCircle, Loader2, Truck, Box, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { calculateExpectedReturn } from '../utils/logic';

interface AdminProps {
  state: any;
  actions: any;
}

const inputClass = "w-full border border-blue-100 rounded-xl px-4 py-3 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm";
const labelClass = "block text-[10px] font-black text-blue-800/50 uppercase tracking-widest mb-1.5 ml-1";
const cardClass = "bg-white p-6 rounded-3xl border border-blue-50 shadow-sm lg:sticky lg:top-24 mb-8 lg:mb-0";

const FormLayout: React.FC<{ title: string; children: React.ReactNode; onSubmit: (e: React.FormEvent) => void }> = ({ title, children, onSubmit }) => (
  <div className={cardClass}>
    <h4 className="font-black text-blue-900 uppercase text-xs mb-6 flex items-center gap-2">
      <PlusCircle size={16} /> Novo {title}
    </h4>
    <form className="space-y-4" onSubmit={onSubmit}>
      {children}
      <button className="w-full bg-blue-600 text-white font-black uppercase text-[10px] py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">
        Salvar no SharePoint
      </button>
    </form>
  </div>
);

const ListTable: React.FC<{ headers: string[], items: any[], renderRow: (item: any) => React.ReactNode, renderCard: (item: any) => React.ReactNode }> = ({ headers, items, renderRow, renderCard }) => (
  <div className="space-y-4">
    <div className="hidden md:block bg-white border border-blue-50 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
        <thead className="bg-blue-50/30 border-b border-blue-50">
            <tr>
            {headers.map(h => <th key={h} className="px-6 py-4 text-[10px] font-black text-blue-800/60 uppercase">{h}</th>)}
            <th className="px-6 py-4 text-[10px] font-black text-blue-800/60 uppercase text-right">Ações</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-blue-50">
            {items.length === 0 ? (
            <tr><td colSpan={headers.length + 1} className="px-6 py-12 text-center text-gray-400 text-xs italic">Nenhum registro.</td></tr>
            ) : items.map(renderRow)}
        </tbody>
        </table>
    </div>
    <div className="md:hidden grid grid-cols-1 gap-3">
        {items.length === 0 ? (
            <div className="p-12 text-center text-gray-300 text-xs italic bg-white rounded-3xl border border-dashed border-gray-200">Sem resultados.</div>
        ) : items.map(renderCard)}
    </div>
  </div>
);

const ImportTab = ({ state, actions }: any) => {
    const [importType, setImportType] = useState<'CARGAS' | 'CAMINHOES' | 'MOTORISTAS'>('CARGAS');
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<{msg: string, type: 'success' | 'error'}[]>([]);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setResults([]);
        setProgress(0);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            const total = data.length;
            for (let i = 0; i < total; i++) {
                const row: any = data[i];
                try {
                    if (importType === 'CARGAS') {
                        // Lógica de importação de Cargas
                        const placaStr = String(row['Placa'] || '').trim().toUpperCase();
                        const motoristaStr = String(row['Motoristas coleta'] || '').trim();
                        const plantaStr = String(row['Planta'] || '').trim();
                        const eventoStr = String(row['Eventos'] || '').trim().toUpperCase();
                        const kmPrevisto = Number(row['KM previsto'] || 0);
                        
                        let dataInicio: Date;
                        if (typeof row['Início'] === 'number') {
                            dataInicio = new Date(Date.UTC(0, 0, row['Início'] - 25569));
                        } else {
                            dataInicio = new Date(row['Início']);
                        }

                        if (isNaN(dataInicio.getTime())) throw new Error("Data de início inválida");

                        const planta = state.plantas.find((p: Planta) => p['NomedaUnidade'].trim().toLowerCase() === plantaStr.toLowerCase());
                        const caminhao = state.caminhoes.find((c: Caminhao) => c['Placa'].trim().toUpperCase() === placaStr);
                        const motorista = state.motoristas.find((m: Motorista) => m['NomedoMotorista'].trim().toLowerCase() === motoristaStr.toLowerCase());

                        if (!planta) throw new Error(`Planta '${plantaStr}' não encontrada`);
                        if (!caminhao) throw new Error(`Caminhão placa '${placaStr}' não encontrado`);
                        if (!motorista) throw new Error(`Motorista '${motoristaStr}' não encontrado`);

                        const tipoCarga: LoadType = eventoStr.includes('COMBINADA') ? 'COMBINADA 2' : 'CHEIA';
                        const voltaPrevista = calculateExpectedReturn(dataInicio, kmPrevisto, tipoCarga);

                        await actions.addCarga({
                            'PlantaId': planta['PlantaId'],
                            'CaminhaoId': caminhao['CaminhaoId'],
                            'MotoristaId': motorista['MotoristaId'],
                            'TipoCarga': tipoCarga,
                            'DataInicio': dataInicio,
                            'KmPrevisto': kmPrevisto,
                            'VoltaPrevista': voltaPrevista,
                        });
                        setResults(prev => [{msg: `Linha ${i+1}: Sucesso (${placaStr})`, type: 'success'}, ...prev]);

                    } else if (importType === 'CAMINHOES') {
                        // Lógica de importação de Caminhões
                        const placaStr = String(row['Placa'] || '').trim().toUpperCase();
                        const plantaStr = String(row['Planta'] || '').trim();

                        if (!placaStr) throw new Error("Placa ausente");

                        const planta = state.plantas.find((p: Planta) => p['NomedaUnidade'].trim().toLowerCase() === plantaStr.toLowerCase());
                        if (!planta) throw new Error(`Planta '${plantaStr}' não encontrada`);

                        const existing = state.caminhoes.find((c: Caminhao) => c['Placa'].trim().toUpperCase() === placaStr);
                        if (existing) throw new Error(`Caminhão placa '${placaStr}' já cadastrado`);

                        await actions.addCaminhao({
                            'Placa': placaStr,
                            'PlantaId': planta['PlantaId']
                        });
                        setResults(prev => [{msg: `Linha ${i+1}: Caminhão ${placaStr} cadastrado`, type: 'success'}, ...prev]);
                    } else if (importType === 'MOTORISTAS') {
                        // Lógica de importação de Motoristas
                        const nomeStr = String(row['Motoristas coleta'] || '').trim();
                        const plantaStr = String(row['Planta'] || '').trim();

                        if (!nomeStr) throw new Error("Nome do motorista ausente");

                        const planta = state.plantas.find((p: Planta) => p['NomedaUnidade'].trim().toLowerCase() === plantaStr.toLowerCase());
                        if (!planta) throw new Error(`Planta '${plantaStr}' não encontrada`);

                        const existing = state.motoristas.find((m: Motorista) => m['NomedoMotorista'].trim().toLowerCase() === nomeStr.toLowerCase());
                        if (existing) throw new Error(`Motorista '${nomeStr}' já cadastrado`);

                        await actions.addMotorista({
                            'NomedoMotorista': nomeStr,
                            'PlantaId': planta['PlantaId']
                        });
                        setResults(prev => [{msg: `Linha ${i+1}: Motorista ${nomeStr} cadastrado`, type: 'success'}, ...prev]);
                    }

                } catch (err: any) {
                    setResults(prev => [{msg: `Linha ${i+1}: Erro - ${err.message}`, type: 'error'}, ...prev]);
                }
                setProgress(Math.round(((i + 1) / total) * 100));
            }
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="animate-in fade-in duration-300">
            <div className="max-w-2xl mx-auto">
                {/* Seletor de Tipo de Importação */}
                <div className="flex bg-blue-50/50 p-1 rounded-2xl mb-8 border border-blue-50 overflow-x-auto no-scrollbar">
                    <button onClick={() => setImportType('CARGAS')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${importType === 'CARGAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-800/40'}`}>
                        <Box size={14} /> Cargas
                    </button>
                    <button onClick={() => setImportType('CAMINHOES')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${importType === 'CAMINHOES' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-800/40'}`}>
                        <Truck size={14} /> Caminhões
                    </button>
                    <button onClick={() => setImportType('MOTORISTAS')} className={`flex-1 min-w-[120px] py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${importType === 'MOTORISTAS' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-800/40'}`}>
                        <UserPlus size={14} /> Motoristas
                    </button>
                </div>

                <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2.5rem] p-12 text-center relative group transition-all hover:bg-white hover:border-blue-400">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFile}
                        disabled={importing}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl transition-all ${importing ? 'bg-gray-100 text-gray-400 animate-pulse' : 'bg-blue-600 text-white group-hover:scale-110'}`}>
                            {importing ? <Loader2 className="animate-spin" size={32} /> : <FileUp size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-blue-950 uppercase italic mb-2">
                            Importar {importType.toLowerCase()}
                        </h3>
                        <p className="text-xs font-bold text-blue-800/40 uppercase tracking-widest max-w-xs mx-auto">
                            Arraste seu arquivo Excel para importar em lote para o SharePoint.
                        </p>
                    </div>
                </div>

                {importing && (
                    <div className="mt-8 space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase text-blue-600 px-2">
                            <span>Sincronizando...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{width: `${progress}%`}}></div>
                        </div>
                    </div>
                )}

                <div className="mt-10 space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pb-8">
                    {results.map((res, idx) => (
                        <div key={idx} className={`flex items-center gap-3 p-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border ${res.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {res.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {res.msg}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PlantasTab = ({ state, searchTerm, actions }: any) => {
  const items = (state.plantas || []).filter((p: Planta) => p['NomedaUnidade']?.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <FormLayout title="Planta" onSubmit={(e) => e.preventDefault()}>
        <div><label className={labelClass}>Unidade</label><input required type="text" className={inputClass} /></div>
        <div><label className={labelClass}>ID GUID</label><input required type="text" className={inputClass} /></div>
      </FormLayout>
      <div className="lg:col-span-2">
        <ListTable headers={['Unidade', 'ID']} items={items} 
          renderRow={(p: Planta) => (
            <tr key={p.id}><td className="px-6 py-4 font-bold text-gray-800 text-sm">{p['NomedaUnidade']}</td><td className="px-6 py-4 text-xs font-mono text-gray-400">{p['PlantaId']}</td><td className="px-6 py-4 text-right"><button onClick={() => actions.deletePlanta(p.id)} className="text-blue-200 hover:text-red-500 p-2"><Trash2 size={16} /></button></td></tr>
          )}
          renderCard={(p: Planta) => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-blue-50 flex justify-between items-center shadow-sm">
                <div><div className="font-bold text-gray-800 text-sm">{p['NomedaUnidade']}</div><div className="text-[10px] text-gray-400 font-mono mt-1">{p['PlantaId']}</div></div>
                <button onClick={() => actions.deletePlanta(p.id)} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16} /></button>
            </div>
          )}
        />
      </div>
    </div>
  );
};

const CaminhoesTab = ({ state, searchTerm, actions }: any) => {
  const items = (state.caminhoes || []).filter((c: Caminhao) => c['Placa']?.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <FormLayout title="Caminhão" onSubmit={(e) => e.preventDefault()}>
        <div><label className={labelClass}>Placa</label><input required type="text" className={inputClass} placeholder="ABC-1234" /></div>
        <div><label className={labelClass}>Planta</label><select className={inputClass} required><option value="">Selecione...</option>{state.plantas.map((p: Planta) => <option key={p['PlantaId']} value={p['PlantaId']}>{p['NomedaUnidade']}</option>)}</select></div>
      </FormLayout>
      <div className="lg:col-span-2">
        <ListTable headers={['Placa', 'Planta']} items={items} 
          renderRow={(c: Caminhao) => (
            <tr key={c.id}><td className="px-6 py-4 font-bold text-gray-800 text-sm">{c['Placa']}</td><td className="px-6 py-4 text-sm">{state.plantas.find((p:any)=>p.PlantaId===c.PlantaId)?.NomedaUnidade}</td><td className="px-6 py-4 text-right"><button onClick={() => actions.deleteCaminhao(c.id)} className="text-blue-200 hover:text-red-500 p-2"><Trash2 size={16} /></button></td></tr>
          )}
          renderCard={(c: Caminhao) => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-blue-50 flex justify-between items-center shadow-sm">
                <div><div className="font-black text-blue-900 text-base italic">{c['Placa']}</div><div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{state.plantas.find((p:any)=>p.PlantaId===c.PlantaId)?.NomedaUnidade}</div></div>
                <button onClick={() => actions.deleteCaminhao(c.id)} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16} /></button>
            </div>
          )}
        />
      </div>
    </div>
  );
};

const MotoristasTab = ({ state, searchTerm, actions }: any) => {
  const items = (state.motoristas || []).filter((m: Motorista) => m['NomedoMotorista']?.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <FormLayout title="Motorista" onSubmit={(e) => e.preventDefault()}>
        <div><label className={labelClass}>Nome</label><input required type="text" className={inputClass} /></div>
        <div><label className={labelClass}>Planta</label><select className={inputClass} required><option value="">Selecione...</option>{state.plantas.map((p: Planta) => <option key={p['PlantaId']} value={p['PlantaId']}>{p['NomedaUnidade']}</option>)}</select></div>
      </FormLayout>
      <div className="lg:col-span-2">
        <ListTable headers={['Motorista', 'Planta']} items={items} 
          renderRow={(m: Motorista) => (
            <tr key={m.id}><td className="px-6 py-4 font-bold text-gray-800 text-sm">{m['NomedoMotorista']}</td><td className="px-6 py-4 text-sm">{state.plantas.find((p:any)=>p.PlantaId===m.PlantaId)?.NomedaUnidade}</td><td className="px-6 py-4 text-right"><button onClick={() => actions.deleteMotorista(m.id)} className="text-blue-200 hover:text-red-500 p-2"><Trash2 size={16} /></button></td></tr>
          )}
          renderCard={(m: Motorista) => (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-blue-50 flex justify-between items-center shadow-sm">
                <div><div className="font-bold text-gray-800 text-sm">{m['NomedoMotorista']}</div><div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{state.plantas.find((p:any)=>p.PlantaId===m.PlantaId)?.NomedaUnidade}</div></div>
                <button onClick={() => actions.deleteMotorista(m.id)} className="p-3 bg-red-50 text-red-500 rounded-xl"><Trash2 size={16} /></button>
            </div>
          )}
        />
      </div>
    </div>
  );
};

const UsuariosTab = ({ state, searchTerm, actions }: any) => {
  const items = (state.usuarios || []).filter((u: Usuario) => u['NomeCompleto']?.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <FormLayout title="Usuário" onSubmit={(e) => e.preventDefault()}>
        <div><label className={labelClass}>Nome</label><input required type="text" className={inputClass} /></div>
        <div><label className={labelClass}>Login</label><input required type="text" className={inputClass} /></div>
        <div><label className={labelClass}>Nível</label><select className={inputClass}><option value="Operador">Operador</option><option value="Admin">Admin</option></select></div>
      </FormLayout>
      <div className="lg:col-span-2">
        <ListTable headers={['Usuário', 'Nível']} items={items} 
          renderRow={(u: Usuario) => (
            <tr key={u.id}><td className="px-6 py-4"><div><div className="font-bold text-gray-800 text-sm">{u['NomeCompleto']}</div><div className="text-[9px] text-blue-600/50 font-black uppercase">{u['LoginUsuario']}</div></div></td><td className="px-6 py-4"><span className="px-2 py-1 bg-blue-50 rounded text-[9px] font-black uppercase text-blue-600">{u['NivelAcesso']}</span></td><td className="px-6 py-4 text-right"><button onClick={() => { if(u.id !== 'master' && window.confirm('Excluir?')) actions.deleteUsuario(u.id) }} disabled={u.id === 'master'} className={`p-2 ${u.id === 'master' ? 'opacity-10 cursor-not-allowed' : 'text-blue-200 hover:text-red-500'}`}><Trash2 size={16} /></button></td></tr>
          )}
          renderCard={(u: Usuario) => (
            <div key={u.id} className="bg-white p-5 rounded-2xl border border-blue-50 flex justify-between items-center shadow-sm">
                <div><div className="font-bold text-gray-800 text-sm">{u['NomeCompleto']}</div><div className="flex items-center gap-2 mt-1"><span className="text-[10px] font-black text-blue-500 uppercase">{u['LoginUsuario']}</span><span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase">{u['NivelAcesso']}</span></div></div>
                <button onClick={() => actions.deleteUsuario(u.id)} disabled={u.id === 'master'} className={`p-3 bg-red-50 text-red-500 rounded-xl ${u.id === 'master' ? 'opacity-20' : ''}`}><Trash2 size={16} /></button>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export const Admin: React.FC<AdminProps> = ({ state, actions }) => {
  const [activeSubTab, setActiveSubTab] = useState<'plantas' | 'caminhoes' | 'usuarios' | 'motoristas' | 'importar'>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="bg-transparent lg:bg-white lg:p-10 lg:rounded-3xl lg:shadow-sm lg:border lg:border-blue-50 min-h-[600px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 lg:mb-10 px-1 lg:px-0">
         <h2 className="text-2xl sm:text-3xl font-black text-blue-950 uppercase italic tracking-tight">Gestão SP</h2>
         <div className="flex bg-white lg:bg-blue-50/50 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar shadow-sm lg:shadow-none border border-blue-50 lg:border-none">
            {['plantas', 'caminhoes', 'usuarios', 'motoristas', 'importar'].map((t: any) => (
               <button key={t} onClick={() => setActiveSubTab(t)} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeSubTab === t ? 'bg-blue-600 lg:bg-white text-white lg:text-blue-700 shadow-sm' : 'text-blue-800/40'}`}>{t}</button>
            ))}
         </div>
      </div>
      
      {activeSubTab !== 'importar' && (
          <div className="relative mb-8 px-1 lg:px-0 animate-in slide-in-from-top-4 duration-300">
             <Search className="absolute left-5 lg:left-4 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
             <input type="text" placeholder={`Buscar ${activeSubTab}...`} className="w-full pl-12 pr-6 py-4 border border-blue-50 rounded-2xl bg-white lg:bg-blue-50/20 focus:bg-white outline-none font-bold text-gray-700 transition-all shadow-sm lg:shadow-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
      )}
      
      <div className="px-1 lg:px-0">
        {activeSubTab === 'usuarios' && <UsuariosTab state={state} searchTerm={searchTerm} actions={actions} />}
        {activeSubTab === 'plantas' && <PlantasTab state={state} searchTerm={searchTerm} actions={actions} />}
        {activeSubTab === 'caminhoes' && <CaminhoesTab state={state} searchTerm={searchTerm} actions={actions} />}
        {activeSubTab === 'motoristas' && <MotoristasTab state={state} searchTerm={searchTerm} actions={actions} />}
        {activeSubTab === 'importar' && <ImportTab state={state} actions={actions} />}
      </div>
    </div>
  );
};
