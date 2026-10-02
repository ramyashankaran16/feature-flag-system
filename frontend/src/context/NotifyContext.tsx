import { Alert, Snackbar, type AlertColor } from '@mui/material';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Notify = (message: string, severity?: AlertColor) => void;
const NotifyContext = createContext<Notify>(() => undefined);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false, message: '', severity: 'success',
  });

  const notify = useCallback<Notify>((message, severity = 'success') => {
    setState({ open: true, message, severity });
  }, []);

  const close = () => setState((s) => ({ ...s, open: false }));

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.severity === 'error' ? 7000 : 3500}
        onClose={(_, reason) => reason !== 'clickaway' && close()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={close} severity={state.severity} variant="filled" sx={{ maxWidth: 480 }}>
          {state.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export const useNotify = () => useContext(NotifyContext);
