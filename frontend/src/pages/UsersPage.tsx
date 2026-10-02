import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton,
  InputAdornment, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { usersApi } from '../api/endpoints';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotifyContext';
import { useDebounce } from '../hooks/useDebounce';
import type { Page, Role, User } from '../types';
import { timeAgo } from '../utils/format';

const ROLE_COLOR: Record<string, 'error' | 'primary' | 'default'> = { Admin: 'error', Developer: 'primary', Viewer: 'default' };

function UserDialog({ open, user, roles, onClose, onSaved }: {
  open: boolean; user: User | null; roles: Role[]; onClose: () => void; onSaved: () => void;
}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(user?.username ?? ''); setEmail(user?.email ?? ''); setFullName(user?.full_name ?? '');
    setRoleId(user?.role.id ?? roles.find((r) => r.name === 'Viewer')?.id ?? ''); setPassword('');
    setActive(user?.is_active ?? true); setError('');
  }, [open, user, roles]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (user) {
        await usersApi.update(user.id, { email, full_name: fullName || null, role_id: Number(roleId), is_active: active, ...(password && { password }) });
      } else {
        await usersApi.create({ username, email, full_name: fullName || undefined, password, role_id: Number(roleId) });
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{user ? `Edit ${user.username}` : 'Add user'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!user} autoFocus={!user} />
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField select label="Role" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
            {roles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Box><Typography>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.description}</Typography></Box>
              </MenuItem>
            ))}
          </TextField>
          <TextField label={user ? 'New password (optional)' : 'Password'} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
            helperText="At least 8 characters with upper-case, lower-case letters and a digit" />
          {user && <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active (can sign in)" />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !username || !email || roleId === '' || (!user && !password)}>
          {user ? 'Save changes' : 'Add user'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const notify = useNotify();
  const [roles, setRoles] = useState<Role[]>([]);
  const [data, setData] = useState<Page<User> | null>(null);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [dialog, setDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [toDelete, setToDelete] = useState<User | null>(null);

  useEffect(() => { usersApi.roles().then(setRoles).catch((e) => notify(errorMessage(e), 'error')); }, [notify]);

  const load = useCallback(() => {
    usersApi.list({ q: dq || undefined, page: page + 1, size }).then(setData).catch((e) => notify(errorMessage(e), 'error'));
  }, [dq, page, size, notify]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Users"
        description="People who can sign in to Switchboard and what they're allowed to do."
        actions={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, user: null })}>Add user</Button>}
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mb: 2.5 }}>
        {roles.map((r) => (
          <Panel key={r.id} sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Chip size="small" label={r.name} color={ROLE_COLOR[r.name]} variant="outlined" />
              <Typography variant="body2" color="text.secondary">{r.user_count} {r.user_count === 1 ? 'user' : 'users'}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{r.description}</Typography>
          </Panel>
        ))}
      </Box>

      <Panel flush>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField size="small" placeholder="Search by name, username or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            sx={{ width: '100%', maxWidth: 420 }} inputProps={{ 'aria-label': 'Search users' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        </Box>
        <TableContainer>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last sign-in</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{u.full_name || u.username}{u.id === me?.id && ' (you)'}</Typography>
                    <Typography variant="body2" color="text.secondary">@{u.username}</Typography>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Chip size="small" label={u.role.name} color={ROLE_COLOR[u.role.name]} variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip size="small" label={u.is_active ? 'Active' : 'Deactivated'} color={u.is_active ? 'success' : 'default'} variant={u.is_active ? 'filled' : 'outlined'}
                      sx={u.is_active ? { bgcolor: 'rgba(18,128,92,0.1)', color: 'success.dark' } : undefined} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => setDialog({ open: true, user: u })} aria-label={`Edit ${u.username}`}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={u.id === me?.id ? "You can't delete your own account" : 'Delete'}>
                      <span>
                        <IconButton size="small" disabled={u.id === me?.id} onClick={() => setToDelete(u)} aria-label={`Delete ${u.username}`}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data && (
          <TablePagination component="div" count={data.total} page={page} rowsPerPage={size}
            onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }} />
        )}
      </Panel>

      <UserDialog open={dialog.open} user={dialog.user} roles={roles} onClose={() => setDialog({ open: false, user: null })}
        onSaved={() => { setDialog({ open: false, user: null }); notify('User saved'); load(); usersApi.roles().then(setRoles); }} />
      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.username}?`}
        message="They will no longer be able to sign in. Their past changes stay in the audit log. To pause access instead, edit the user and turn off Active."
        confirmLabel="Delete user"
        danger
        onConfirm={async () => {
          try { await usersApi.remove(toDelete!.id); notify('User deleted'); load(); usersApi.roles().then(setRoles); } catch (e) { notify(errorMessage(e), 'error'); }
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
