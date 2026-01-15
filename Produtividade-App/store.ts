
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Usuario, Planta, Caminhao, Motorista, Carga, LoadStatus, Justificativa } from './types';
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
        justificativas: [],
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
      
      await service.resolveSites();
      setIsAuthenticated(true);
      setGraph(service);

      const [u, cr, p, c, m, j] = await Promise.all([
        service.getListItems(LISTS.USUARIOS.id),
        service.getListItems(LISTS.CARGAS.id),
        service.getListItems(LISTS.PLANTAS.id),
        service.getListItems(LISTS.CAMINHOES.id),
        service.getListItems(LISTS.MOTORISTAS.id),
        service.getListItems(LISTS.JUSTIFICATIVAS.id)
      ]);

      setState(prev => {
          const normalizedPlantas = p.map((item: any) => ({
              ...item,
              id: normalizeId(item.id),
              PlantaId: normalizeId(item.PlantaId || item.PlantaID || item.id)
          }));

          const normalizedCaminhoes = c.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              CaminhaoId: normalizeId(item.CaminhaoId || item.CaminhaoID || item.id),
              PlantaId: normalizeId(item.PlantaId || item.PlantaID)
          }));

          const normalizedMotoristas = m.map((item: any) => ({ 
              ...item, 
              id: normalizeId(item.id),
              MotoristaId: normalizeId(item.MotoristaId || item.MotoristaID || item.id),
              PlantaId: normalizeId(item.PlantaId || item.PlantaID)
          }));

          const normalizedUsers = u.map((user: any) => ({
            ...user,
            id: normalizeId(user.id),
            PlantaId: normalizeId(user.PlantaId || user.PlantaID)
          }));

          const normalizedCargas = cr.map((item: any) => {
              let status: LoadStatus = 'PENDENTE';
              const s = String(item.StatusCarga || '').toUpperCase();
              if (s === 'FINALIZADA' || s === 'CONCLUIDO') status = 'CONCLUIDO';
              
              return {
                  ...item,
                  CargaId: normalizeId(item.id),
                  PlantaId: normalizeId(item.PlantaId || item.PlantaID),
                  CaminhaoId: normalizeId(item.CaminhaoId || item.CaminhaoID),
                  MotoristaId: normalizeId(item.MotoristaId || item.MotoristaID),
                  StatusCarga: status,
                  DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
                  DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
                  VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
                  ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined,
                  KmReal: item.KmReal ? Number(item.KmReal) : undefined,
                  KmPrevisto: item.KmPrevisto ? Number(item.KmPrevisto) : 0,
                  Diff1_Justificativa: item.Diff1_Justificativa || item.Diff1_Jusitificativa,
                  Diff2_Atraso: item.Diff2_Atraso || item['Diff2_x002e_Atraso'] || item['Diff2.Atraso'],
                  Diff2_Justificativa: item.Diff2_Justificativa || item['Diff2_x002e_Justificativa'] || item['Diff2.Justificativa']
              };
          });

          const normalizedJustificativas = j.map((item: any) => ({
              id: normalizeId(item.id),
              Texto: item.Texto || item.Title,
              Tipo: item.Tipo || 'GAP'
          }));

          const updatedCurrentUser = prev.currentUser 
            ? normalizedUsers.find((user: any) => normalizeId(user.LoginUsuario).toLowerCase() === normalizeId(prev.currentUser?.LoginUsuario).toLowerCase()) || prev.currentUser
            : null;

          return {
            ...prev,
            plantas: normalizedPlantas,
            caminhoes: normalizedCaminhoes,
            usuarios: normalizedUsers,
            motoristas: normalizedMotoristas,
            currentUser: updatedCurrentUser,
            cargas: normalizedCargas,
            justificativas: normalizedJustificativas
          };
      });
    } catch (error: any) {
      console.error("Erro na carga de dados:", error);
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

  const addPlanta = async (payload: any) => {
    if (!graph) return;
    const fields = { Title: payload.NomedaUnidade, NomedaUnidade: payload.NomedaUnidade, PlantaId: normalizeId(payload.PlantaId) };
    const response = await graph.createItem(LISTS.PLANTAS.id, fields);
    const newItem = { ...fields, id: normalizeId(response.id), PlantaId: normalizeId(payload.PlantaId) };
    setState(prev => ({ ...prev, plantas: [...prev.plantas, newItem] }));
  };

  const addUsuario = async (payload: any) => {
    if (!graph) return;
    const fields = { Title: payload.NomeCompleto, NomeCompleto: payload.NomeCompleto, LoginUsuario: payload.LoginUsuario, SenhaUsuario: payload.SenhaUsuario, NivelAcesso: payload.NivelAcesso, PlantaId: normalizeId(payload.PlantaId) };
    const response = await graph.createItem(LISTS.USUARIOS.id, fields);
    setState(prev => ({ ...prev, usuarios: [...prev.usuarios, { ...payload, id: normalizeId(response.id), PlantaId: normalizeId(payload.PlantaId) }] }));
  };

  const addJustificativa = async (payload: any) => {
    if (!graph) return;
    const fields = { Title: payload.Texto, Texto: payload.Texto, Tipo: payload.Tipo };
    const response = await graph.createItem(LISTS.JUSTIFICATIVAS.id, fields);
    setState(prev => ({ ...prev, justificativas: [...prev.justificativas, { id: normalizeId(response.id), Texto: payload.Texto, Tipo: payload.Tipo }] }));
  };

  const addCarga = async (payload: any) => {
    if (!graph) return;
    const fields = {
      Title: 'Carga',
      PlantaId: normalizeId(payload.PlantaId),
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
    const newItem = { ...fields, CargaId: normalizeId(response.id), DataCriacao: new Date(), StatusCarga: 'PENDENTE' as const, DataInicio: new Date(payload.DataInicio), VoltaPrevista: new Date(payload.VoltaPrevista), PlantaId: normalizeId(payload.PlantaId), CaminhaoId: normalizeId(payload.CaminhaoId), MotoristaId: normalizeId(payload.MotoristaId) };
    setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
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
            PlantaId: normalizeId(updated.PlantaId)
        };
        await graph.updateItem(LISTS.CARGAS.id, updated.CargaId, fields);
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => normalizeId(c.CargaId) === normalizeId(updated.CargaId) ? { ...updated } : c)
        }));
    } catch (error: any) {
        console.error("Erro ao atualizar carga:", error);
        alert(`Erro do SharePoint: ${error.message}. Verifique os nomes das colunas.`);
    }
  };

  const addCaminhao = async (payload: any) => {
    if (!graph) return;
    const fields = { Title: payload.Placa, Placa: payload.Placa, PlantaId: normalizeId(payload.PlantaId), CaminhaoId: normalizeId(payload.CaminhaoId) };
    const response = await graph.createItem(LISTS.CAMINHOES.id, fields);
    setState(prev => ({ ...prev, caminhoes: [...prev.caminhoes, { ...fields, id: normalizeId(response.id), CaminhaoId: normalizeId(payload.CaminhaoId), PlantaId: normalizeId(payload.PlantaId) }] }));
  };

  const addMotorista = async (payload: any) => {
    if (!graph) return;
    const fields = { Title: payload.NomedoMotorista, NomedoMotorista: payload.NomedoMotorista, PlantaId: normalizeId(payload.PlantaId), MotoristaId: normalizeId(payload.MotoristaId) };
    const response = await graph.createItem(LISTS.MOTORISTAS.id, fields);
    setState(prev => ({ ...prev, motoristas: [...prev.motoristas, { ...fields, id: normalizeId(response.id), MotoristaId: normalizeId(payload.MotoristaId), PlantaId: normalizeId(payload.PlantaId) }] }));
  };

  const deleteItem = async (listId: string, id: string, type: keyof AppState) => {
    if (!graph) return;
    await graph.deleteItem(listId, id);
    setState(prev => ({ ...prev, [type]: (prev[type] as any[]).filter((i: any) => normalizeId(i.id || i.CargaId) !== normalizeId(id)) }));
  };

  const loginLocal = (login: string, pass: string): boolean => {
    const logNorm = normalizeId(login).toLowerCase();
    if (logNorm === 'matheus' && pass === 'admin321123') {
        setCurrentUser({ id: 'master', NomeCompleto: 'Matheus (Master)', LoginUsuario: 'Matheus', SenhaUsuario: 'admin321123', NivelAcesso: 'Admin' });
        return true;
    }
    const found = state.usuarios.find(u => normalizeId(u.LoginUsuario).toLowerCase() === logNorm && u.SenhaUsuario === pass);
    if (found) { setCurrentUser(found); return true; }
    return false;
  };

  const setCurrentUser = (u: Usuario | null) => {
    if (u) { localStorage.setItem('produtividade_user', JSON.stringify(u)); } 
    else { localStorage.removeItem('produtividade_user'); }
    setState(prev => ({ ...prev, currentUser: u }));
  };

  const logout = () => { localStorage.removeItem('produtividade_user'); setIsAuthenticated(false); setGraph(null); window.location.reload(); };

  return { state, loading, isAuthenticated, loginLocal, connectToSharePoint, addPlanta, addUsuario, addCarga, addCaminhao, addMotorista, addJustificativa, updateCarga, logout, setCurrentUser, 
    deletePlanta: (id: string) => deleteItem(LISTS.PLANTAS.id, id, 'plantas'),
    deleteCaminhao: (id: string) => deleteItem(LISTS.CAMINHOES.id, id, 'caminhoes'),
    deleteMotorista: (id: string) => deleteItem(LISTS.MOTORISTAS.id, id, 'motoristas'),
    deleteUsuario: (id: string) => deleteItem(LISTS.USUARIOS.id, id, 'usuarios'),
    deleteCarga: (id: string) => deleteItem(LISTS.CARGAS.id, id, 'cargas'),
    deleteJustificativa: (id: string) => deleteItem(LISTS.JUSTIFICATIVAS.id, id, 'justificativas')
  };
};
