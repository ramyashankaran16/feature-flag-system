import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Snapshot } from '../types';
import { formatValue, humanize } from '../utils/format';

/** Side-by-side before/after view of an audit entry. Changed fields are highlighted. */
export default function AuditDiff({ before, after }: { before?: Snapshot | null; after?: Snapshot | null }) {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  if (!keys.length) {
    return <Typography variant="body2" color="text.secondary">No field-level details were recorded for this event.</Typography>;
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Field</TableCell>
            <TableCell>Before</TableCell>
            <TableCell>After</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((k) => {
            const b = before?.[k];
            const a = after?.[k];
            const changed = before && after && JSON.stringify(a) !== JSON.stringify(b);
            return (
              <TableRow key={k} sx={changed ? { bgcolor: 'rgba(178,107,0,0.07)' } : undefined}>
                <TableCell sx={{ fontWeight: changed ? 600 : 400, whiteSpace: 'nowrap' }}>{humanize(k)}</TableCell>
                <TableCell sx={{ color: 'text.secondary', textDecoration: changed ? 'line-through' : 'none' }}>
                  {before ? formatValue(b) : '—'}
                </TableCell>
                <TableCell sx={{ fontWeight: changed ? 600 : 400 }}>{after ? formatValue(a) : '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
