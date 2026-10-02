import { Alert, Box, Chip, Divider, LinearProgress, Link, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Link as RouterLink } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { analyticsApi } from '../api/endpoints';
import ActionChip from '../components/ActionChip';
import EmptyState from '../components/EmptyState';
import EnvBadge from '../components/EnvBadge';
import Mono from '../components/Mono';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { envColor, tokens } from '../theme';
import type { DashboardStats } from '../types';
import { OFF_COLOR, ON_COLOR } from '../utils/charts';
import { fmtDate, fmtDateTime, humanize, timeAgo } from '../utils/format';

const DIST_COLORS = ['#C5CDD3', '#7E6BB0', '#BFE3D3', '#86CBAE', '#45A883', tokens.signal];

function Summary({ stats }: { stats: DashboardStats }) {
  const t = stats.totals;
  const cells = [
    { value: `${t.active_flags} of ${t.total_flags}`, label: 'Flags on somewhere', hint: `${t.archived_flags} archived` },
    { value: t.evaluations_today.toLocaleString(), label: 'Flag checks today', hint: 'Calls from your apps' },
    { value: t.environments, label: 'Environments', hint: `${stats.environments.filter((e) => e.is_protected).length} protected` },
    { value: t.user_assignments, label: 'User overrides', hint: `${t.active_users} active team members` },
  ];
  return (
    <Panel flush sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
      {cells.map((c, i) => (
        <Box key={c.label} sx={{
          p: { xs: 2, md: 2.5 },
          borderLeft: { lg: i ? 1 : 0 }, borderTop: { xs: i > 1 ? 1 : 0, lg: 0 },
          borderRight: { xs: i % 2 === 0 ? 1 : 0, lg: 0 }, borderColor: 'divider',
        }}>
          <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.75rem' }, fontWeight: 700, letterSpacing: '-0.02em' }}>{c.value}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{c.label}</Typography>
          <Typography variant="caption" color="text.secondary">{c.hint}</Typography>
        </Box>
      ))}
    </Panel>
  );
}

