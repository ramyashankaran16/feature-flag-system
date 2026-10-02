import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { IconButton, Tooltip } from '@mui/material';
import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. http on another host) */
    }
  };
  return (
    <Tooltip title={copied ? 'Copied' : label}>
      <IconButton size="small" onClick={copy} aria-label={label}>
        {copied ? <CheckIcon fontSize="inherit" color="success" /> : <ContentCopyIcon fontSize="inherit" />}
      </IconButton>
    </Tooltip>
  );
}
