import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { assignmentsApi } from '../../api/endpoints';
import EmptyState from '../../components/EmptyState';
import EnvBadge from '../../components/EnvBadge';
import Panel from '../../components/Panel';
import { useAuth } from '../../context/AuthContext';
import { useNotify } from '../../context/NotifyContext';
import { monoFont } from '../../theme';
import type { Assignment, Environment, Flag } from '../../types';
import { timeAgo } from '../../utils/format';

export default function TargetingTab({ flag, envs }: { flag: Flag; envs: Environment[] }) {
  const { canEditEnv } = useAuth();
  const notify = useNotify();
  const [envId, setEnvId] = useState<number | ''>('');
  const [items, setItems] = useState<Assignment[]>([]);
  const [userId, setUserId] = useState('');
  const [include, setInclude] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => { if (envId === '' && envs.length) setEnvId(envs[0].id); }, [envs, envId]);

  const env = envs.find((e) => e.id === envId);
  const rollout = flag.rollouts.find((r) => r.environment_id === envId);
  const editable = !!env && canEditEnv(env.is_protected) && !flag.is_archived;

  const load = useCallback(async () => {
    if (envId === '') return;
    try {
      const page = await assignmentsApi.list(flag.id, { environment_id: envId, size: 200 });
      setItems(page.items);
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  }, [flag.id, envId, notify]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (envId === '' || !userId.trim()) return;
    setBusy(true);
    try {
      await assignmentsApi.create(flag.id, { environment_id: envId, user_identifier: userId.trim(), is_enabled: include, note: note.trim() || undefined });
      notify(`${include ? 'Included' : 'Excluded'} ${userId.trim()}`);
      setUserId('');
      setNote('');
      load();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    const ids = bulkText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (envId === '' || !ids.length) return;
    setBusy(true);
    try {
      const res = await assignmentsApi.bulk(flag.id, { environment_id: envId, user_identifiers: ids, is_enabled: include, note: note.trim() || undefined });
      notify(res.message);
      setBulkOpen(false);
      setBulkText('');
      load();
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Assignment) => {
    try {
      await assignmentsApi.remove(a.id);
      notify(`Removed ${a.user_identifier}`);
      setItems((list) => list.filter((x) => x.id !== a.id));
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  return (
    <Stack spacing={2.5}>
      <Panel>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <TextField select size="small" label="Environment" value={envId} onChange={(e) => setEnvId(Number(e.target.value))} sx={{ minWidth: 220 }}>
            {envs.map((e) => (
              <MenuItem key={e.id} value={e.id}><EnvBadge name={e.name} envKey={e.key} isProtected={e.is_protected} /></MenuItem>
            ))}
          </TextField>
          {rollout && (
            <Typography variant="body2" color="text.secondary">
              In this environment the flag is <strong>{rollout.is_enabled ? `on at ${rollout.rollout_percentage}%` : 'off'}</strong>.
            </Typography>
          )}
        </Box>
        {rollout && !rollout.is_enabled && (
          <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
            User overrides only apply while the flag is on. Turn it on with a 0% rollout to limit the feature to the users below.
          </Alert>
        )}
      </Panel>

      {editable && (
        <Panel title="Add a user">
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <TextField size="small" label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="customer-123 or email"
              helperText="The ID your app sends when it checks the flag" sx={{ flex: '1 1 240px' }}
              InputProps={{ sx: { fontFamily: monoFont } }} />
            <ToggleButtonGroup size="small" exclusive value={include ? 'include' : 'exclude'} onChange={(_, v) => v && setInclude(v === 'include')} aria-label="Access">
              <ToggleButton value="include" sx={{ px: 2 }}>Always on</ToggleButton>
              <ToggleButton value="exclude" sx={{ px: 2 }}>Always off</ToggleButton>
            </ToggleButtonGroup>
            <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: '1 1 180px' }} />
            <Button variant="contained" onClick={add} disabled={busy || !userId.trim()} sx={{ height: 40 }}>Add user</Button>
            <Button onClick={() => setBulkOpen(true)} color="inherit" sx={{ height: 40 }}>Add many</Button>
          </Box>
        </Panel>
      )}

      <Panel flush title={`User overrides (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState title="No user overrides" text="Add users who should always or never get this feature, such as beta testers or internal staff." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 2.5 }}>User ID</TableCell>
                  <TableCell>Access</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Added</TableCell>
                  {editable && <TableCell align="right" sx={{ pr: 2.5 }} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell sx={{ pl: 2.5, fontFamily: monoFont, fontSize: '0.85rem' }}>{a.user_identifier}</TableCell>
                    <TableCell>
                      <Chip size="small" label={a.is_enabled ? 'Always on' : 'Always off'} color={a.is_enabled ? 'success' : 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{a.note || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {timeAgo(a.created_at)}{a.created_by_username ? ` by ${a.created_by_username}` : ''}
                    </TableCell>
                    {editable && (
                      <TableCell align="right" sx={{ pr: 2.5 }}>
                        <Tooltip title="Remove override">
                          <IconButton size="small" onClick={() => remove(a)} aria-label={`Remove ${a.user_identifier}`}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)}>
        <DialogTitle>Add many users</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste user IDs separated by commas, spaces or new lines. They will be set to <strong>{include ? 'always on' : 'always off'}</strong> in {env?.name}.
          </Typography>
          <TextField multiline minRows={6} fullWidth value={bulkText} onChange={(e) => setBulkText(e.target.value)}
            placeholder={'alice\nbob\ncarol@company.com'} InputProps={{ sx: { fontFamily: monoFont, fontSize: '0.85rem' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={addBulk} disabled={busy || !bulkText.trim()}>Add users</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
