
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
                // Normalização de status legado do SharePoint
                let status: LoadStatus = 'PENDENTE';
                if (item.StatusCarga === 'FINALIZADA' || item.StatusCarga === 'CONCLUIDO') status = 'CONCLUIDO';
                else if (item.StatusCarga === 'ATIVA' || item.StatusCarga === 'PENDENTE') status = 'PENDENTE';

                return {
                    ...item,
                    CargaId: item.id,
                    StatusCarga: status,
                    DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                    DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                    VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                    ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined
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
    } catch (error) {
        console.error("Erro ao criar planta:", error);
        throw error;
    }
  };

  const addUsuario = async (payload: any) => {
    if (!graph) return;
    try {
        const cleanPayload = { ...payload };
        if (cleanPayload.NivelAcesso === 'Admin' && !cleanPayload.PlantaId) {
            delete cleanPayload.PlantaId;
        }
        const fields = { ...cleanPayload, Title: payload.NomeCompleto };
        const response = await graph.createItem(LISTS.USUARIOS, fields);
        const newItem = { ...fields, id: response.id };
        setState(prev => ({ ...prev, usuarios: [...prev.usuarios, newItem] }));
        return newItem;
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        throw error;
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
    } catch (error) {
        console.error("Erro ao criar carga:", error);
        throw error;
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
    } catch (error) {
        console.error("Erro ao criar caminhão:", error);
        throw error;
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
    } catch (error) {
        console.error("Erro ao criar motorista:", error);
        throw error;
    }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        await graph.updateItem(LISTS.CARGAS, updated['CargaId'], {
            KmReal: updated['KmReal'],
            ChegadaReal: updated['ChegadaReal']?.toISOString(),
            StatusCarga: 'CONCLUIDO',
            Diff1_Gap: updated['Diff1_Gap'],
            Diff1_Jusitificativa: updated['Diff1_Jusitificativa'],
            "Diff2_x002e_Atraso": updated['Diff2.Atraso'],
            "Diff2_x002e_Justificativa": updated['Diff2.Justificativa']
        });
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => c['CargaId'] === updated['CargaId'] ? { ...updated, StatusCarga: 'CONCLUIDO' as const } : c)
        }));
    } catch (error) {
        console.error("Erro ao atualizar carga:", error);
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

  return { state, loading, isAuthenticated, loginLocal, connectToSharePoint, addPlanta, addUsuario, addCarga, addCaminhao, addMotorista, updateCarga, deletePlanta, deleteCaminhao, deleteUsuario, deleteMotorista, setCurrentUser, logout };
};
