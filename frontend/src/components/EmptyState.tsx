import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export default function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="h6">{title}</Typography>
      {text && <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 440, mx: 'auto' }}>{text}</Typography>}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
