
import React, { useState, useEffect } from 'react';
import { useAppState } from './store';
import { Admin } from './components/Admin';
import { Loads } from './components/Loads';
import { Indicators } from './components/Indicators';
import { LogOut, ShieldCheck, User as UserIcon, Loader2, AlertTriangle } from 'lucide-react';

const LOGO_URL = "https://viagroup.com.br/assets/via_group-22fac685.png";
const MICROSOFT_LOGO = "https://static.vecteezy.com/system/resources/previews/027/127/473/non_2x/microsoft-logo-microsoft-icon-transparent-free-png.png";

const LoginScreen: React.FC<{ onConnect: () => void, loading: boolean }> = ({ onConnect, loading }) => {
    return (
        <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center animate-in fade-in zoom-in duration-500">
                <div className="w-full flex items-center justify-center mb-8">
                    <img src={LOGO_URL} alt="Via Group" className="h-16 object-contain" />
                </div>
                <h1 className="text-4xl font-black text-blue-950 uppercase italic tracking-tighter mb-2">Produtividade</h1>
                <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-10">Premium SharePoint Integration</p>
                
                <div className="space-y-4">
                    <button 
                        onClick={onConnect}
                        disabled={loading}
                        className="w-full bg-[#2F2F2F] text-white font-black uppercase text-xs py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Conectando...
                            </>
                        ) : (
                            <>
                                <img src={MICROSOFT_LOGO} className="w-6 h-6 object-contain" alt="Microsoft" />
                                Entrar com Microsoft
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-gray-400 font-medium px-6 leading-relaxed">
                        Utilize sua conta corporativa para acessar as listas de produtividade do SharePoint.
                    </p>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-center gap-2 text-blue-600">
                    <ShieldCheck size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Acesso Seguro & Criptografado</span>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { state, loading, isAuthenticated, connectToSharePoint, logout, setCurrentUser, ...actions } = useAppState();
  const [activeTab, setActiveTab] = useState<'CARGAS' | 'INDICADORES' | 'ADMIN'>('CARGAS');

  const currentUser = state.currentUser;
  
  // 1. Se não está autenticado e não está tentando conectar, mostra login
  if (!isAuthenticated && !loading) {
    return <LoginScreen onConnect={connectToSharePoint} loading={loading} />;
  }

  // 2. Se está carregando, mostra tela de espera
  if (loading) {
    return (
        <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
            <p className="text-white text-xs font-black uppercase tracking-widest opacity-50">Sincronizando SharePoint...</p>
        </div>
    );
  }

  // 3. Se autenticou mas nenhum perfil foi selecionado (ou lista de usuários vazia)
  if (!currentUser) {
      return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm w-full animate-in slide-in-from-bottom-8 duration-500 text-center">
                  <div className="flex flex-col items-center mb-8">
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4">
                          <UserIcon size={32} />
                      </div>
                      <h2 className="text-2xl font-black uppercase italic text-blue-900 leading-none">Perfil</h2>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Escolha sua identidade para acessar</p>
                  </div>

                  {state.usuarios.length === 0 ? (
                      <div className="p-6 bg-red-50 border border-red-100 rounded-3xl text-red-600">
                          <AlertTriangle className="mx-auto mb-2" />
                          <p className="text-xs font-bold uppercase">Nenhum usuário encontrado na lista do SharePoint.</p>
                          <p className="text-[9px] mt-2 opacity-70">Verifique se você tem permissão na lista 'USUARIOS' do site Powerapps.</p>
                      </div>
                  ) : (
                      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                          {state.usuarios.map(u => (
                              <button 
                                key={u.id}
                                onClick={() => setCurrentUser(u)}
                                className="w-full text-left p-5 rounded-2xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                              >
                                  <div className="font-black text-gray-800 group-hover:text-blue-700 transition-colors">{u['NomeCompleto']}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="px-2 py-0.5 bg-gray-100 rounded text-[8px] font-black uppercase text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500">{u['NivelAcesso']}</span>
                                      {u['PlantaId'] && (
                                          <span className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter italic">Planta: {u['PlantaId'].substring(0,8)}...</span>
                                      )}
                                  </div>
                              </button>
                          ))}
                      </div>
                  )}
                  
                  <div className="mt-8 space-y-4">
                    <button onClick={connectToSharePoint} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-black uppercase text-[10px] hover:bg-blue-100 transition-colors">Recarregar Dados</button>
                    <button onClick={logout} className="w-full py-3 text-[10px] font-black uppercase text-red-400 hover:text-red-600 transition-colors">Sair / Trocar Conta</button>
                  </div>
              </div>
          </div>
      );
  }

  const isAdmin = currentUser['NivelAcesso'] === 'Admin';

  return (
    <div className="min-h-screen bg-white flex flex-col antialiased">
      <header className="bg-blue-900 text-white shadow-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Via Group" className="h-10 brightness-0 invert" />
            <h1 className="text-2xl font-black italic uppercase hidden sm:block">Produtividade</h1>
          </div>
          <nav className="flex gap-1 sm:gap-2">
            {['CARGAS', 'INDICADORES'].map((t: any) => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={`px-3 sm:px-6 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-800 text-blue-400 shadow-inner' : 'text-white/60 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('ADMIN')} 
                className={`px-3 sm:px-6 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ADMIN' ? 'bg-blue-800 text-blue-400 shadow-inner' : 'text-white/60 hover:text-white'}`}
              >
                Admin
              </button>
            )}
          </nav>
          <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                  <p className="text-xs font-black leading-none">{currentUser['NomeCompleto']}</p>
                  <button onClick={() => setCurrentUser(null)} className="text-[9px] font-black text-blue-400 uppercase flex items-center gap-1 mt-1">Alterar Perfil</button>
              </div>
              <button onClick={() => setCurrentUser(null)} className="bg-blue-500 p-2.5 rounded-xl text-white shadow-lg hover:bg-blue-400 transition-colors"><UserIcon size={18} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'CARGAS' && <Loads state={state} actions={{...actions, setCurrentUser}} />}
        {activeTab === 'INDICADORES' && <Indicators state={state} />}
        {activeTab === 'ADMIN' && isAdmin && <Admin state={state} actions={{...actions, setCurrentUser}} />}
      </main>
      <footer className="py-6 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[9px] font-black uppercase text-gray-300 tracking-widest">
              <span>Via Group &copy; 2025</span>
              <button onClick={logout} className="hover:text-red-400 flex items-center gap-1 transition-colors">Sair do Sistema <LogOut size={10} /></button>
          </div>
      </footer>
    </div>
  );
};

export default App;
