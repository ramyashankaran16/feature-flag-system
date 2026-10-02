import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Tooltip, Typography } from '@mui/material';
import { envColor } from '../theme';

interface Props {
  name: string;
  envKey: string;
  isProtected?: boolean;
  dense?: boolean;
}

export default function EnvBadge({ name, envKey, isProtected, dense }: Props) {
  const color = envColor(envKey);
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box component="span" sx={{ width: dense ? 8 : 10, height: dense ? 8 : 10, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography component="span" variant={dense ? 'caption' : 'body2'} sx={{ fontWeight: 600, color, whiteSpace: 'nowrap' }}>
        {name}
      </Typography>
      {isProtected && (
        <Tooltip title="Protected: only Admins can change this environment">
          <LockOutlinedIcon sx={{ fontSize: dense ? 13 : 15, color }} aria-label="Protected environment" />
        </Tooltip>
      )}
    </Box>
  );
}
