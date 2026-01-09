
import { useState, useEffect, useCallback } from 'react';
import { AppState, Usuario, Planta, Caminhao, Motorista, Carga } from './types';
import { GraphService, LISTS } from './utils/graphService';

export const useAppState = () => {
  const [state, setState] = useState<AppState>({
    plantas: [],
    caminhoes: [],
    usuarios: [],
    motoristas: [],
    cargas: [],
    currentUser: null,
  });
  const [graph, setGraph] = useState<GraphService | null>(null);
  const [loading, setLoading] = useState(false);

  const connectToSharePoint = async () => {
    try {
      setLoading(true);
      const token = await GraphService.getAccessToken();
      const service = new GraphService(token);
      setGraph(service);
      
      console.log("Iniciando busca de dados no SharePoint...");

      const [p, c, u, m, cr] = await Promise.all([
        service.getListItems(LISTS.PLANTAS),
        service.getListItems(LISTS.CAMINHOES),
        service.getListItems(LISTS.USUARIOS),
        service.getListItems(LISTS.MOTORISTAS),
        service.getListItems(LISTS.CARGAS),
      ]);

      setState(prev => ({
        ...prev,
        plantas: p,
        caminhoes: c,
        usuarios: u,
        motoristas: m,
        cargas: cr.map((item: any) => ({
            ...item,
            CargaId: item.id,
            DataCriacao: item.DataCriacao ? new Date(item.DataCriacao) : new Date(),
            DataInicio: item.DataInicio ? new Date(item.DataInicio) : new Date(),
            VoltaPrevista: item.VoltaPrevista ? new Date(item.VoltaPrevista) : new Date(),
            ChegadaReal: item.ChegadaReal ? new Date(item.ChegadaReal) : undefined
        }))
      }));
      console.log("Dados carregados com sucesso!");
    } catch (error: any) {
      console.error("Erro detalhado SharePoint:", error);
      const msg = error.message || "Erro desconhecido";
      alert(`Falha na conexão SharePoint: ${msg}\n\nVerifique se o Redirect URI no Azure está correto e se as permissões foram concedidas.`);
    } finally {
      setLoading(false);
    }
  };

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
        const newItem = { ...payload, CargaId: response.id, DataCriacao: new Date(), StatusCarga: 'ATIVA' };
        setState(prev => ({ ...prev, cargas: [newItem, ...prev.cargas] }));
    } catch (error) {
        console.error("Erro ao criar carga:", error);
        alert("Erro ao salvar carga no SharePoint.");
    }
  };

  const updateCarga = async (updated: Carga) => {
    if (!graph) return;
    try {
        // Nota: Campos com ponto (.) no nome podem precisar de tratamento se o SharePoint renomear internamente
        await graph.updateItem(LISTS.CARGAS, updated['CargaId'], {
            KmReal: updated['KmReal'],
            ChegadaReal: updated['ChegadaReal']?.toISOString(),
            StatusCarga: 'FINALIZADA',
            Diff1_Gap: updated['Diff1_Gap'],
            Diff1_Jusitificativa: updated['Diff1_Jusitificativa'],
            "Diff2_x002e_Atraso": updated['Diff2.Atraso'], // Nome interno comum para pontos
            "Diff2_x002e_Justificativa": updated['Diff2.Justificativa']
        });
        setState(prev => ({
            ...prev,
            cargas: prev.cargas.map(c => c['CargaId'] === updated['CargaId'] ? updated : c)
        }));
    } catch (error) {
        console.error("Erro ao atualizar carga:", error);
        alert("Erro ao finalizar carga no SharePoint.");
    }
  };

  const setCurrentUser = (u: Usuario | null) => setState(prev => ({ ...prev, currentUser: u }));
  const logout = () => {
      setState(prev => ({ ...prev, currentUser: null }));
      setGraph(null);
  };

  return { state, loading, connectToSharePoint, addCarga, updateCarga, setCurrentUser, logout };
};
