import ClearIcon from '@mui/icons-material/Clear';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, List,
  ListItemButton, ListItemText, Menu, MenuItem, Slider, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { rolloutsApi } from '../../api/endpoints';
import ConfirmDialog from '../../components/ConfirmDialog';
import EnvBadge from '../../components/EnvBadge';
import Panel from '../../components/Panel';
import { useNotify } from '../../context/NotifyContext';
import { envColor } from '../../theme';
import type { AuditLog, Rollout, RolloutUpdate, Snapshot } from '../../types';
import { fmtDateTime, fromLocalInput, timeAgo, toLocalInput } from '../../utils/format';

const MARKS = [0, 10, 25, 50, 75, 100].map((v) => ({ value: v, label: `${v}%` }));

function audienceText(enabled: boolean, pct: number): string {
  if (!enabled) return 'Off for everyone in this environment, including users on the include list.';
  if (pct === 0) return 'Only users on the include list get this feature.';
  if (pct === 100) return 'Every user in this environment gets this feature.';
  return `About ${pct}% of users get this feature. Raising the percentage only adds users; nobody who has it loses it.`;
}

function snapshotSummary(s: Snapshot): string {
  const parts = [s.is_enabled ? `On, ${s.rollout_percentage}%` : 'Off'];
  if (s.scheduled_enable_at) parts.push(`turns on ${fmtDateTime(String(s.scheduled_enable_at))}`);
  if (s.scheduled_disable_at) parts.push(`turns off ${fmtDateTime(String(s.scheduled_disable_at))}`);
  return parts.join(', ');
}

interface VersionOption { version: number; snapshot: Snapshot; when: string | null }

