import { Box, Paper, Typography, type PaperProps } from '@mui/material';
import type { ReactNode } from 'react';

interface PanelProps extends Omit<PaperProps, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  /** Remove inner padding so tables and toolbars can sit edge to edge. */
  flush?: boolean;
}

/** Bordered surface used for every content block. */
export default function Panel({ title, action, flush, children, sx, ...rest }: PanelProps) {
  return (
    <Paper variant="outlined" sx={[{ p: flush ? 0 : { xs: 2, md: 2.5 }, borderRadius: 2, overflow: flush ? 'hidden' : undefined }, ...(Array.isArray(sx) ? sx : [sx])]} {...rest}>
      {(title || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, ...(flush && { px: 2.5, pt: 2.5 }) }}>
          {typeof title === 'string' ? <Typography variant="h6">{title}</Typography> : title}
          {action}
        </Box>
      )}
      {children}
    </Paper>
  );
}
