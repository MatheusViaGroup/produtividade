
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Usuario, Planta, Caminhao, Motorista, Carga, LoadStatus } from './types';
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
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
      
      setIsAuthenticated(true);
      await service.resolveSites();
      setGraph(service);
      
      const p = await service.getListItems(LISTS.PLANTAS);
      const c = await service.getListItems(LISTS.CAMINHOES);
      const u = await service.getListItems(LISTS.USUARIOS);
      const m = await service.getListItems(LISTS.MOTORISTAS);
      const cr = await service.getListItems(LISTS.CARGAS);

      setState(prev => {
          const updatedCurrentUser = prev.currentUser 
            ? u.find((user: any) => user.LoginUsuario === prev.currentUser?.LoginUsuario) || prev.currentUser
            : null;

          return {
            ...prev,
            plantas: p,
            caminhoes: c.map((item: any) => ({ ...item, CaminhaoId: item.id })),
            usuarios: u,
            motoristas: m.map((item: any) => ({ ...item, MotoristaId: item.id })),
            currentUser: updatedCurrentUser,
            cargas: cr.map((item: any) => {
                let status: LoadStatus = 'PENDENTE';
                const s = String(item.StatusCarga || '').toUpperCase();
                if (s === 'FINALIZADA' || s === 'CONCLUIDO') status = 'CONCLUIDO';
                else if (s === 'ATIVA' || s === 'PENDENTE') status = 'PENDENTE';

                return {
                    ...item,
                    CargaId: item.id,
                    StatusCarga: status,
                    DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                    DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                    VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                    ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined,
                    Diff1_Justificativa: item.Diff1_Justificativa,
                    Diff2_Atraso: item.Diff2_Atraso,
                    Diff2_Justificativa: item.Diff2_Justificativa
                };
            })
          };
      });
    } catch (error: any) {
      console.error("Falha na conexão SharePoint:", error);
      alert(`Erro: ${error.message}`);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
      isConnecting.current = false;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (await GraphService.hasActiveAccount()) {
          setIsAuthenticated(true);
          connectToSharePoint();
      }
    };
    checkAuth();
  }, [connectToSharePoint]);

  const loginLocal = (login: string, pass: string): boolean => {
      if (login === 'Matheus' && pass === 'admin321123') {
          const masterUser: Usuario = {
              id: 'master',
              NomeCompleto: 'Matheus (Master)',
              LoginUsuario: 'Matheus',
              SenhaUsuario: 'admin321123',
              NivelAcesso: 'Admin'
          };
          setCurrentUser(masterUser);
          return true;
      }

      const found = state.usuarios.find(u => 
        u.LoginUsuario?.toLowerCase() === login.toLowerCase() && 
        u.SenhaUsuario === pass
      );

      if (found) {
          setCurrentUser(found);
          return true;
      }
      return false;
  };

  const addPlanta = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { ...payload, Title: payload.NomedaUnidade };
        const response = await graph.createItem(LISTS.PLANTAS, fields);
        const newItem = { ...fields, id: response.id };
        setState(prev => ({ ...prev, plantas: [...prev.plantas, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar planta:", error);
        throw new Error(error.response?.data?.error?.message || error.message);
    }
  };

  const addUsuario = async (payload: any) => {
    if (!graph) return;
    try {
        const fields: any = {
            Title: payload.NomeCompleto,
            NomeCompleto: payload.NomeCompleto,
            LoginUsuario: payload.LoginUsuario,
            SenhaUsuario: payload.SenhaUsuario,
            NivelAcesso: payload.NivelAcesso
        };

        // De acordo com o print enviado, a coluna se chama PlantaID (ID em maiúsculo)
        if (payload.NivelAcesso === 'Operador' && payload.PlantaId) {
            fields.PlantaID = payload.PlantaId; // Gravando o GUID da planta vinculada
        } else {
            fields.PlantaID = null;
        }

        console.log("Enviando para o SharePoint:", fields);

        const response = await graph.createItem(LISTS.USUARIOS, fields);
        const newItem = { ...fields, id: response.id };
        setState(prev => ({ ...prev, usuarios: [...prev.usuarios, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar usuário:", error);
        const errorDetail = error.response?.data?.error?.message || error.message || "Erro desconhecido";
        throw new Error(`Falha no SharePoint: ${errorDetail}`);
    }
  };

  const deletePlanta = async (id: string) => {
    if (!graph) return;
    try {
        await graph.deleteItem(LISTS.PLANTAS, id);
        setState(prev => ({ ...prev, plantas: prev.plantas.filter(p => p.id !== id) }));
    } catch (error) {
        console.error("Erro ao excluir planta:", error);
        alert("Falha ao excluir planta no SharePoint.");
    }
  };

  const deleteCaminhao = async (id: string) => {
    if (!graph) return;
    try {
        await graph.deleteItem(LISTS.CAMINHOES, id);
        setState(prev => ({ ...prev, caminhoes: prev.caminhoes.filter(c => c.id !== id) }));
    } catch (error) {
        console.error("Erro ao excluir caminhão:", error);
        alert("Falha ao excluir caminhão no SharePoint.");
    }
  };

  const deleteMotorista = async (id: string) => {
    if (!graph) return;
    try {
        await graph.deleteItem(LISTS.MOTORISTAS, id);
        setState(prev => ({ ...prev, motoristas: prev.motoristas.filter(m => m.id !== id) }));
    } catch (error) {
        console.error("Erro ao excluir motorista:", error);
        alert("Falha ao excluir motorista no SharePoint.");
    }
  };

  const deleteUsuario = async (id: string) => {
    if (!graph) return;
    try {
        await graph.deleteItem(LISTS.USUARIOS, id);
        setState(prev => ({ ...prev, usuarios: prev.usuarios.filter(u => u.id !== id) }));
    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        alert("Falha ao excluir usuário no SharePoint.");
    }
  };

  const deleteCarga = async (id: string) => {
    if (!graph) return;
    try {
        await graph.deleteItem(LISTS.CARGAS, id);
        setState(prev => ({ ...prev, cargas: prev.cargas.filter(c => c.CargaId !== id) }));
    } catch (error) {
        console.error("Erro ao excluir carga:", error);
        alert("Falha ao excluir carga no SharePoint.");
    }
  };

  const addCarga = async (payload: any) => {
    if (!graph) return;
    try {
        const caminhao = state.caminhoes.find(c => c.CaminhaoId === payload.CaminhaoId);
        const fields = {
            ...payload,
            Title: caminhao?.Placa || 'Nova Carga',
            StatusCarga: 'PENDENTE',
            DataCriacao: new Date().toISOString(),
            DataInicio: payload.DataInicio.toISOString(),
            VoltaPrevista: payload.VoltaPrevista.toISOString()
        };
        const response = await graph.createItem(LISTS.CARGAS, fields);
        const newItem = { 
            ...fields, 
            CargaId: response.id, 
            DataCriacao: new Date(), 
            StatusCarga: 'PENDENTE' as const,
            DataInicio: new Date(payload.DataInicio),
            VoltaPrevista: new Date(payload.VoltaPrevista)
        };
        setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar carga:", error);
        throw new Error(error.response?.data?.error?.message || error.message);
    }
  };

  const addCaminhao = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { ...payload, Title: payload.Placa };
        const response = await graph.createItem(LISTS.CAMINHOES, fields);
        const newItem = { ...fields, id: response.id, CaminhaoId: response.id };
        setState(prev => ({ ...prev, caminhoes: [...prev.caminhoes, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar caminhão:", error);
        throw new Error(error.response?.data?.error?.message || error.message);
    }
  };

  const addMotorista = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { ...payload, Title: payload.NomedoMotorista };
        const response = await graph.createItem(LISTS.MOTORISTAS, fields);
        const newItem = { ...fields, id: response.id, MotoristaId: response.id };
        setState(prev => ({ ...prev, motoristas: [...prev.motoristas, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar motorista:", error);
        throw new Error(error.response?.data?.error?.message || error.message);
    }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        const sharePointFields: any = {
            CaminhaoId: updated.CaminhaoId,
            MotoristaId: updated.MotoristaId,
            TipoCarga: updated.TipoCarga,
            KmPrevisto: updated.KmPrevisto,
            DataInicio: updated.DataInicio.toISOString(),
            VoltaPrevista: updated.VoltaPrevista.toISOString(),
            StatusCarga: updated.StatusCarga,
            KmReal: updated.KmReal,
            ChegadaReal: updated.ChegadaReal?.toISOString(),
            Diff1_Gap: updated.Diff1_Gap,
            Diff1_Justificativa: updated.Diff1_Justificativa,
            Diff2_Atraso: updated.Diff2_Atraso,
            Diff2_Justificativa: updated.Diff2_Justificativa
        };

        const caminhao = state.caminhoes.find(c => c.CaminhaoId === updated.CaminhaoId);
        if (caminhao) {
          sharePointFields.Title = caminhao.Placa;
        }

        await graph.updateItem(LISTS.CARGAS, updated.CargaId, sharePointFields);
        
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => c.CargaId === updated.CargaId ? { ...updated } : c)
        }));
    } catch (error: any) {
        console.error("Erro ao atualizar carga:", error);
        alert(`Erro ao salvar no SharePoint: ${error.response?.data?.error?.message || error.message}`);
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
      setIsAuthenticated(false);
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

  return { state, loading, isAuthenticated, loginLocal, connectToSharePoint, addPlanta, addUsuario, addCarga, addCaminhao, addMotorista, updateCarga, deletePlanta, deleteCaminhao, deleteUsuario, deleteMotorista, deleteCarga, setCurrentUser, logout };
};
