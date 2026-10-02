import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { evaluateApi } from '../../api/endpoints';
import EnvBadge from '../../components/EnvBadge';
import Mono from '../../components/Mono';
import Panel from '../../components/Panel';
import { monoFont, tokens } from '../../theme';
import type { Environment, EvaluateResult, Flag } from '../../types';
import { REASON_TEXT, humanize } from '../../utils/format';

export default function TestTab({ flag, envs }: { flag: Flag; envs: Environment[] }) {
  const [envKey, setEnvKey] = useState('');
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!envKey && envs.length) setEnvKey(envs[0].key); }, [envs, envKey]);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await evaluateApi.test({ flag_key: flag.key, environment_key: envKey, user_id: userId.trim() || undefined }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Panel title="Check a user">
        <Typography variant="body2" color="text.secondary" sx={{ mt: -1, mb: 2.5 }}>
          See exactly what your app would receive for a user. Test checks are not counted in analytics.
        </Typography>
        <Stack spacing={2}>
          <TextField select size="small" label="Environment" value={envKey} onChange={(e) => setEnvKey(e.target.value)}>
            {envs.map((e) => <MenuItem key={e.key} value={e.key}><EnvBadge name={e.name} envKey={e.key} isProtected={e.is_protected} /></MenuItem>)}
          </TextField>
          <TextField size="small" label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="customer-123"
            helperText="Leave empty to check without a user" InputProps={{ sx: { fontFamily: monoFont } }} />
          <Button variant="contained" onClick={run} disabled={busy || !envKey}>Check flag</Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Panel>

      <Panel title="Result">
        {!result ? (
          <Typography color="text.secondary">Choose an environment and run a check to see the result here.</Typography>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2,
              bgcolor: result.enabled ? tokens.signalSoft : tokens.paper, border: 1, borderColor: result.enabled ? tokens.signal : 'divider' }}>
              <Box sx={{ width: 44, height: 24, borderRadius: 12, bgcolor: result.enabled ? tokens.signal : tokens.off, position: 'relative', flexShrink: 0 }}>
                <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#fff', position: 'absolute', top: 3, left: result.enabled ? 23 : 3 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>{result.enabled ? 'Feature on' : 'Feature off'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  for {result.user_id ? <Mono>{result.user_id}</Mono> : 'an anonymous user'} in {result.environment}
                </Typography>
              </Box>
            </Box>
            <Typography variant="subtitle2" sx={{ mt: 2.5 }}>{humanize(result.reason)}</Typography>
            <Typography variant="body2" color="text.secondary">{REASON_TEXT[result.reason] ?? result.reason}</Typography>
            {result.bucket !== null && result.bucket !== undefined && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                This user is in bucket <strong>{result.bucket}</strong> of 0–99. They get the feature when the rollout percentage is above {result.bucket}.
              </Typography>
            )}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
