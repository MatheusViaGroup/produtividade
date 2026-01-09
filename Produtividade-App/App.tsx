
import React, { useState } from 'react';
import { useAppState } from './store';
import { Admin } from './components/Admin';
import { Loads } from './components/Loads';
import { Indicators } from './components/Indicators';
import { LogOut, ShieldCheck, User as UserIcon, Loader2, KeyRound } from 'lucide-react';

const LOGO_URL = "https://viagroup.com.br/assets/via_group-22fac685.png";
const MICROSOFT_LOGO = "https://static.vecteezy.com/system/resources/previews/027/127/473/non_2x/microsoft-logo-microsoft-icon-transparent-free-png.png";

const LoginMicrosoft: React.FC<{ onConnect: () => void, loading: boolean }> = ({ onConnect, loading }) => (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl text-center">
            <div className="w-full flex items-center justify-center mb-8">
                <img src={LOGO_URL} alt="Via Group" className="h-16 object-contain" />
            </div>
            <h1 className="text-4xl font-black text-blue-950 uppercase italic tracking-tighter mb-2 leading-none">Produtividade</h1>
            <p className="text-[10px] font-bold text-blue-900/40 uppercase tracking-[0.2em] mb-10">Conexão Microsoft Necessária</p>
            <button 
                onClick={onConnect}
                disabled={loading}
                className="w-full bg-[#2F2F2F] text-white font-black uppercase text-xs py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all"
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white p-12 rounded-[2.5rem] shadow-xl max-w-md w-full text-center">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-100">
                        <KeyRound size={40} />
                    </div>
                    <h2 className="text-3xl font-black uppercase italic text-blue-950">Acesso Interno</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Entre com seus dados do sistema</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        required
                        type="text" 
                        placeholder="Usuário" 
                        value={user}
                        onChange={e => setUser(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700 transition-all"
                    />
                    <input 
                        required
                        type="password" 
                        placeholder="Senha" 
                        value={pass}
                        onChange={e => setPass(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700 transition-all"
                    />
                    {error && <p className="text-red-500 text-[10px] font-black uppercase">Dados incorretos. Tente novamente.</p>}
                    <button className="w-full bg-blue-600 text-white font-black uppercase text-xs py-5 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">Entrar no Sistema</button>
                </form>
                
                <button onClick={onBack} className="mt-8 text-[10px] font-black uppercase text-gray-300 hover:text-red-400 transition-colors">Sair / Trocar Microsoft</button>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { state, loading, isAuthenticated, loginLocal, connectToSharePoint, logout, setCurrentUser, ...actions } = useAppState();
  const [activeTab, setActiveTab] = useState<'CARGAS' | 'INDICADORES' | 'ADMIN'>('CARGAS');

  const currentUser = state.currentUser;
  
  if (!isAuthenticated) return <LoginMicrosoft onConnect={connectToSharePoint} loading={loading} />;
  
  if (loading && !state.usuarios.length) {
    return (
        <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
            <p className="text-white text-xs font-black uppercase tracking-widest opacity-50">Preparando Ambiente...</p>
        </div>
    );
  }

  if (!currentUser) return <LoginApp onLogin={loginLocal} onBack={logout} />;

  // Correção crucial: Aceita "Admin" ou "ADMIN"
  const isAdmin = currentUser['NivelAcesso']?.toUpperCase() === 'ADMIN';

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
                  <button onClick={() => setCurrentUser(null)} className="text-[9px] font-black text-blue-400 uppercase flex items-center gap-1 mt-1">Sair do Perfil</button>
              </div>
              <div className="bg-blue-500 p-2.5 rounded-xl text-white shadow-lg"><UserIcon size={18} /></div>
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
              <button onClick={logout} className="hover:text-red-400 flex items-center gap-1 transition-colors">Desconectar Microsoft <LogOut size={10} /></button>
          </div>
      </footer>
    </div>
  );
};

export default App;
