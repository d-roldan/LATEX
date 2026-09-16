export interface PublicPlant {
  code: 'LATEX' | 'TERPLAST' | 'SLURRY' | 'ENDUIDO';
  name: string;
}

export const publicPlants: PublicPlant[] = [
  { code: 'LATEX', name: 'Látex' },
  { code: 'TERPLAST', name: 'Terplast' },
  { code: 'SLURRY', name: 'Slurry' },
  { code: 'ENDUIDO', name: 'Enduido' }
];

export function findPublicPlant(code: string | null) {
  const normalizedCode = code?.trim().toUpperCase();
  return publicPlants.find((plant) => plant.code === normalizedCode);
}