function VersionDialog({ rollout, open, onClose, onRestore }: {
  rollout: Rollout; open: boolean; onClose: () => void; onRestore: (version: number) => Promise<void>;
}) {
  const [entries, setEntries] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    rolloutsApi.history(rollout.id, 1, 100).then((p) => setEntries(p.items)).catch((e) => setError(errorMessage(e)));
  }, [open, rollout.id]);

  const versions = useMemo<VersionOption[]>(() => {
    const map = new Map<number, VersionOption>();
    for (const e of entries ?? []) {
      if (e.new_value?.version !== undefined) map.set(Number(e.new_value.version), { version: Number(e.new_value.version), snapshot: e.new_value, when: e.created_at });
      if (e.old_value?.version !== undefined && !map.has(Number(e.old_value.version))) {
        map.set(Number(e.old_value.version), { version: Number(e.old_value.version), snapshot: e.old_value, when: null });
      }
    }
    return [...map.values()].filter((v) => v.version < rollout.version).sort((a, b) => b.version - a.version);
  }, [entries, rollout.version]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Restore an earlier version</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {rollout.environment_name} is on version {rollout.version}. Restoring saves the old settings as a new version, so nothing is lost.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {entries && versions.length === 0 && <Typography color="text.secondary">There are no earlier versions yet.</Typography>}
        <List dense disablePadding>
          {versions.map((v) => (
            <ListItemButton key={v.version} onClick={() => onRestore(v.version)} sx={{ borderRadius: 1 }}>
              <ListItemText
                primary={`Version ${v.version}: ${snapshotSummary(v.snapshot)}`}
                secondary={v.when ? `Saved ${fmtDateTime(v.when)}` : 'Original settings'}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} color="inherit">Cancel</Button></DialogActions>
    </Dialog>
  );
}

interface Props {
  rollout: Rollout;
  canEdit: boolean;
  archived: boolean;
  onChange: (r: Rollout) => void;
}

export default function RolloutPanel({ rollout: r, canEdit, archived, onChange }: Props) {
  const notify = useNotify();
  const [pct, setPct] = useState(r.rollout_percentage);
  const [enableAt, setEnableAt] = useState(toLocalInput(r.scheduled_enable_at));
  const [disableAt, setDisableAt] = useState(toLocalInput(r.scheduled_disable_at));
  const [busy, setBusy] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);

  useEffect(() => {
    setPct(r.rollout_percentage);
    setEnableAt(toLocalInput(r.scheduled_enable_at));
    setDisableAt(toLocalInput(r.scheduled_disable_at));
  }, [r]);

  const editable = canEdit && !archived;
  const dirty = pct !== r.rollout_percentage
    || enableAt !== toLocalInput(r.scheduled_enable_at)
    || disableAt !== toLocalInput(r.scheduled_disable_at);

  const run = async (fn: () => Promise<Rollout>, message: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      onChange(updated);
      notify(message);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => run(() => rolloutsApi.toggle(r.id), `Turned ${r.is_enabled ? 'off' : 'on'} in ${r.environment_name}`);

  const save = () => {
    const body: RolloutUpdate = {};
    if (pct !== r.rollout_percentage) body.rollout_percentage = pct;
    if (enableAt !== toLocalInput(r.scheduled_enable_at)) body.scheduled_enable_at = fromLocalInput(enableAt);
    if (disableAt !== toLocalInput(r.scheduled_disable_at)) body.scheduled_disable_at = fromLocalInput(disableAt);
    return run(() => rolloutsApi.update(r.id, body), `Saved ${r.environment_name} settings`);
  };

  const undo = () => { setMenuEl(null); run(() => rolloutsApi.rollback(r.id), `Undid the last change in ${r.environment_name}`); };

  const restore = async (version: number) => {
    setVersionsOpen(false);
    await run(() => rolloutsApi.rollback(r.id, { to_version: version }), `Restored version ${version} in ${r.environment_name}`);
  };

  const color = envColor(r.environment_key);
  const dateField = (label: string, value: string, set: (v: string) => void, help: string) => (
    <TextField
      type="datetime-local" size="small" label={label} value={value} onChange={(e) => set(e.target.value)}
      disabled={!editable} InputLabelProps={{ shrink: true }} helperText={help} sx={{ flex: '1 1 220px' }}
      InputProps={{
        endAdornment: value && editable ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => set('')} aria-label={`Clear ${label.toLowerCase()}`}><ClearIcon fontSize="small" /></IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );

  return (
    <Panel sx={{ borderTop: `3px solid ${color}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <EnvBadge name={r.environment_name} envKey={r.environment_key} isProtected={r.environment_is_protected} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Version {r.version}, changed {timeAgo(r.updated_at)}{r.updated_by_username ? ` by ${r.updated_by_username}` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{r.is_enabled ? 'On' : 'Off'}</Typography>
          <Switch checked={r.is_enabled} disabled={!editable || busy}
            onChange={() => (r.environment_is_protected ? setConfirmToggle(true) : toggle())}
            inputProps={{ 'aria-label': `Turn ${r.environment_name} ${r.is_enabled ? 'off' : 'on'}` }} />
        </Box>
      </Box>

      {!canEdit && !archived && (
        <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
          {r.environment_is_protected ? 'Only Admins can change this environment.' : 'You have read-only access.'}
        </Alert>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2">Rollout percentage</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, px: 1 }}>
          <Slider value={pct} onChange={(_, v) => setPct(v as number)} min={0} max={100} step={1} marks={MARKS}
            disabled={!editable} valueLabelDisplay="auto" aria-label="Rollout percentage"
            sx={{ color, '& .MuiSlider-markLabel': { fontSize: '0.72rem' } }} />
          <TextField size="small" type="number" value={pct} disabled={!editable}
            onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            inputProps={{ min: 0, max: 100, 'aria-label': 'Rollout percentage value' }}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            sx={{ width: 100, flexShrink: 0 }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{audienceText(r.is_enabled, pct)}</Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Schedule</Typography>
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
          {dateField('Turn on at', enableAt, setEnableAt, 'Leave empty for no automatic start')}
          {dateField('Turn off at', disableAt, setDisableAt, 'Leave empty for no automatic end')}
        </Stack>
        <Typography variant="caption" color="text.secondary">Times are in your local timezone. The scheduler checks every 30 seconds.</Typography>
      </Box>

      {editable && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title={r.version > 1 ? '' : 'No earlier versions yet'}>
            <span>
              <Button startIcon={<RestoreIcon />} color="inherit" disabled={busy || r.version <= 1} onClick={(e) => setMenuEl(e.currentTarget)}>
                Roll back
              </Button>
            </span>
          </Tooltip>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            <MenuItem onClick={undo}>Undo the last change</MenuItem>
            <MenuItem onClick={() => { setMenuEl(null); setVersionsOpen(true); }}>Restore an earlier version…</MenuItem>
          </Menu>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button color="inherit" disabled={!dirty || busy} onClick={() => {
              setPct(r.rollout_percentage); setEnableAt(toLocalInput(r.scheduled_enable_at)); setDisableAt(toLocalInput(r.scheduled_disable_at));
            }}>Discard</Button>
            <Button variant="contained" disabled={!dirty || busy} onClick={save}>Save changes</Button>
          </Box>
        </Box>
      )}

      <ConfirmDialog
        open={confirmToggle}
        title={`Turn ${r.is_enabled ? 'off' : 'on'} in ${r.environment_name}?`}
        message={`This changes what real users see for "${r.flag_key}" right away.`}
        confirmLabel={r.is_enabled ? 'Turn off' : 'Turn on'}
        danger={r.is_enabled}
        onConfirm={toggle}
        onClose={() => setConfirmToggle(false)}
      />
      <VersionDialog rollout={r} open={versionsOpen} onClose={() => setVersionsOpen(false)} onRestore={restore} />
    </Panel>
  );
}
