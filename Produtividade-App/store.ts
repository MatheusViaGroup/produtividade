
import { useState, useEffect, useCallback } from 'react';
import { AppState, Usuario, Planta, Caminhao, Motorista, Carga } from './types';
import { GraphService, LISTS } from './utils/graphService';

export const useAppState = () => {
  const [state, setState] = useState<AppState>(() => {
      // Tenta recuperar o usuário salvo no localStorage ao iniciar
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

  const connectToSharePoint = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      const token = await GraphService.getAccessToken();
      const service = new GraphService(token);
      setGraph(service);
      
      console.log("Sincronizando com SharePoint...");

      const [p, c, u, m, cr] = await Promise.all([
        service.getListItems(LISTS.PLANTAS),
        service.getListItems(LISTS.CAMINHOES),
        service.getListItems(LISTS.USUARIOS),
        service.getListItems(LISTS.MOTORISTAS),
        service.getListItems(LISTS.CARGAS),
      ]);

      setState(prev => {
          // Se já tínhamos um currentUser persistido, tentamos atualizar os dados dele
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
      console.log("Sincronização concluída.");
    } catch (error: any) {
      console.error("Erro SharePoint:", error);
      // Se houver erro de token/autenticação, não alertamos imediatamente para evitar loops visuais
      if (!error.message?.includes("Interaction required")) {
          alert(`Erro de conexão: ${error.message || "Tente novamente mais tarde."}`);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Auto-connect se houver conta MS ativa
  useEffect(() => {
    const checkAuth = async () => {
      if (await GraphService.hasActiveAccount()) {
          await connectToSharePoint();
      }
    };
    checkAuth();
  }, []);

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
