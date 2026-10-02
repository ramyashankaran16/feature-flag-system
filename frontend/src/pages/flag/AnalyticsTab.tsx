import { Alert, Box, MenuItem, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { errorMessage } from '../../api/client';
import { analyticsApi } from '../../api/endpoints';
import EmptyState from '../../components/EmptyState';
import EnvBadge from '../../components/EnvBadge';
import Panel from '../../components/Panel';
import { envColor } from '../../theme';
import type { FlagAnalytics } from '../../types';
import { OFF_COLOR, ON_COLOR } from '../../utils/charts';
import { fmtDate } from '../../utils/format';

export default function AnalyticsTab({ flagId }: { flagId: number }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<FlagAnalytics | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<string>('all');

  useEffect(() => {
    setData(null);
    analyticsApi.flag(flagId, days).then(setData).catch((e) => setError(errorMessage(e)));
  }, [flagId, days]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Skeleton variant="rounded" height={360} />;

  const labels = data.environments[0]?.series.map((p) => fmtDate(p.date)) ?? [];
  const selected = data.environments.find((e) => e.environment_key === view);

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Panel
        title={`${data.total_evaluations.toLocaleString()} checks in the last ${days} days`}
        action={
          <TextField select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            {[7, 14, 30, 90].map((d) => <MenuItem key={d} value={d}>Last {d} days</MenuItem>)}
          </TextField>
        }
      >
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} sx={{ mb: 2, flexWrap: 'wrap' }} aria-label="Environment">
          <ToggleButton value="all">All environments</ToggleButton>
          {data.environments.map((e) => <ToggleButton key={e.environment_key} value={e.environment_key}>{e.environment_name}</ToggleButton>)}
        </ToggleButtonGroup>

        {data.total_evaluations === 0 ? (
          <EmptyState title="No usage recorded for this period"
            text="Usage appears once an app checks this flag through the evaluate API. Usage counts are stored in Redis, so make sure it is running." />
        ) : (
          <Box sx={{ height: 300 }}>
            {selected ? (
              <Bar
                data={{ labels, datasets: [
                  { label: 'Served ON', data: selected.series.map((p) => p.enabled), backgroundColor: ON_COLOR, borderRadius: 3 },
                  { label: 'Served OFF', data: selected.series.map((p) => p.disabled), backgroundColor: OFF_COLOR, borderRadius: 3 },
                ] }}
                options={{ maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
                  plugins: { legend: { position: 'top', align: 'end' } } }}
              />
            ) : (
              <Line
                data={{ labels, datasets: data.environments.map((e) => ({
                  label: e.environment_name, data: e.series.map((p) => p.enabled + p.disabled),
                  borderColor: envColor(e.environment_key), backgroundColor: envColor(e.environment_key), tension: 0.3, pointRadius: 3,
                })) }}
                options={{ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
                  plugins: { legend: { position: 'top', align: 'end' } } }}
              />
            )}
          </Box>
        )}
      </Panel>

      <Panel title="By environment" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Environment</TableCell>
              <TableCell align="right">Checks</TableCell>
              <TableCell align="right">Served ON</TableCell>
              <TableCell align="right">Served OFF</TableCell>
              <TableCell align="right">ON rate</TableCell>
              <TableCell align="right">Peak daily users</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.environments.map((e) => (
              <TableRow key={e.environment_key}>
                <TableCell><EnvBadge name={e.environment_name} envKey={e.environment_key} /></TableCell>
                <TableCell align="right">{e.total_evaluations.toLocaleString()}</TableCell>
                <TableCell align="right">{e.enabled_count.toLocaleString()}</TableCell>
                <TableCell align="right">{e.disabled_count.toLocaleString()}</TableCell>
                <TableCell align="right">{e.total_evaluations ? `${Math.round((e.enabled_count / e.total_evaluations) * 100)}%` : '—'}</TableCell>
                <TableCell align="right">{Math.max(0, ...e.series.map((p) => p.unique_users)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Peak daily users is the highest number of distinct user IDs seen on a single day.
        </Typography>
      </Panel>
    </Box>
  );
}
