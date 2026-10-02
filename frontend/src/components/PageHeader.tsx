import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}

export default function PageHeader({ title, description, actions, back }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      {back}
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'flex-end' }, justifyContent: 'space-between',
        gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">{title}</Typography>
          {description && (
            <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 680 }}>{description}</Typography>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
