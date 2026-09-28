export interface PublicPlant {
  code: 'LATEX' | 'LATEX_VIEJO' | 'TERPLAST' | 'SLURRY' | 'ENDUIDO' | 'SINTETICOS';
  name: string;
}

export const publicPlants: PublicPlant[] = [
  { code: 'LATEX', name: 'Látex' },
  { code: 'LATEX_VIEJO', name: 'Látex Viejo' },
  { code: 'TERPLAST', name: 'Terplast' },
  { code: 'SLURRY', name: 'Slurry' },
  { code: 'ENDUIDO', name: 'Enduido' },
  { code: 'SINTETICOS', name: 'Sinteticos' }
];

export function findPublicPlant(code: string | null) {
  const normalizedCode = code?.trim().toUpperCase();
  return publicPlants.find((plant) => plant.code === normalizedCode);
}