function EnvironmentStatus({ stats }: { stats: DashboardStats }) {
  return (
    <Panel title="Environments" action={<Link component={RouterLink} to="/environments" variant="body2">Manage</Link>}>
      <Stack divider={<Divider flexItem />} spacing={1.75}>
        {stats.environments.map((e) => {
          const pct = e.total_flags ? (e.enabled_flags / e.total_flags) * 100 : 0;
          return (
            <Box key={e.environment_id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <EnvBadge name={e.environment_name} envKey={e.environment_key} isProtected={e.is_protected} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {e.enabled_flags} of {e.total_flags} on
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} aria-label={`${e.environment_name}: ${Math.round(pct)}% of flags on`}
                sx={{ height: 6, borderRadius: 3, bgcolor: tokens.line, '& .MuiLinearProgress-bar': { bgcolor: envColor(e.environment_key), borderRadius: 3 } }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {e.partial_rollouts} partial rollouts, {e.scheduled_changes} scheduled changes, {e.user_assignments} user overrides
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Panel>
  );
}

function RolloutDistribution({ stats }: { stats: DashboardStats }) {
  const labels = Object.keys(stats.rollout_distribution);
  const values = Object.values(stats.rollout_distribution);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <Panel title="Rollout coverage">
      <Typography variant="body2" color="text.secondary" sx={{ mt: -1, mb: 2 }}>
        How far each flag has rolled out, across all {total} environment settings.
      </Typography>
      <Box sx={{ height: 240 }}>
        <Doughnut
          data={{ labels, datasets: [{ data: values, backgroundColor: DIST_COLORS, borderWidth: 2, borderColor: '#fff' }] }}
          options={{ maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } }}
        />
      </Box>
    </Panel>
  );
}

function EvaluationTrend({ stats }: { stats: DashboardStats }) {
  const trend = stats.evaluation_trend;
  const empty = trend.every((d) => d.enabled + d.disabled === 0);
  return (
    <Panel title="Flag checks, last 7 days">
      {empty ? (
        <EmptyState title="No flag checks yet" text="When your apps call the evaluate API, daily ON and OFF results appear here. If you've already made calls, check that Redis is running." />
      ) : (
        <Box sx={{ height: 260 }}>
          <Line
            data={{
              labels: trend.map((d) => fmtDate(d.date)),
              datasets: [
                { label: 'Served ON', data: trend.map((d) => d.enabled), borderColor: ON_COLOR, backgroundColor: ON_COLOR + '22', fill: true, tension: 0.3, pointRadius: 3 },
                { label: 'Served OFF', data: trend.map((d) => d.disabled), borderColor: OFF_COLOR, backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderDash: [4, 4] },
              ],
            }}
            options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
              plugins: { legend: { position: 'top', align: 'end' } } }}
          />
        </Box>
      )}
    </Panel>
  );
}

function TopFlags({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...stats.top_flags.map((f) => f.evaluations));
  return (
    <Panel title="Most-checked flags">
      {stats.top_flags.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No usage recorded in the last 7 days.</Typography>
      ) : (
        <Stack spacing={1.75}>
          {stats.top_flags.map((f) => (
            <Box key={f.flag_key}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{f.flag_name}</Typography>
                <Typography variant="body2" color="text.secondary">{f.evaluations.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', mt: 0.75, width: `${(f.evaluations / max) * 100}%`, minWidth: 8 }}>
                <Box sx={{ flex: f.enabled, bgcolor: ON_COLOR }} />
                <Box sx={{ flex: f.disabled, bgcolor: OFF_COLOR }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {Math.round((f.enabled / Math.max(1, f.evaluations)) * 100)}% served ON
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function Upcoming({ stats }: { stats: DashboardStats }) {
  return (
    <Panel title="Scheduled changes">
      {stats.upcoming_schedules.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Nothing scheduled. Set a start or end time on a flag's rollout to plan a release.</Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1.25}>
          {stats.upcoming_schedules.map((s) => (
            <Box key={`${s.rollout_id}-${s.action}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
              <Box sx={{ minWidth: 0 }}>
                <Mono sx={{ color: 'text.primary', display: 'block' }}>{s.flag_key}</Mono>
                <Typography variant="caption" color="text.secondary">{fmtDateTime(s.scheduled_at)} ({timeAgo(s.scheduled_at)})</Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Chip size="small" label={s.action === 'ENABLE' ? 'Turns on' : 'Turns off'} color={s.action === 'ENABLE' ? 'success' : 'default'} variant="outlined" />
                <Typography variant="caption" sx={{ display: 'block', color: envColor(s.environment_key), fontWeight: 600, mt: 0.25 }}>{s.environment_key}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function RecentActivity({ stats }: { stats: DashboardStats }) {
  return (
    <Panel title="Recent activity" action={<Link component={RouterLink} to="/audit-logs" variant="body2">Full audit log</Link>}>
      <Stack divider={<Divider flexItem />} spacing={1.25}>
        {stats.recent_activity.map((a) => (
          <Box key={a.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ flexShrink: 0, width: 150 }}><ActionChip action={a.action} /></Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap title={a.description ?? ''}>{a.description || humanize(a.action)}</Typography>
              <Typography variant="caption" color="text.secondary">{a.username} {timeAgo(a.created_at)}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Panel>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsApi.dashboard().then(setStats).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" description="Where every feature stands across your environments." />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!stats ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={110} />
          <Skeleton variant="rounded" height={300} />
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          <Summary stats={stats} />
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' } }}>
            <EnvironmentStatus stats={stats} />
            <RolloutDistribution stats={stats} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' } }}>
            <EvaluationTrend stats={stats} />
            <TopFlags stats={stats} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1.6fr' } }}>
            <Upcoming stats={stats} />
            <RecentActivity stats={stats} />
          </Box>
        </Stack>
      )}
    </>
  );
}
