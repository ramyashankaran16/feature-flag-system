import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import HistoryIcon from '@mui/icons-material/History';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PasswordIcon from '@mui/icons-material/Password';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import {
  AppBar, Avatar, Box, ButtonBase, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme';
import type { RoleName } from '../types';
import ChangePasswordDialog from './ChangePasswordDialog';

const DRAWER_WIDTH = 244;

interface NavItem { to: string; label: string; icon: ReactNode; roles?: RoleName[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <DashboardOutlinedIcon /> },
  { to: '/flags', label: 'Feature flags', icon: <ToggleOnOutlinedIcon /> },
  { to: '/environments', label: 'Environments', icon: <LayersOutlinedIcon /> },
  { to: '/audit-logs', label: 'Audit log', icon: <HistoryIcon /> },
  { to: '/users', label: 'Users', icon: <PeopleOutlineIcon />, roles: ['Admin'] },
];

function Brand() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 2.5 }}>
      <Box sx={{ width: 30, height: 16, borderRadius: 8, bgcolor: tokens.signal, position: 'relative' }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#fff', position: 'absolute', right: 2, top: 2 }} />
      </Box>
      <Box>
        <Typography sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}>Switchboard</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>Feature flag control</Typography>
      </Box>
    </Box>
  );
}

export default function Layout() {
  const { user, hasRole, logout } = useAuth();
  const muiTheme = useTheme();
  const desktop = useMediaQuery(muiTheme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const items = NAV.filter((n) => !n.roles || hasRole(...n.roles));
  const initials = (user?.full_name || user?.username || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const signOut = async () => {
    setMenuEl(null);
    await logout();
    navigate('/login', { replace: true });
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: tokens.ink }}>
      <Brand />
      <List component="nav" aria-label="Main" sx={{ px: 1.25, flex: 1 }}>
        {items.map((item) => {
          const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 1.5, mb: 0.25, color: active ? '#fff' : 'rgba(255,255,255,0.68)',
                bgcolor: active ? tokens.inkSoft : 'transparent',
                boxShadow: active ? `inset 3px 0 0 ${tokens.signal}` : 'none',
                '&:hover': { bgcolor: tokens.inkSoft, color: '#fff' },
                '&.Mui-focusVisible': { outline: `2px solid ${tokens.signal}`, outlineOffset: -2 },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: active ? 600 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>

      <ButtonBase
        onClick={(e) => setMenuEl(e.currentTarget)}
        aria-label="Account menu"
        sx={{ m: 1.25, p: 1.25, borderRadius: 1.5, justifyContent: 'flex-start', gap: 1.25, textAlign: 'left',
          '&:hover': { bgcolor: tokens.inkSoft }, '&.Mui-focusVisible': { outline: `2px solid ${tokens.signal}` } }}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: tokens.signal, fontSize: '0.85rem', fontWeight: 600 }}>{initials}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>{user?.full_name || user?.username}</Typography>
          <Typography noWrap sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>{user?.role.name}</Typography>
        </Box>
      </ButtonBase>
      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setMenuEl(null); setPwdOpen(true); }}>
          <ListItemIcon><PasswordIcon fontSize="small" /></ListItemIcon>Change password
        </MenuItem>
        <MenuItem onClick={signOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Sign out
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!desktop && (
        <AppBar position="fixed" sx={{ bgcolor: tokens.ink }}>
          <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 700, ml: 1 }}>Switchboard</Typography>
          </Toolbar>
        </AppBar>
      )}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: DRAWER_WIDTH, border: 'none' } }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 3, lg: 4 }, pt: { xs: 10, md: 4 } }}>
        <Box sx={{ maxWidth: 1360, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Box>
  );
}
