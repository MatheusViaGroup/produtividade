
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

  const normalizeId = (id: any): string => {
    if (id === null || id === undefined) return '';
    return String(id).trim();
  };

  const connectToSharePoint = useCallback(async () => {
    if (isConnecting.current) return;
    isConnecting.current = true;
    
    try {
      setLoading(true);
      const token = await GraphService.getAccessToken();
      const service = new GraphService(token);
      
      setIsAuthenticated(true);
      await service.resolveSites();
      
      console.log("Sincronizando listas do SharePoint...");
      
      // Carregando dados
      const [u, cr, p, c, m] = await Promise.all([
        service.getListItems(LISTS.USUARIOS),
        service.getListItems(LISTS.CARGAS),
        service.getListItems(LISTS.PLANTAS),
        service.getListItems(LISTS.CAMINHOES),
        service.getListItems(LISTS.MOTORISTAS)
      ]);

      console.log(`Dados carregados: ${u.length} usuários, ${cr.length} cargas, ${p.length} plantas.`);

      setGraph(service);

      setState(prev => {
          const normalizedPlantas = p.map((item: any) => ({
              ...item,
              id: normalizeId(item.id),
              PlantaID: normalizeId(item.PlantaID || item.PlantaId || item.id)
          }));

          const normalizedCaminhoes = c.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              CaminhaoId: normalizeId(item.id),
              PlantaID: normalizeId(item.PlantaID || item.PlantaId)
          }));

          const normalizedMotoristas = m.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              MotoristaId: normalizeId(item.id),
              PlantaID: normalizeId(item.PlantaID || item.PlantaId)
          }));

          const normalizedUsers = u.map((user: any) => ({
            ...user,
            id: normalizeId(user.id),
            PlantaID: normalizeId(user.PlantaID || user.PlantaId || user.plantaId)
          }));

          const updatedCurrentUser = prev.currentUser 
            ? normalizedUsers.find((user: any) => normalizeId(user.LoginUsuario) === normalizeId(prev.currentUser?.LoginUsuario)) || prev.currentUser
            : null;

          const normalizedCargas = cr.map((item: any) => {
              let status: LoadStatus = 'PENDENTE';
              const s = String(item.StatusCarga || '').toUpperCase();
              if (s === 'FINALIZADA' || s === 'CONCLUIDO') status = 'CONCLUIDO';
              
              return {
                  ...item,
                  CargaId: normalizeId(item.id),
                  PlantaID: normalizeId(item.PlantaID || item.PlantaId),
                  CaminhaoId: normalizeId(item.CaminhaoId || item.CaminhaoID),
                  MotoristaId: normalizeId(item.MotoristaId || item.MotoristaID),
                  StatusCarga: status,
                  DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                  DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                  VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                  ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined,
                  KmReal: item.KmReal ? Number(item.KmReal) : undefined,
                  KmPrevisto: item.KmPrevisto ? Number(item.KmPrevisto) : 0,
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
      console.error("Erro Crítico na Sincronização:", error);
      alert(`Falha ao sincronizar com SharePoint: ${error.message}`);
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
      const logNorm = normalizeId(login).toLowerCase();
      if (logNorm === 'matheus' && pass === 'admin321123') {
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
        normalizeId(u.LoginUsuario).toLowerCase() === logNorm && 
        u.SenhaUsuario === pass
      );
      if (found) {
          setCurrentUser(found);
          return true;
      }
      return false;
  };

  const addPlanta = async (payload: any) => {
    if (!graph) throw new Error("Aguardando inicialização do serviço Graph...");
    try {
        const fields = { 
            Title: payload.NomedaUnidade,
            NomedaUnidade: payload.NomedaUnidade,
            PlantaID: normalizeId(payload.PlantaID) 
        };
        const response = await graph.createItem(LISTS.PLANTAS, fields);
        const newItem = { ...fields, id: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, plantas: [...prev.plantas, newItem] }));
        return newItem;
    } catch (error: any) { 
        alert(`Erro SharePoint: ${error.message}`);
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
            PlantaID: normalizeId(payload.PlantaID)
        };
        const response = await graph.createItem(LISTS.USUARIOS, fields);
        const newItem = { ...payload, id: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, usuarios: [...prev.usuarios, newItem] }));
        return newItem;
    } catch (error: any) { throw error; }
  };

  const addCarga = async (payload: any) => {
    if (!graph) return;
    try {
        const camId = normalizeId(payload.CaminhaoId);
        const cam = state.caminhoes.find(c => normalizeId(c.CaminhaoId) === camId);
        const fields = {
            Title: cam?.Placa || 'Nova Carga',
            PlantaID: normalizeId(payload.PlantaID),
            CaminhaoId: normalizeId(payload.CaminhaoId),
            MotoristaId: normalizeId(payload.MotoristaId),
            TipoCarga: payload.TipoCarga,
            KmPrevisto: payload.KmPrevisto,
            StatusCarga: 'PENDENTE',
            DataCriacao: new Date().toISOString(),
            DataInicio: payload.DataInicio.toISOString(),
            VoltaPrevista: payload.VoltaPrevista.toISOString()
        };
        const response = await graph.createItem(LISTS.CARGAS, fields);
        const newItem = { 
            ...fields, 
            CargaId: normalizeId(response.id), 
            DataCriacao: new Date(), 
            StatusCarga: 'PENDENTE' as const,
            DataInicio: new Date(payload.DataInicio),
            VoltaPrevista: new Date(payload.VoltaPrevista),
            PlantaID: normalizeId(payload.PlantaID),
            CaminhaoId: normalizeId(payload.CaminhaoId),
            MotoristaId: normalizeId(payload.MotoristaId)
        };
        setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
        return newItem;
    } catch (error: any) { throw error; }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        const fields: any = {
            CaminhaoId: normalizeId(updated.CaminhaoId),
            MotoristaId: normalizeId(updated.MotoristaId),
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
            PlantaID: normalizeId(updated.PlantaID)
        };
        await graph.updateItem(LISTS.CARGAS, updated.CargaId, fields);
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => normalizeId(c.CargaId) === normalizeId(updated.CargaId) ? { ...updated } : c)
        }));
    } catch (error: any) { alert(`Erro ao salvar: ${error.message}`); }
  };

  const addCaminhao = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { Title: payload.Placa, Placa: payload.Placa, PlantaID: normalizeId(payload.PlantaID) };
        const response = await graph.createItem(LISTS.CAMINHOES, fields);
        const newItem = { ...fields, id: normalizeId(response.id), CaminhaoId: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, caminhoes: [...prev.caminhoes, newItem] }));
        return newItem;
    } catch (error: any) { alert(`Erro ao criar caminhão: ${error.message}`); }
  };

  const addMotorista = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { Title: payload.NomedoMotorista, NomedoMotorista: payload.NomedoMotorista, PlantaID: normalizeId(payload.PlantaID) };
        const response = await graph.createItem(LISTS.MOTORISTAS, fields);
        const newItem = { ...fields, id: normalizeId(response.id), MotoristaId: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, motoristas: [...prev.motoristas, newItem] }));
        return newItem;
    } catch (error: any) { alert(`Erro ao criar motorista: ${error.message}`); }
  };

  const deletePlanta = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.PLANTAS, id); setState(prev => ({ ...prev, plantas: prev.plantas.filter(p => normalizeId(p.id) !== normalizeId(id)) })); } };
  const deleteCaminhao = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CAMINHOES, id); setState(prev => ({ ...prev, caminhoes: prev.caminhoes.filter(c => normalizeId(c.id) !== normalizeId(id)) })); } };
  const deleteMotorista = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.MOTORISTAS, id); setState(prev => ({ ...prev, motoristas: prev.motoristas.filter(m => normalizeId(m.id) !== normalizeId(id)) })); } };
  const deleteUsuario = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.USUARIOS, id); setState(prev => ({ ...prev, usuarios: prev.usuarios.filter(u => normalizeId(u.id) !== normalizeId(id)) })); } };
  const deleteCarga = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CARGAS, id); setState(prev => ({ ...prev, cargas: prev.cargas.filter(c => normalizeId(c.CargaId) !== normalizeId(id)) })); } };

  const setCurrentUser = (u: Usuario | null) => {
      if (u) {
          const userWithNormId = { ...u, PlantaID: normalizeId(u.PlantaID) };
          localStorage.setItem('produtividade_user', JSON.stringify(userWithNormId));
          setState(prev => ({ ...prev, currentUser: userWithNormId }));
      } else {
          localStorage.removeItem('produtividade_user');
          setState(prev => ({ ...prev, currentUser: null }));
      }
  };

  const logout = () => {
      localStorage.removeItem('produtividade_user');
      setIsAuthenticated(false);
      setState({ plantas: [], caminhoes: [], usuarios: [], motoristas: [], cargas: [], currentUser: null });
      setGraph(null);
  };

  return { state, loading, isAuthenticated, loginLocal, connectToSharePoint, addPlanta, addUsuario, addCarga, addCaminhao, addMotorista, updateCarga, deletePlanta, deleteCaminhao, deleteUsuario, deleteMotorista, deleteCarga, setCurrentUser, logout };
};
