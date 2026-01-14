
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
      
      console.log("Iniciando sincronização unificada...");
      
      // Carregando todas as listas do site Powerapps
      const [u, cr, p, c, m] = await Promise.all([
        service.getListItems(LISTS.USUARIOS.id),
        service.getListItems(LISTS.CARGAS.id),
        service.getListItems(LISTS.PLANTAS.id),
        service.getListItems(LISTS.CAMINHOES.id),
        service.getListItems(LISTS.MOTORISTAS.id)
      ]);

      setGraph(service);

      setState(prev => {
          const normalizedPlantas = p.map((item: any) => ({
              ...item,
              id: normalizeId(item.id),
              PlantaID: normalizeId(item.PlantaId || item.PlantaID || item.id)
          }));

          const normalizedCaminhoes = c.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              CaminhaoId: normalizeId(item.CaminhaoId || item.CaminhaoID || item.id),
              PlantaID: normalizeId(item.PlantaId || item.PlantaID)
          }));

          const normalizedMotoristas = m.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              MotoristaId: normalizeId(item.MotoristaId || item.MotoristaID || item.id),
              PlantaID: normalizeId(item.PlantaId || item.PlantaID)
          }));

          const normalizedUsers = u.map((user: any) => ({
            ...user,
            id: normalizeId(user.id),
            PlantaID: normalizeId(user.PlantaId || user.PlantaID)
          }));

          const updatedCurrentUser = prev.currentUser 
            ? normalizedUsers.find((user: any) => normalizeId(user.LoginUsuario).toLowerCase() === normalizeId(prev.currentUser?.LoginUsuario).toLowerCase()) || prev.currentUser
            : null;

          const normalizedCargas = cr.map((item: any) => {
              let status: LoadStatus = 'PENDENTE';
              const s = String(item.StatusCarga || '').toUpperCase();
              if (s === 'FINALIZADA' || s === 'CONCLUIDO') status = 'CONCLUIDO';
              
              return {
                  ...item,
                  CargaId: normalizeId(item.id),
                  PlantaID: normalizeId(item.PlantaId || item.PlantaID),
                  CaminhaoId: normalizeId(item.CaminhaoId || item.CaminhaoID),
                  MotoristaId: normalizeId(item.MotoristaId || item.MotoristaID),
                  StatusCarga: status,
                  DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                  DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                  VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                  ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined,
                  KmReal: item.KmReal ? Number(item.KmReal) : undefined,
                  KmPrevisto: item.KmPrevisto ? Number(item.KmPrevisto) : 0,
                  // Tratamento para nomes com typos ou pontos fornecidos pelo usuário
                  Diff1_Justificativa: item.Diff1_Jusitificativa || item.Diff1_Justificativa,
                  Diff2_Atraso: item['Diff2.Atraso'] || item.Diff2_Atraso,
                  Diff2_Justificativa: item['Diff2.Justificativa'] || item.Diff2_Justificativa
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
      console.error("Erro Crítico de Sincronização:", error);
      alert(`Falha ao conectar com SharePoint: ${error.message}`);
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
    if (!graph) throw new Error("Sincronizando...");
    try {
        const fields = { 
            Title: payload.NomedaUnidade,
            NomedaUnidade: payload.NomedaUnidade,
            PlantaId: normalizeId(payload.PlantaID) 
        };
        const response = await graph.createItem(LISTS.PLANTAS.id, fields);
        const newItem = { ...fields, id: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, plantas: [...prev.plantas, newItem] }));
        return newItem;
    } catch (error: any) { 
        alert(`Erro: ${error.message}`);
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
            PlantaId: normalizeId(payload.PlantaID)
        };
        const response = await graph.createItem(LISTS.USUARIOS.id, fields);
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
            PlantaId: normalizeId(payload.PlantaID),
            CaminhaoId: normalizeId(payload.CaminhaoId),
            MotoristaId: normalizeId(payload.MotoristaId),
            TipoCarga: payload.TipoCarga,
            KmPrevisto: payload.KmPrevisto,
            StatusCarga: 'PENDENTE',
            DataCriacao: new Date().toISOString(),
            DataInicio: payload.DataInicio.toISOString(),
            VoltaPrevista: payload.VoltaPrevista.toISOString()
        };
        const response = await graph.createItem(LISTS.CARGAS.id, fields);
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
            Diff1_Jusitificativa: updated.Diff1_Justificativa, // Usando o nome fornecido com typo
            ['Diff2.Atraso']: updated.Diff2_Atraso, // Usando o nome com ponto conforme pedido
            ['Diff2.Justificativa']: updated.Diff2_Justificativa,
            PlantaId: normalizeId(updated.PlantaID)
        };
        await graph.updateItem(LISTS.CARGAS.id, updated.CargaId, fields);
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => normalizeId(c.CargaId) === normalizeId(updated.CargaId) ? { ...updated } : c)
        }));
    } catch (error: any) { alert(`Erro ao salvar: ${error.message}`); }
  };

  const addCaminhao = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { Title: payload.Placa, Placa: payload.Placa, PlantaId: normalizeId(payload.PlantaID) };
        const response = await graph.createItem(LISTS.CAMINHOES.id, fields);
        const newItem = { ...fields, id: normalizeId(response.id), CaminhaoId: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, caminhoes: [...prev.caminhoes, newItem] }));
        return newItem;
    } catch (error: any) { alert(`Erro: ${error.message}`); }
  };

  const addMotorista = async (payload: any) => {
    if (!graph) return;
    try {
        const fields = { Title: payload.NomedoMotorista, NomedoMotorista: payload.NomedoMotorista, PlantaId: normalizeId(payload.PlantaID) };
        const response = await graph.createItem(LISTS.MOTORISTAS.id, fields);
        const newItem = { ...fields, id: normalizeId(response.id), MotoristaId: normalizeId(response.id), PlantaID: normalizeId(payload.PlantaID) };
        setState(prev => ({ ...prev, motoristas: [...prev.motoristas, newItem] }));
        return newItem;
    } catch (error: any) { alert(`Erro: ${error.message}`); }
  };

  const deletePlanta = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.PLANTAS.id, id); setState(prev => ({ ...prev, plantas: prev.plantas.filter(p => normalizeId(p.id) !== normalizeId(id)) })); } };
  const deleteCaminhao = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CAMINHOES.id, id); setState(prev => ({ ...prev, caminhoes: prev.caminhoes.filter(c => normalizeId(c.id) !== normalizeId(id)) })); } };
  const deleteMotorista = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.MOTORISTAS.id, id); setState(prev => ({ ...prev, motoristas: prev.motoristas.filter(m => normalizeId(m.id) !== normalizeId(id)) })); } };
  const deleteUsuario = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.USUARIOS.id, id); setState(prev => ({ ...prev, usuarios: prev.usuarios.filter(u => normalizeId(u.id) !== normalizeId(id)) })); } };
  const deleteCarga = async (id: string) => { if (graph) { await graph.deleteItem(LISTS.CARGAS.id, id); setState(prev => ({ ...prev, cargas: prev.cargas.filter(c => normalizeId(c.CargaId) !== normalizeId(id)) })); } };

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
