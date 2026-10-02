import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { errorMessage } from '../api/client';
import { authApi } from '../api/endpoints';
import { useNotify } from '../context/NotifyContext';

export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useNotify();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      notify('Password changed');
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs">
      <DialogTitle>Change password</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
          <TextField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" helperText="At least 8 characters" />
          <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit">Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={busy || !current || !next}>Change password</Button>
      </DialogActions>
    </Dialog>
  );
}
