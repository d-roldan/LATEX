import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../shared/api/http';

export interface AuthorizedPlant { id: string; code: string; name: string; displayOrder: number; finalOperation: 'PACKAGING' | 'TRANSFER' }

export function useActivePlant({ enabled = true }: { enabled?: boolean } = {}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const plants = useQuery({ queryKey: ['authorized-plants'], queryFn: () => api.get<AuthorizedPlant[]>('/plants').then(r => r.data), staleTime: 60_000, enabled });
  const requested = params.get('plant')?.toUpperCase();
  const active = useMemo(() => plants.data?.find(p => p.code === requested) ?? plants.data?.find(p => p.code === localStorage.getItem('disal.activePlant')) ?? plants.data?.[0], [plants.data, requested]);

  useEffect(() => {
    if (!active) return;
    localStorage.setItem('disal.activePlant', active.code);
    if (requested !== active.code) {
      const next = new URLSearchParams(params); next.set('plant', active.code);
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    }
  }, [active, requested, location.pathname]);

  const select = async (code: string) => {
    await client.cancelQueries({ predicate: q => String(q.queryKey[0]).startsWith('plant-') });
    client.removeQueries({ predicate: q => String(q.queryKey[0]).startsWith('plant-') });
    const next = new URLSearchParams(params); next.set('plant', code);
    navigate({ pathname: location.pathname, search: next.toString() });
  };
  return { plants: plants.data ?? [], active, select, isLoading: plants.isLoading };
}
