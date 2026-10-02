import { Chip } from '@mui/material';
import { actionTone, humanize } from '../utils/format';

export default function ActionChip({ action }: { action: string }) {
  const tone = actionTone(action);
  return (
    <Chip
      size="small"
      label={humanize(action)}
      color={tone === 'default' ? 'default' : tone}
      variant={tone === 'default' ? 'outlined' : 'filled'}
      sx={{ fontSize: '0.72rem', height: 22, ...(tone !== 'default' && { bgcolor: (t) => t.palette[tone].main + '1A', color: (t) => t.palette[tone].dark }) }}
    />
  );
}
