import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { flagsApi } from '../api/endpoints';
import { monoFont } from '../theme';
import type { Flag } from '../types';
import { slugify } from '../utils/format';

interface Props {
  open: boolean;
  flag?: Flag | null; // when set, the dialog edits instead of creating
  onClose: () => void;
  onSaved: (flag: Flag) => void;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*$/;

export default function FlagFormDialog({ open, flag, onClose, onSaved }: Props) {
  const editing = !!flag;
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(flag?.name ?? '');
    setKey(flag?.key ?? '');
    setDescription(flag?.description ?? '');
    setKeyTouched(false);
    setError('');
  }, [open, flag]);

  const keyError = key && !KEY_PATTERN.test(key)
    ? 'Use lowercase letters, numbers, dots, dashes or underscores, starting with a letter or number.' : '';

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = editing
        ? await flagsApi.update(flag!.id, { name: name.trim(), description: description.trim() || null })
        : await flagsApi.create({ key, name: name.trim(), description: description.trim() || undefined });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>{editing ? 'Edit flag' : 'Create flag'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" value={name} autoFocus required inputProps={{ maxLength: 150 }}
            onChange={(e) => { setName(e.target.value); if (!editing && !keyTouched) setKey(slugify(e.target.value)); }}
            helperText="Shown on the dashboard, e.g. New checkout flow" />
          <TextField label="Key" value={key} required disabled={editing}
            onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }}
            error={!!keyError}
            helperText={keyError || (editing ? 'The key cannot change because apps use it in code.' : 'Your apps use this key to check the flag. It cannot be changed later.')}
            InputProps={{ sx: { fontFamily: monoFont } }} />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
            multiline minRows={2} helperText="What the feature does and who owns it" />
          {!editing && (
            <Alert severity="info" variant="outlined">
              New flags start switched off in every environment.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || name.trim().length < 2 || key.length < 2 || !!keyError}>
          {editing ? 'Save changes' : 'Create flag'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
