import ScheduleIcon from '@mui/icons-material/Schedule';
import { Box, Switch, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { errorMessage } from '../api/client';
import { rolloutsApi } from '../api/endpoints';
import { useNotify } from '../context/NotifyContext';
import { envColor, tokens } from '../theme';
import type { Rollout } from '../types';
import { fmtDateTime } from '../utils/format';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  rollout: Rollout;
  canEdit: boolean;
  onChange: (updated: Rollout) => void;
}

/**
 * One cell of the switchboard: live on/off switch plus a bar showing
 * how much of the audience gets the feature in this environment.
 */
export default function RolloutCell({ rollout: r, canEdit, onChange }: Props) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const color = envColor(r.environment_key);
  const served = r.is_enabled ? r.rollout_percentage : 0;

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await rolloutsApi.toggle(r.id);
      onChange(updated);
      notify(`${updated.flag_key} turned ${updated.is_enabled ? 'on' : 'off'} in ${updated.environment_name}`);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = () => (r.environment_is_protected ? setConfirm(true) : toggle());

  const scheduled = r.scheduled_enable_at || r.scheduled_disable_at;
  const scheduleText = [
    r.scheduled_enable_at && `Turns on ${fmtDateTime(r.scheduled_enable_at)}`,
    r.scheduled_disable_at && `Turns off ${fmtDateTime(r.scheduled_disable_at)}`,
  ].filter(Boolean).join('. ');

  const switchEl = (
    <Switch
      size="small"
      checked={r.is_enabled}
      disabled={!canEdit || busy}
      onClick={(e) => e.stopPropagation()}
      onChange={onSwitch}
      inputProps={{ 'aria-label': `${r.environment_name}: ${r.is_enabled ? 'on' : 'off'}` }}
    />
  );

  return (
    <Box sx={{ minWidth: 112 }} onClick={(e) => e.stopPropagation()}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {canEdit ? switchEl : (
          <Tooltip title={r.environment_is_protected ? 'Only Admins can change this environment' : 'Read-only access'}>
            <span>{switchEl}</span>
          </Tooltip>
        )}
        <Typography variant="body2" sx={{ fontWeight: 600, color: r.is_enabled ? 'text.primary' : 'text.secondary', minWidth: 34 }}>
          {r.is_enabled ? `${r.rollout_percentage}%` : 'Off'}
        </Typography>
        {scheduled && (
          <Tooltip title={scheduleText}>
            <ScheduleIcon sx={{ fontSize: 16, color: tokens.muted }} aria-label={scheduleText} />
          </Tooltip>
        )}
      </Box>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: tokens.line, overflow: 'hidden', mt: 0.5, mr: 1 }}>
        <Box sx={{ height: '100%', width: `${served}%`, bgcolor: color, transition: 'width 300ms ease' }} />
      </Box>

      <ConfirmDialog
        open={confirm}
        title={`Turn ${r.is_enabled ? 'off' : 'on'} in ${r.environment_name}?`}
        message={`This changes what real users see for "${r.flag_key}" right away.`}
        confirmLabel={r.is_enabled ? 'Turn off' : 'Turn on'}
        danger={r.is_enabled}
        onConfirm={toggle}
        onClose={() => setConfirm(false)}
      />
    </Box>
  );
}
