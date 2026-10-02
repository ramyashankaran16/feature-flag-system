import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Skeleton,
  Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { API_BASE, errorMessage } from '../api/client';
import { envApi } from '../api/endpoints';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyButton from '../components/CopyButton';
import EnvBadge from '../components/EnvBadge';
import Mono from '../components/Mono';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotifyContext';
import { envColor, monoFont, tokens } from '../theme';
import type { Environment } from '../types';
import { fmtDateTime } from '../utils/format';

function EnvDialog({ open, env, onClose, onSaved }: { open: boolean; env: Environment | null; onClose: () => void; onSaved: (e: Environment) => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(env?.name ?? ''); setKey(env?.key ?? ''); setDescription(env?.description ?? '');
    setIsProtected(env?.is_protected ?? false); setError('');
  }, [open, env]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = env
        ? await envApi.update(env.id, { name, description: description || null, is_protected: isProtected })
        : await envApi.create({ name, key, description: description || undefined, is_protected: isProtected });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{env ? 'Edit environment' : 'Add environment'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Staging" />
          <TextField label="Key" value={key} disabled={!!env} onChange={(e) => setKey(e.target.value.toLowerCase())}
            helperText={env ? 'The key cannot change.' : 'Lowercase, used in URLs and reports, e.g. staging'}
            InputProps={{ sx: { fontFamily: monoFont } }} />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <FormControlLabel
            control={<Switch checked={isProtected} onChange={(e) => setIsProtected(e.target.checked)} />}
            label={<Box><Typography>Protected</Typography><Typography variant="body2" color="text.secondary">Only Admins can change flags here. Use this for production.</Typography></Box>}
          />
          {!env && <Alert severity="info" variant="outlined">Every existing flag is added to the new environment, switched off.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || name.length < 2 || key.length < 2}>{env ? 'Save changes' : 'Add environment'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ApiKeyField({ value, canReveal }: { value: string; canReveal: boolean }) {
  const [show, setShow] = useState(false);
  const display = !canReveal || show ? value : value.slice(0, 12) + '•'.repeat(16);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: tokens.paper, borderRadius: 1, pl: 1.25, pr: 0.5, py: 0.5, border: 1, borderColor: 'divider' }}>
      <Mono sx={{ flex: 1, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</Mono>
      {canReveal && (
        <>
          <Tooltip title={show ? 'Hide key' : 'Show key'}>
            <IconButton size="small" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide API key' : 'Show API key'}>
              {show ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
            </IconButton>
          </Tooltip>
          <CopyButton text={value} label="Copy API key" />
        </>
      )}
    </Box>
  );
}

export default function EnvironmentsPage() {
  const { isAdmin } = useAuth();
  const notify = useNotify();
  const [envs, setEnvs] = useState<Environment[] | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; env: Environment | null }>({ open: false, env: null });
  const [confirm, setConfirm] = useState<{ type: 'rotate' | 'delete'; env: Environment } | null>(null);

  const load = () => envApi.list().then(setEnvs).catch((e) => notify(errorMessage(e), 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = window.location.origin;
  const sample = envs?.[0];

  return (
    <>
      <PageHeader
        title="Environments"
        description="Each environment has its own flag settings and its own API key. Your apps send the key to get that environment's settings."
        actions={isAdmin && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, env: null })}>Add environment</Button>}
      />

      {!envs ? <Skeleton variant="rounded" height={260} /> : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' } }}>
          {envs.map((env) => (
            <Panel key={env.id} sx={{ borderTop: `3px solid ${envColor(env.key)}`, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <EnvBadge name={env.name} envKey={env.key} isProtected={env.is_protected} />
                  <Mono sx={{ display: 'block', mt: 0.5 }}>{env.key}</Mono>
                </Box>
                {isAdmin && (
                  <Box>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => setDialog({ open: true, env })} aria-label={`Edit ${env.name}`}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => setConfirm({ type: 'delete', env })} aria-label={`Delete ${env.name}`}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, flex: 1 }}>
                {env.description || 'No description.'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}>API key</Typography>
              <ApiKeyField value={env.api_key ?? ''} canReveal={isAdmin} />
              {!isAdmin && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>Only Admins can see full API keys.</Typography>}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Typography variant="caption" color="text.secondary">Updated {fmtDateTime(env.updated_at)}</Typography>
                {isAdmin && (
                  <Button size="small" startIcon={<AutorenewIcon />} color="inherit" onClick={() => setConfirm({ type: 'rotate', env })}>Rotate key</Button>
                )}
              </Box>
            </Panel>
          ))}
        </Box>
      )}

      {sample && (
        <Panel title="Connect an app" sx={{ mt: 2.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Send the environment's API key in the <Mono>X-Environment-Key</Mono> header. The response tells your app whether to show the feature.
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 2, bgcolor: tokens.ink, color: '#E6EDF3', borderRadius: 1.5, overflowX: 'auto', fontFamily: monoFont, fontSize: '0.8rem', lineHeight: 1.7 }}>
{`curl -X POST ${origin}${API_BASE}/evaluate \\
  -H "X-Environment-Key: <${sample.key} API key>" \\
  -H "Content-Type: application/json" \\
  -d '{"flag_key": "new-checkout-flow", "user_id": "customer-123"}'

# {"flag_key": "new-checkout-flow", "enabled": true, "reason": "ROLLOUT_INCLUDED", ...}`}
          </Box>
        </Panel>
      )}

      <EnvDialog open={dialog.open} env={dialog.env} onClose={() => setDialog({ open: false, env: null })}
        onSaved={() => { setDialog({ open: false, env: null }); notify('Environment saved'); load(); }} />
      <ConfirmDialog
        open={confirm?.type === 'rotate'}
        title={`Rotate the ${confirm?.env.name} API key?`}
        message="The current key stops working immediately. Apps using it will get errors until you update them with the new key."
        confirmLabel="Rotate key"
        danger
        onConfirm={async () => {
          try { await envApi.regenerateKey(confirm!.env.id); notify('API key rotated'); load(); } catch (e) { notify(errorMessage(e), 'error'); }
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        title={`Delete ${confirm?.env.name}?`}
        message="All flag settings and user overrides for this environment are removed, and its API key stops working. The audit log keeps the history."
        confirmLabel="Delete environment"
        danger
        onConfirm={async () => {
          try { await envApi.remove(confirm!.env.id); notify('Environment deleted'); load(); } catch (e) { notify(errorMessage(e), 'error'); }
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
