import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert, Box, Button, InputAdornment, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { envApi, flagsApi } from '../api/endpoints';
import EmptyState from '../components/EmptyState';
import EnvBadge from '../components/EnvBadge';
import FlagFormDialog from '../components/FlagFormDialog';
import Mono from '../components/Mono';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import RolloutCell from '../components/RolloutCell';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotifyContext';
import { useDebounce } from '../hooks/useDebounce';
import type { Environment, Flag, Page, Rollout } from '../types';
import { timeAgo } from '../utils/format';

export default function FlagsPage() {
  const { canEdit, canEditEnv } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const compact = useMediaQuery(useTheme().breakpoints.down('md'));

  const [envs, setEnvs] = useState<Environment[]>([]);
  const [data, setData] = useState<Page<Flag> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    envApi.list().then(setEnvs).catch((e) => notify(errorMessage(e), 'error'));
  }, [notify]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await flagsApi.list({ q: dq || undefined, archived, page: page + 1, size }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [dq, archived, page, size]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, archived]);

  const replaceRollout = (updated: Rollout) => {
    setData((d) => d && {
      ...d,
      items: d.items.map((f) => f.id !== updated.flag_id ? f
        : { ...f, rollouts: f.rollouts.map((r) => (r.id === updated.id ? updated : r)) }),
    });
  };

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Switch features on or off per environment. Changes reach your apps within seconds, with no redeploy."
        actions={canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Create flag</Button>
        )}
      />

      <Panel flush>
        <Box sx={{ display: 'flex', gap: 1.5, p: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small" placeholder="Search by name, key or description" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: '1 1 260px', maxWidth: 420 }}
            inputProps={{ 'aria-label': 'Search flags' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <ToggleButtonGroup size="small" exclusive value={archived ? 'archived' : 'active'}
            onChange={(_, v) => v && setArchived(v === 'archived')} aria-label="Flag status">
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="archived">Archived</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {loading && <LinearProgress sx={{ height: 2 }} />}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title={dq ? 'No flags match your search' : archived ? 'No archived flags' : 'No flags yet'}
            text={dq ? 'Try a different name or key.' : archived ? 'Flags you archive will appear here.' : 'Create a flag, then wrap the new feature in your code with a check for its key.'}
            action={!dq && !archived && canEdit && <Button variant="contained" onClick={() => setCreateOpen(true)}>Create flag</Button>}
          />
        ) : compact ? (
          <Box>
            {items.map((flag) => (
              <Box key={flag.id} onClick={() => navigate(`/flags/${flag.id}`)} role="link" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/flags/${flag.id}`)}
                sx={{ p: 2, borderBottom: 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                <Typography sx={{ fontWeight: 600 }}>{flag.name}</Typography>
                <Mono>{flag.key}</Mono>
                <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 1, alignItems: 'center' }}>
                  {envs.map((env) => {
                    const r = flag.rollouts.find((x) => x.environment_id === env.id);
                    return [
                      <EnvBadge key={`${env.id}-n`} name={env.name} envKey={env.key} isProtected={env.is_protected} dense />,
                      <Box key={`${env.id}-c`}>{r && <RolloutCell rollout={r} canEdit={!flag.is_archived && canEditEnv(env.is_protected)} onChange={replaceRollout} />}</Box>,
                    ];
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '32%' }}>Flag</TableCell>
                  {envs.map((env) => (
                    <TableCell key={env.id}>
                      <EnvBadge name={env.name} envKey={env.key} isProtected={env.is_protected} dense />
                    </TableCell>
                  ))}
                  <TableCell align="right">Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((flag) => (
                  <TableRow key={flag.id} hover onClick={() => navigate(`/flags/${flag.id}`)}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                    tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/flags/${flag.id}`)}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{flag.name}</Typography>
                      <Mono>{flag.key}</Mono>
                      {flag.description && (
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 360, mt: 0.25 }}>{flag.description}</Typography>
                      )}
                    </TableCell>
                    {envs.map((env) => {
                      const r = flag.rollouts.find((x) => x.environment_id === env.id);
                      return (
                        <TableCell key={env.id}>
                          {r ? <RolloutCell rollout={r} canEdit={!flag.is_archived && canEditEnv(env.is_protected)} onChange={replaceRollout} />
                            : <Typography variant="body2" color="text.secondary">Not set</Typography>}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" color="text.secondary">{timeAgo(flag.updated_at)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {data && data.total > 0 && (
          <TablePagination
            component="div" count={data.total} page={page} rowsPerPage={size}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        )}
      </Panel>

      <FlagFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(flag) => { setCreateOpen(false); notify(`Flag "${flag.key}" created`); navigate(`/flags/${flag.id}`); }}
      />
    </>
  );
}
