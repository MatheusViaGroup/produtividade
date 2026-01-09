
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Usuario, Planta, Caminhao, Motorista, Carga } from './types';
import { GraphService, LISTS } from './utils/graphService';

export const useAppState = () => {
  const [state, setState] = useState<AppState>(() => {
      const savedUser = localStorage.getItem('produtividade_user');
      return {
        plantas: [],
        caminhoes: [],
        usuarios: [],
        motoristas: [],
        cargas: [],
        currentUser: savedUser ? JSON.parse(savedUser) : null,
      };
  });
  const [graph, setGraph] = useState<GraphService | null>(null);
  const [loading, setLoading] = useState(false);
  const isConnecting = useRef(false);

  const connectToSharePoint = useCallback(async () => {
    if (isConnecting.current) return;
    isConnecting.current = true;
    
    try {
      setLoading(true);
      const token = await GraphService.getAccessToken();
      const service = new GraphService(token);
      
      // Resolve IDs dos sites primeiro
      await service.resolveSites();
      setGraph(service);
      
      console.log("Buscando dados das listas...");

      const [p, c, u, m, cr] = await Promise.all([
        service.getListItems(LISTS.PLANTAS),
        service.getListItems(LISTS.CAMINHOES),
        service.getListItems(LISTS.USUARIOS),
        service.getListItems(LISTS.MOTORISTAS),
        service.getListItems(LISTS.CARGAS),
      ]);

      console.log(`Sucesso: ${u.length} usuários carregados.`);

      setState(prev => {
          const updatedCurrentUser = prev.currentUser 
            ? u.find((user: any) => user.LoginUsuario === prev.currentUser?.LoginUsuario) || prev.currentUser
            : null;

          return {
            ...prev,
            plantas: p,
            caminhoes: c,
            usuarios: u,
            motoristas: m,
            currentUser: updatedCurrentUser,
            cargas: cr.map((item: any) => ({
                ...item,
                CargaId: item.id,
                DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined
            }))
          };
      });
    } catch (error: any) {
      console.error("Falha na conexão SharePoint:", error);
      alert(`Erro: ${error.message || "Falha ao carregar dados do SharePoint. Verifique se você tem acesso aos sites e listas."}`);
    } finally {
      setLoading(false);
      isConnecting.current = false;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (await GraphService.hasActiveAccount()) {
          connectToSharePoint();
      }
    };
    checkAuth();
  }, [connectToSharePoint]);

  const addCarga = async (payload: any) => {
    if (!graph) return;
    try {
        const response = await graph.createItem(LISTS.CARGAS, {
            ...payload,
            StatusCarga: 'ATIVA',
            DataCriacao: new Date().toISOString(),
            DataInicio: payload.DataInicio.toISOString(),
            VoltaPrevista: payload.VoltaPrevista.toISOString()
        });
        const newItem = { 
            ...payload, 
            CargaId: response.id, 
            DataCriacao: new Date(), 
            StatusCarga: 'ATIVA' as const,
            DataInicio: new Date(payload.DataInicio),
            VoltaPrevista: new Date(payload.VoltaPrevista)
        };
        setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
    } catch (error) {
        console.error("Erro ao criar carga:", error);
        alert("Erro ao salvar carga.");
    }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        await graph.updateItem(LISTS.CARGAS, updated['CargaId'], {
            KmReal: updated['KmReal'],
            ChegadaReal: updated['ChegadaReal']?.toISOString(),
            StatusCarga: 'FINALIZADA',
            Diff1_Gap: updated['Diff1_Gap'],
            Diff1_Jusitificativa: updated['Diff1_Jusitificativa'],
            "Diff2_x002e_Atraso": updated['Diff2.Atraso'],
            "Diff2_x002e_Justificativa": updated['Diff2.Justificativa']
        });
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => c['CargaId'] === updated['CargaId'] ? updated : c)
        }));
    } catch (error) {
        console.error("Erro ao atualizar carga:", error);
        alert("Erro ao finalizar carga.");
    }
  };

  const setCurrentUser = (u: Usuario | null) => {
      if (u) {
          localStorage.setItem('produtividade_user', JSON.stringify(u));
      } else {
          localStorage.removeItem('produtividade_user');
      }
      setState(prev => ({ ...prev, currentUser: u }));
  };

  const logout = () => {
      localStorage.removeItem('produtividade_user');
      setState({
        plantas: [],
        caminhoes: [],
        usuarios: [],
        motoristas: [],
        cargas: [],
        currentUser: null,
      });
      setGraph(null);
  };

  return { state, loading, connectToSharePoint, addCarga, updateCarga, setCurrentUser, logout };
};
