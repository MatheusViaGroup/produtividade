
import React, { useState } from 'react';
import { useAppState } from './store';
import { Admin } from './components/Admin';
import { Loads } from './components/Loads';
import { Indicators } from './components/Indicators';
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';

const LOGO_URL = "https://viagroup.com.br/assets/via_group-22fac685.png";
const MICROSOFT_LOGO = "https://static.vecteezy.com/system/resources/previews/027/127/473/non_2x/microsoft-logo-microsoft-icon-transparent-free-png.png";

const LoginScreen: React.FC<{ onConnect: () => void, loading: boolean }> = ({ onConnect, loading }) => {
    return (
        <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center">
                <div className="w-full flex items-center justify-center mb-8">
                    <img src={LOGO_URL} alt="Via Group" className="h-16 object-contain" />
                </div>
                <h1 className="text-4xl font-black text-blue-950 uppercase italic tracking-tighter mb-2">Produtividade</h1>
                <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest mb-10">Premium SharePoint Integration</p>
                
                <div className="space-y-4">
                    <button 
                        onClick={onConnect}
                        disabled={loading}
                        className="w-full bg-[#2F2F2F] text-white font-black uppercase text-xs py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50"
                    >
                        {loading ? "Conectando..." : (
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
  const { state, loading, connectToSharePoint, logout, ...actions } = useAppState();
  const [activeTab, setActiveTab] = useState<'CARGAS' | 'INDICADORES' | 'ADMIN'>('CARGAS');

  const currentUser = state.currentUser;
  
  if (!state.usuarios.length && !loading) {
    return <LoginScreen onConnect={connectToSharePoint} loading={loading} />;
  }

  if (!currentUser) {
      return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
              <div className="bg-white p-10 rounded-3xl shadow-xl max-w-sm w-full">
                  <h2 className="text-xl font-black mb-6 uppercase italic text-blue-900">Selecione seu Perfil</h2>
                  <div className="space-y-3">
                      {state.usuarios.map(u => (
                          <button 
                            key={u.id}
                            onClick={() => actions.setCurrentUser(u)}
                            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold"
                          >
                              {u['NomeCompleto']}
                              <span className="block text-[9px] uppercase text-gray-400">{u['NivelAcesso']}</span>
                          </button>
                      ))}
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
            <h1 className="text-2xl font-black italic uppercase">Produtividade</h1>
          </div>
          <nav className="hidden md:flex gap-2">
            {['CARGAS', 'INDICADORES'].map((t: any) => (
              <button 
                key={t} 
                onClick={() => setActiveTab(t as any)} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${activeTab === t ? 'bg-blue-800 text-blue-400' : 'text-white/60 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('ADMIN')} 
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${activeTab === 'ADMIN' ? 'bg-blue-800 text-blue-400' : 'text-white/60 hover:text-white'}`}
              >
                Admin
              </button>
            )}
          </nav>
          <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-black">{currentUser['NomeCompleto']}</p>
                  <button onClick={logout} className="text-[9px] font-black text-blue-400 uppercase flex items-center gap-1">Sair <LogOut size={12}/></button>
              </div>
              <div className="bg-blue-500 p-2 rounded-xl text-white shadow-lg"><UserIcon size={18} /></div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        {activeTab === 'CARGAS' && <Loads state={state} actions={actions} />}
        {activeTab === 'INDICADORES' && <Indicators state={state} />}
        {activeTab === 'ADMIN' && isAdmin && <Admin state={state} actions={actions} />}
      </main>
    </div>
  );
};

export default App;
