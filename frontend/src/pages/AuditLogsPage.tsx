import SearchIcon from '@mui/icons-material/Search';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, LinearProgress, MenuItem, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { auditApi } from '../api/endpoints';
import ActionChip from '../components/ActionChip';
import AuditDiff from '../components/AuditDiff';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { useNotify } from '../context/NotifyContext';
import { useDebounce } from '../hooks/useDebounce';
import type { AuditLog, Page } from '../types';
import { fmtDateTime, fromLocalInput, humanize } from '../utils/format';

const ENTITY_TYPES = ['flag', 'rollout', 'environment', 'assignment', 'user'];

export default function AuditLogsPage() {
  const notify = useNotify();
  const [actions, setActions] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [data, setData] = useState<Page<AuditLog> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  useEffect(() => { auditApi.actions().then(setActions).catch(() => undefined); }, []);
  useEffect(() => { setPage(0); }, [dq, action, entity, from, to]);

  useEffect(() => {
    setLoading(true);
    auditApi.list({
      q: dq || undefined, action: action || undefined, entity_type: entity || undefined,
      date_from: fromLocalInput(from) ?? undefined, date_to: fromLocalInput(to) ?? undefined,
      page: page + 1, size,
    })
      .then(setData)
      .catch((e) => notify(errorMessage(e), 'error'))
      .finally(() => setLoading(false));
  }, [dq, action, entity, from, to, page, size, notify]);

  const hasFilters = q || action || entity || from || to;
  const clear = () => { setQ(''); setAction(''); setEntity(''); setFrom(''); setTo(''); };

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in Switchboard: who made it, when, and what it changed." />
      <Panel flush>
        <Box sx={{ display: 'flex', gap: 1.5, p: 2, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search descriptions or users" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: '1 1 240px' }} inputProps={{ 'aria-label': 'Search audit log' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
          <TextField select size="small" label="Action" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All actions</MenuItem>
            {actions.map((a) => <MenuItem key={a} value={a}>{humanize(a)}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Type" value={entity} onChange={(e) => setEntity(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All types</MenuItem>
            {ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{humanize(t)}</MenuItem>)}
          </TextField>
          <TextField type="datetime-local" size="small" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="datetime-local" size="small" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          {hasFilters && <Button onClick={clear} color="inherit">Clear filters</Button>}
        </Box>
        {loading && <LinearProgress sx={{ height: 2 }} />}
        {data && data.items.length === 0 ? (
          <EmptyState title="No matching events" text={hasFilters ? 'Try removing some filters.' : 'Changes will appear here as people use Switchboard.'} />
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Who</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>IP address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.map((a) => (
                  <TableRow key={a.id} hover onClick={() => setSelected(a)} sx={{ cursor: 'pointer' }}
                    tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(a)}>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{fmtDateTime(a.created_at)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{a.username || 'system'}</TableCell>
                    <TableCell><ActionChip action={a.action} /></TableCell>
                    <TableCell sx={{ maxWidth: 420 }}><Typography variant="body2" noWrap>{a.description || humanize(a.entity_type)}</Typography></TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{a.ip_address || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data && data.total > 0 && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]} />
        )}
      </Panel>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md">
        {selected && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ActionChip action={selected.action} />
              <Typography component="span" variant="h6">Event #{selected.id}</Typography>
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 1 }}>{selected.description}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {selected.username || 'system'} on {fmtDateTime(selected.created_at)}
                {selected.ip_address ? ` from ${selected.ip_address}` : ''}
              </Typography>
              <AuditDiff before={selected.old_value} after={selected.new_value} />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
