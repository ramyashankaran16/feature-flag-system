import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import { Alert, Box, Button, Chip, Link, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { envApi, flagsApi } from '../../api/endpoints';
import ConfirmDialog from '../../components/ConfirmDialog';
import CopyButton from '../../components/CopyButton';
import FlagFormDialog from '../../components/FlagFormDialog';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { useNotify } from '../../context/NotifyContext';
import type { Environment, Flag, Rollout } from '../../types';
import { fmtDateTime } from '../../utils/format';
import AnalyticsTab from './AnalyticsTab';
import HistoryTab from './HistoryTab';
import RolloutPanel from './RolloutPanel';
import TargetingTab from './TargetingTab';
import TestTab from './TestTab';

const TABS = ['Rollout', 'User targeting', 'Usage', 'History', 'Test'] as const;

export default function FlagDetailPage() {
  const { id } = useParams();
  const flagId = Number(id);
  const navigate = useNavigate();
  const notify = useNotify();
  const { canEdit, canEditEnv, isAdmin } = useAuth();

  const [flag, setFlag] = useState<Flag | null>(null);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [f, e] = await Promise.all([flagsApi.get(flagId), envApi.list()]);
      setFlag(f);
      setEnvs(e);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [flagId]);

  useEffect(() => { load(); }, [load]);

  const onRolloutChange = (updated: Rollout) => {
    setFlag((f) => f && { ...f, rollouts: f.rollouts.map((r) => (r.id === updated.id ? updated : r)) });
    setHistoryKey((k) => k + 1);
  };

  const back = (
    <Link component={RouterLink} to="/flags" underline="hover" color="text.secondary"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1.5, fontSize: '0.875rem' }}>
      <ArrowBackIcon sx={{ fontSize: 16 }} /> All flags
    </Link>
  );

  if (error) return <>{back}<Alert severity="error">{error}</Alert></>;
  if (!flag) return <Stack spacing={2}><Skeleton width={300} height={48} /><Skeleton variant="rounded" height={320} /></Stack>;

  const archiveOrRestore = async () => {
    try {
      const updated = flag.is_archived ? await flagsApi.restore(flag.id) : await flagsApi.archive(flag.id);
      setFlag(updated);
      setHistoryKey((k) => k + 1);
      notify(updated.is_archived ? 'Flag archived. It now evaluates to off everywhere.' : 'Flag restored');
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  const remove = async () => {
    try {
      await flagsApi.remove(flag.id);
      notify(`Flag "${flag.key}" deleted`);
      navigate('/flags', { replace: true });
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <PageHeader
        back={back}
        title={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {flag.name}
            {flag.is_archived && <Chip label="Archived" size="small" />}
          </Box>
        }
        description={
          <Box component="span" sx={{ display: 'block' }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Mono sx={{ fontSize: '0.9rem' }}>{flag.key}</Mono>
              <CopyButton text={flag.key} label="Copy flag key" />
            </Box>
            {flag.description && <Box component="span" sx={{ display: 'block', mt: 0.5 }}>{flag.description}</Box>}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Created {fmtDateTime(flag.created_at)}{flag.created_by_username ? ` by ${flag.created_by_username}` : ''}
            </Typography>
          </Box>
        }
        actions={canEdit && (
          <>
            <Button startIcon={<EditOutlinedIcon />} variant="outlined" color="inherit" onClick={() => setEditOpen(true)}>Edit</Button>
            <Button startIcon={flag.is_archived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />} variant="outlined" color="inherit"
              onClick={() => (flag.is_archived ? archiveOrRestore() : setConfirm('archive'))}>
              {flag.is_archived ? 'Restore' : 'Archive'}
            </Button>
            {isAdmin && (
              <Button startIcon={<DeleteOutlineIcon />} variant="outlined" color="error" onClick={() => setConfirm('delete')}>Delete</Button>
            )}
          </>
        )}
      />

      {flag.is_archived && (
        <Alert severity="warning" sx={{ mb: 2 }}>This flag is archived, so every app gets "off". Restore it to make changes.</Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, 1fr)' } }}>
          {flag.rollouts.map((r) => (
            <RolloutPanel key={r.id} rollout={r} canEdit={canEditEnv(r.environment_is_protected)} archived={flag.is_archived} onChange={onRolloutChange} />
          ))}
        </Box>
      )}
      {tab === 1 && <TargetingTab flag={flag} envs={envs} />}
      {tab === 2 && <AnalyticsTab flagId={flag.id} />}
      {tab === 3 && <HistoryTab flagId={flag.id} refreshKey={historyKey} />}
      {tab === 4 && <TestTab flag={flag} envs={envs} />}

      <FlagFormDialog open={editOpen} flag={flag} onClose={() => setEditOpen(false)}
        onSaved={(f) => { setFlag(f); setEditOpen(false); setHistoryKey((k) => k + 1); notify('Flag updated'); }} />
      <ConfirmDialog
        open={confirm === 'archive'}
        title="Archive this flag?"
        message="Every app will get 'off' for this flag in all environments. You can restore it later."
        confirmLabel="Archive flag"
        danger
        onConfirm={archiveOrRestore}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this flag permanently?"
        message={<>This removes <strong>{flag.key}</strong>, its rollouts and user overrides. The audit log keeps its history. This cannot be undone.</>}
        confirmLabel="Delete flag"
        danger
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
