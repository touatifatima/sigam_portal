import { useEffect, useState } from 'react';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import {
  getSessionBackedItem,
  setSessionBackedItem,
} from '@/src/utils/sessionBackedStorage';

export const useDemandeInfo = () => {
  const searchParams = useSearchParams();
  const [code, setCode] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const queryCode = searchParams?.get('code');
    const queryId = searchParams?.get('id');

    const storedCode = getSessionBackedItem('code_demande');
    const storedId = getSessionBackedItem('id_demande');

    const finalCode = queryCode || storedCode;
    const finalId = queryId || storedId;

    if (finalCode) setSessionBackedItem('code_demande', finalCode);
    if (finalId) setSessionBackedItem('id_demande', finalId);

    setCode(finalCode ?? null);
    setId(finalId ?? null);
    setIsReady(true);
  }, [searchParams]);

  return { codeDemande: code, idDemande: id, isReady };
};
