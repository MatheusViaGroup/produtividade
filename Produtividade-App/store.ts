
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
      
      const [p, c, u, m, cr] = await Promise.all([
        service.getListItems(LISTS.PLANTAS),
        service.getListItems(LISTS.CAMINHOES),
        service.getListItems(LISTS.USUARIOS),
        service.getListItems(LISTS.MOTORISTAS),
        service.getListItems(LISTS.CARGAS)
      ]);

      console.log("Dados carregados do SharePoint. Iniciando normalização rigorosa...");

      setState(prev => {
          // 1. Normalização de Plantas (Chave Primária)
          const normalizedPlantas = p.map((item: any) => ({
              ...item,
              id: String(item.id),
              PlantaId: String(item.PlantaId || item.PlantaID || item.id)
          }));

          // 2. Normalização de Caminhões (ID e Vínculo de Planta)
          const normalizedCaminhoes = c.map((item: any) => ({ 
              ...item, 
              id: String(item.id),
              CaminhaoId: String(item.id),
              PlantaId: String(item.PlantaId || item.PlantaID || '')
          }));

          // 3. Normalização de Motoristas (ID e Vínculo de Planta)
          const normalizedMotoristas = m.map((item: any) => ({ 
              ...item, 
              id: String(item.id),
              MotoristaId: String(item.id),
              PlantaId: String(item.PlantaId || item.PlantaID || '')
          }));

          // 4. Normalização de Usuários
          const normalizedUsers = u.map((user: any) => ({
            ...user,
            id: String(user.id),
            PlantaId: String(user.PlantaId || user.PlantaID || user.plantaId || '')
          }));

          const updatedCurrentUser = prev.currentUser 
            ? normalizedUsers.find((user: any) => user.LoginUsuario === prev.currentUser?.LoginUsuario) || prev.currentUser
            : null;

          // 5. Normalização de Cargas (Relacionamentos)
          const normalizedCargas = cr.map((item: any) => {
              let status: LoadStatus = 'PENDENTE';
              const s = String(item.StatusCarga || '').toUpperCase();
              if (s === 'FINALIZADA' || s === 'CONCLUIDO') status = 'CONCLUIDO';
              
              return {
                  ...item,
                  CargaId: String(item.id),
                  // Normalização de chaves estrangeiras para garantir o .find()
                  PlantaId: String(item.PlantaId || item.PlantaID || ''),
                  CaminhaoId: String(item.CaminhaoId || item.CaminhaoID || ''),
                  MotoristaId: String(item.MotoristaId || item.MotoristaID || ''),
                  StatusCarga: status,
                  DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                  DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                  VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                  ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined,
              };
          });

          return {
            ...prev,
            plantas: normalizedPlantas,
            caminhoes: normalizedCaminhoes,
            usuarios: normalizedUsers,
            motoristas: normalizedMotoristas,
            currentUser: updatedCurrentUser,
            cargas: normalizedCargas
          };
      });
    } catch (error: any) {
      console.error("Falha na conexão SharePoint:", error);
      alert(`Erro de Conexão: ${error.message}`);
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
        const newItem = { ...fields, id: String(response.id), PlantaId: String(payload.PlantaId) };
        setState(prev => ({ ...prev, plantas: [...prev.plantas, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar planta:", error);
        throw error;
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
            NivelAcesso: payload.NivelAcesso,
            PlantaID: String(payload.PlantaId)
        };
        const response = await graph.createItem(LISTS.USUARIOS, fields);
        const newItem = { ...payload, id: String(response.id), PlantaId: String(payload.PlantaId) };
        setState(prev => ({ ...prev, usuarios: [...prev.usuarios, newItem] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar usuário:", error);
        throw error;
    }
  };

  const addCarga = async (payload: any) => {
    if (!graph) return;
    try {
        const caminhao = state.caminhoes.find(c => String(c.CaminhaoId) === String(payload.CaminhaoId));
        const fields = {
            ...payload,
            PlantaID: String(payload.PlantaId),
            CaminhaoId: String(payload.CaminhaoId),
            MotoristaId: String(payload.MotoristaId),
            Title: caminhao?.Placa || 'Nova Carga',
            StatusCarga: 'PENDENTE',
            DataCriacao: new Date().toISOString(),
            DataInicio: payload.DataInicio.toISOString(),
            VoltaPrevista: payload.VoltaPrevista.toISOString()
        };
        const response = await graph.createItem(LISTS.CARGAS, fields);
        const newItem = { 
            ...fields, 
            CargaId: String(response.id), 
            DataCriacao: new Date(), 
            StatusCarga: 'PENDENTE' as const,
            DataInicio: new Date(payload.DataInicio),
            VoltaPrevista: new Date(payload.VoltaPrevista),
            PlantaId: String(payload.PlantaId),
            CaminhaoId: String(payload.CaminhaoId),
            MotoristaId: String(payload.MotoristaId)
        };
        setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
        return newItem;
    } catch (error: any) {
        console.error("Erro ao criar carga:", error);
        throw error;
    }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        const sharePointFields: any = {
            CaminhaoId: String(updated.CaminhaoId),
            MotoristaId: String(updated.MotoristaId),
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
            Diff2_Justificativa: updated.Diff2_Justificativa,
            PlantaID: String(updated.PlantaId)
        };

        await graph.updateItem(LISTS.CARGAS, updated.CargaId, sharePointFields);
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => c.CargaId === updated.CargaId ? { ...updated } : c)
        }));
    } catch (error: any) {
        console.error("Erro ao atualizar carga:", error);
        alert(`Erro ao salvar: ${error.message}`);
    }
  };

  const addCaminhao = async (payload: any) => {
    if (!graph) return;
    const fields = { ...payload, Title: payload.Placa, PlantaID: String(payload.PlantaId) };
    const response = await graph.createItem(LISTS.CAMINHOES, fields);
    const newItem = { ...fields, id: String(response.id), CaminhaoId: String(response.id), PlantaId: String(payload.PlantaId) };
    setState(prev => ({ ...prev, caminhoes: [...prev.caminhoes, newItem] }));
    return newItem;
  };

  const addMotorista = async (payload: any) => {
    if (!graph) return;
    const fields = { ...payload, Title: payload.NomedoMotorista, PlantaID: String(payload.PlantaId) };
    const response = await graph.createItem(LISTS.MOTORISTAS, fields);
    const newItem = { ...fields, id: String(response.id), MotoristaId: String(response.id), PlantaId: String(payload.PlantaId) };
    setState(prev => ({ ...prev, motoristas: [...prev.motoristas, newItem] }));
    return newItem;
  };

  const deletePlanta = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.PLANTAS, id); setState(prev => ({ ...prev, plantas: prev.plantas.filter(p => String(p.id) !== String(id)) })); } };
  const deleteCaminhao = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CAMINHOES, id); setState(prev => ({ ...prev, caminhoes: prev.caminhoes.filter(c => String(c.id) !== String(id)) })); } };
  const deleteMotorista = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.MOTORISTAS, id); setState(prev => ({ ...prev, motoristas: prev.motoristas.filter(m => String(m.id) !== String(id)) })); } };
  const deleteUsuario = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.USUARIOS, id); setState(prev => ({ ...prev, usuarios: prev.usuarios.filter(u => String(u.id) !== String(id)) })); } };
  const deleteCarga = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CARGAS, id); setState(prev => ({ ...prev, cargas: prev.cargas.filter(c => String(c.CargaId) !== String(id)) })); } };

  const setCurrentUser = (u: Usuario | null) => {
      if (u) localStorage.setItem('produtividade_user', JSON.stringify(u));
      else localStorage.removeItem('produtividade_user');
      setState(prev => ({ ...prev, currentUser: u }));
  };

  const logout = () => {
      localStorage.removeItem('produtividade_user');
      setIsAuthenticated(false);
      setState({ plantas: [], caminhoes: [], usuarios: [], motoristas: [], cargas: [], currentUser: null });
      setGraph(null);
  };

  return { state, loading, isAuthenticated, loginLocal, connectToSharePoint, addPlanta, addUsuario, addCarga, addCaminhao, addMotorista, updateCarga, deletePlanta, deleteCaminhao, deleteUsuario, deleteMotorista, deleteCarga, setCurrentUser, logout };
};
