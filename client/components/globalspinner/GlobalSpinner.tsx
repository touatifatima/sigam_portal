// components/GlobalSpinner.tsx
import { Backdrop } from '@mui/material';
import { useLoading } from '@/components/globalspinner/LoadingContext';
import { BrandLoader } from '@/components/loading/BrandLoader';

export const GlobalSpinner = () => {
  const { isLoading } = useLoading();

  return (
    <Backdrop
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: '#ffffff',
        backdropFilter: 'none',
      }}
      open={isLoading}
    >
      <BrandLoader label="Chargement..." compact />
    </Backdrop>
  );
};
