
import React, { useState } from 'react';
import { useAppState } from './store';
import { Admin } from './components/Admin';
import { Loads } from './components/Loads';
import { Indicators } from './components/Indicators';
import { LogOut, ShieldCheck, User as UserIcon, Loader2, KeyRound, Truck, BarChart3, Settings } from 'lucide-react';

const LOGO_URL = "https://viagroup.com.br/assets/via_group-22fac685.png";
const MICROSOFT_LOGO = "https://static.vecteezy.com/system/resources/previews/027/127/473/non_2x/microsoft-logo-microsoft-icon-transparent-free-png.png";

const LoginMicrosoft: React.FC<{ onConnect: () => void, loading: boolean }> = ({ onConnect, loading }) => (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-2xl text-center">
            <div className="w-full flex items-center justify-center mb-6">
                <img src={LOGO_URL} alt="Via Group" className="h-12 sm:h-16 object-contain" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-blue-950 uppercase italic tracking-tighter mb-2 leading-none">Produtividade</h1>
            <p className="text-[10px] font-bold text-blue-900/40 uppercase tracking-[0.2em] mb-10">Conexão Microsoft Necessária</p>
            <button 
                onClick={onConnect}
                disabled={loading}
                className="w-full bg-[#2F2F2F] text-white font-black uppercase text-xs py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <img src={MICROSOFT_LOGO} className="w-6 h-6" alt="MS" />}
                {loading ? "Sincronizando..." : "Conectar com Microsoft"}
            </button>
        </div>
    </div>
);

const LoginApp: React.FC<{ onLogin: (u: string, p: string) => boolean, onBack: () => void }> = ({ onLogin, onBack }) => {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onLogin(user, pass)) {
            setError(false);
        } else {
            setError(true);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-xl max-w-md w-full text-center">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-full flex items-center justify-center mb-6">
                        <img src={LOGO_URL} alt="Via Group" className="h-12 sm:h-16 object-contain" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black uppercase italic text-blue-950 leading-none">Acesso Interno</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Entre com seus dados do sistema</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        required
                        type="text" 
                        placeholder="Usuário" 
                        value={user}
                        onChange={e => setUser(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700 transition-all text-base"
                    />
                    <input 
                        required
                        type="password" 
                        placeholder="Senha" 
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700 transition-all text-base"
                    />
                    {error && <p className="text-red-500 text-[10px] font-black uppercase">Dados incorretos.</p>}
                    <button className="w-full bg-blue-600 text-white font-black uppercase text-xs py-5 rounded-2xl shadow-lg hover:bg-blue-700 transition-all active:scale-95">Entrar no Sistema</button>
                </form>
                
                <button onClick={onBack} className="mt-8 text-[10px] font-black uppercase text-gray-300 hover:text-red-400 transition-colors">Sair / Trocar Microsoft</button>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { state, loading, isAuthenticated, loginLocal, connectToSharePoint, logout, setCurrentUser, ...actions } = useAppState();
  const [activeTab, setActiveTab] = useState<'CARGAS' | 'INDICADORES' | 'ADMIN'>('CARGAS');
  const [adminSubTab, setAdminSubTab] = useState<'usuarios' | 'plantas' | 'caminhoes' | 'motoristas' | 'importar' | 'justificativas'>('usuarios');
  const [importType, setImportType] = useState<'CARGAS' | 'CAMINHOES' | 'MOTORISTAS'>('CARGAS');

  const currentUser = state.currentUser;
  
  const goToImport = (type: 'CARGAS' | 'CAMINHOES' | 'MOTORISTAS') => {
    setImportType(type);
    setAdminSubTab('importar');
    setActiveTab('ADMIN');
  };

  if (!isAuthenticated) return <LoginMicrosoft onConnect={connectToSharePoint} loading={loading} />;
  
  if (loading && !state.usuarios.length) {
    return (
        <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
            <p className="text-white text-[10px] font-black uppercase tracking-widest opacity-50">Sincronizando Dados...</p>
        </div>
    );
  }

  if (!currentUser) return <LoginApp onLogin={loginLocal} onBack={logout} />;

  const isAdmin = currentUser['NivelAcesso']?.toUpperCase() === 'ADMIN';

  const NavButton = ({ tab, icon: Icon, label }: { tab: typeof activeTab, icon: any, label: string }) => {
      const active = activeTab === tab;
      return (
          <button 
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${active ? 'text-blue-600' : 'text-gray-400'}`}
          >
              <Icon size={20} strokeWidth={active ? 3 : 2} />
              <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
          </button>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased pb-20 lg:pb-0">
      <header className="bg-blue-900 text-white shadow-xl sticky top-0 z-40 lg:block hidden">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Via Group" className="h-10 brightness-0 invert" />
            <h1 className="text-xl font-black italic uppercase">Produtividade</h1>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => setActiveTab('CARGAS')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CARGAS' ? 'bg-blue-800 text-blue-400' : 'text-white/60 hover:text-white'}`}>Cargas</button>
            <button onClick={() => setActiveTab('INDICADORES')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'INDICADORES' ? 'bg-blue-800 text-blue-400' : 'text-white/60 hover:text-white'}`}>Indicadores</button>
            {isAdmin && <button onClick={() => setActiveTab('ADMIN')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ADMIN' ? 'bg-blue-800 text-blue-400' : 'text-white/60 hover:text-white'}`}>Admin</button>}
          </nav>
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <p className="text-xs font-black">{currentUser['NomeCompleto']}</p>
                  <button onClick={() => setCurrentUser(null)} className="text-[9px] font-black text-blue-400 uppercase">Alterar Perfil</button>
              </div>
              <div className="bg-blue-500 p-2.5 rounded-xl"><UserIcon size={18} /></div>
          </div>
        </div>
      </header>

      <div className="lg:hidden bg-blue-900 text-white p-4 sticky top-0 z-40 flex justify-between items-center shadow-lg">
          <img src={LOGO_URL} alt="Via Group" className="h-6 brightness-0 invert" />
          <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 truncate max-w-[120px]">{currentUser['NomeCompleto']}</span>
              <button onClick={() => setCurrentUser(null)} className="p-2 bg-blue-800 rounded-lg"><UserIcon size={14} /></button>
          </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full animate-in fade-in duration-500">
        {activeTab === 'CARGAS' && <Loads state={state} actions={actions} isAdmin={isAdmin} onImport={() => goToImport('CARGAS')} />}
        {activeTab === 'INDICADORES' && <Indicators state={state} />}
        {activeTab === 'ADMIN' && isAdmin && (
            <Admin 
                state={state} 
                actions={actions} 
                activeSubTab={adminSubTab} 
                setActiveSubTab={setAdminSubTab}
                initialImportType={importType}
            />
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around px-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] h-20">
          <NavButton tab="CARGAS" icon={Truck} label="Cargas" />
          <NavButton tab="INDICADORES" icon={BarChart3} label="Dados" />
          {isAdmin && <NavButton tab="ADMIN" icon={Settings} label="Admin" />}
          <button onClick={logout} className="flex flex-col items-center justify-center flex-1 py-3 text-red-300">
              <LogOut size={20} />
              <span className="text-[9px] font-black uppercase tracking-tighter mt-1 opacity-60">Sair</span>
          </button>
      </nav>

      <footer className="hidden lg:block py-6 border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[9px] font-black uppercase text-gray-300 tracking-widest">
              <span>Via Group &copy; 2025</span>
              <button onClick={logout} className="hover:text-red-400 flex items-center gap-1 transition-colors">Logout SharePoint <LogOut size={10} /></button>
          </div>
      </footer>
    </div>
  );
};

export default App;
