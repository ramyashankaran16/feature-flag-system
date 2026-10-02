import { Box, type BoxProps } from '@mui/material';
import { monoFont } from '../theme';

/** For real code identifiers only: flag keys, environment keys, API keys. */
export default function Mono({ sx, ...rest }: BoxProps) {
  return <Box component="code" sx={[{ fontFamily: monoFont, fontSize: '0.82em', color: 'text.secondary' }, ...(Array.isArray(sx) ? sx : [sx])]} {...rest} />;
}
