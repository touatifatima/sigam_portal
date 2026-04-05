import { getSessionBackedItem, removeSessionBackedItem } from '@/src/utils/sessionBackedStorage';

const NEW_DEMANDE_TRANSIENT_KEYS = [
  'id_demande',
  'id_proc',
  'code_demande',
  'selected_permis',
  'permis_details',
];

const LEGACY_LOCAL_KEYS = ['id_detenteur', 'societe_data', 'capacites_form'];

export function cleanLocalStorageForNewDemande() {
  const previousId = getSessionBackedItem('id_demande');
  const previousCode = getSessionBackedItem('code_demande');

  NEW_DEMANDE_TRANSIENT_KEYS.forEach((key) => {
    removeSessionBackedItem(key);
  });

  if (typeof window === 'undefined' || (!previousId && !previousCode)) {
    return;
  }

  LEGACY_LOCAL_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
