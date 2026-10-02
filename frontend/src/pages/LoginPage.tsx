import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert, Box, Button, IconButton, InputAdornment, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { envColor, tokens } from '../theme';

const DEMO_ROWS = [
  { name: 'Development', key: 'development', pct: 100 },
  { name: 'Testing', key: 'testing', pct: 50 },
  { name: 'Production', key: 'production', pct: 10 },
];

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'Admin@123', label: 'Admin' },
  { username: 'developer', password: 'Developer@123', label: 'Developer' },
  { username: 'viewer', password: 'Viewer@123', label: 'Viewer' },
];

/** The one animated moment: switches flip on one after another. */
function SwitchboardPreview() {
  const [on, setOn] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setOn(DEMO_ROWS.length); return; }
    const timers = DEMO_ROWS.map((_, i) => setTimeout(() => setOn(i + 1), 500 + i * 450));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, p: 2.5, maxWidth: 420 }} aria-hidden>
      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', mb: 1.5 }}>
        new-checkout-flow
      </Typography>
      {DEMO_ROWS.map((row, i) => {
        const active = i < on;
        const color = envColor(row.key);
        return (
          <Box key={row.key} sx={{ display: 'grid', gridTemplateColumns: '110px 50px 1fr 44px', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Typography sx={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>{row.name}</Typography>
            <Switch size="small" checked={active} readOnly tabIndex={-1}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: tokens.signal, opacity: 1 } }} />
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: active ? `${row.pct}%` : 0, bgcolor: color, transition: 'width 600ms ease' }} />
            </Box>
            <Typography sx={{ color: active ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}>
              {active ? `${row.pct}%` : 'Off'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/';
  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}>
      <Box sx={{ bgcolor: tokens.ink, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'center', px: { md: 6, lg: 10 }, py: 6 }}>
        <Typography component="p" sx={{ color: '#fff', fontWeight: 700, fontSize: { md: '2.4rem', lg: '2.9rem' }, lineHeight: 1.1, letterSpacing: '-0.025em', maxWidth: 520 }}>
          Release features without redeploying.
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 2, mb: 5, maxWidth: 460, fontSize: '1.05rem', lineHeight: 1.6 }}>
          Turn features on per environment, roll them out to a share of users, and switch them off in seconds if something goes wrong.
        </Typography>
        <SwitchboardPreview />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, sm: 6 } }}>
        <Box component="form" onSubmit={submit} sx={{ width: '100%', maxWidth: 380 }} noValidate>
          <Typography variant="h4" component="h1">Sign in to Switchboard</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>Use your username or email address.</Typography>
          <Stack spacing={2.25}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Username or email" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoFocus required fullWidth />
            <TextField label="Password" type={show ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShow((s) => !s)} edge="end" aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }} />
            <Button type="submit" variant="contained" size="large" disabled={busy || !username || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>

          <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>Demo accounts</Typography>
            <Stack direction="row" spacing={1}>
              {DEMO_ACCOUNTS.map((a) => (
                <Button key={a.username} size="small" variant="outlined" color="inherit"
                  onClick={() => { setUsername(a.username); setPassword(a.password); setError(''); }}>
                  {a.label}
                </Button>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
