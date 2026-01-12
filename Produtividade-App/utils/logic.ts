
import { LoadType, Carga } from '../types';
import { addMinutes, differenceInMinutes } from 'date-fns';

export const calculateTravelTimeMinutes = (kmPrevisto: number, tipo: LoadType): number => {
  const travelTimeDays = (kmPrevisto / 38 / 24);
  const travelTimeMinutes = travelTimeDays * 24 * 60;
  const adicional = tipo === 'CHEIA' ? 40 : 80;
  return travelTimeMinutes + adicional;
};

export const calculateExpectedReturn = (dataInicio: Date, kmPrevisto: number, tipo: LoadType): Date => {
  const totalMinutes = calculateTravelTimeMinutes(kmPrevisto, tipo);
  return addMinutes(dataInicio, totalMinutes);
};

export const findPreviousLoadArrival = (caminhaoId: string, currentStart: Date, allCargas: Carga[]): Date | null => {
  const previousLoads = allCargas
    // Updated 'FINALIZADA' to 'CONCLUIDO' to match the LoadStatus type definition
    .filter(c => c['CaminhaoId'] === caminhaoId && c['StatusCarga'] === 'CONCLUIDO' && c['ChegadaReal'] && c['ChegadaReal'] < currentStart)
    .sort((a, b) => b['ChegadaReal']!.getTime() - a['ChegadaReal']!.getTime());
  
  return previousLoads.length > 0 ? previousLoads[0]['ChegadaReal']! : null;
};
