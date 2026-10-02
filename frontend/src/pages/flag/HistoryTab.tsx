import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Pagination, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { flagsApi } from '../../api/endpoints';
import ActionChip from '../../components/ActionChip';
import AuditDiff from '../../components/AuditDiff';
import EmptyState from '../../components/EmptyState';
import { useNotify } from '../../context/NotifyContext';
import type { AuditLog, Page } from '../../types';
import { fmtDateTime } from '../../utils/format';

export default function HistoryTab({ flagId, refreshKey }: { flagId: number; refreshKey: number }) {
  const notify = useNotify();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AuditLog> | null>(null);

  useEffect(() => {
    flagsApi.history(flagId, page, 20).then(setData).catch((e) => notify(errorMessage(e), 'error'));
  }, [flagId, page, refreshKey, notify]);

  if (!data) return <Skeleton variant="rounded" height={300} />;
  if (!data.items.length) return <EmptyState title="No changes recorded yet" />;

  return (
    <Box>
      <Stack spacing={1}>
        {data.items.map((a) => (
          <Accordion key={a.id} disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', width: '100%', pr: 1 }}>
                <Box sx={{ width: 170, flexShrink: 0 }}><ActionChip action={a.action} /></Box>
                <Typography variant="body2" sx={{ flex: '1 1 260px' }}>{a.description}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {a.username}, {fmtDateTime(a.created_at)}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <AuditDiff before={a.old_value} after={a.new_value} />
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
      {data.pages > 1 && (
        <Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} sx={{ mt: 2, display: 'flex', justifyContent: 'center' }} />
      )}
    </Box>
  );
}
