import type { ReactNode, ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { LinkProvider } from '@astryxdesign/core/Link';
import { Theme, defineTheme } from '@astryxdesign/core/theme';
import { VStack } from '@astryxdesign/core/VStack';
import { themes } from '../astryx-themes';
import '@astryxdesign/core/astryx.css';
import './astryx-reset.css';
import './experiment.css';

const theme = defineTheme({
  name: 'desk-experiment', extends: themes.neutral,
  tokens: {
    '--font-family-body': '"Noto Sans JP", system-ui, sans-serif',
    '--font-family-heading': '"Noto Sans JP", system-ui, sans-serif',
  },
  components: {
    button: { 'size:lg': { minHeight: '48px', fontSize: '16px' } },
  },
});
// Whole screens use the normal wrapper; a match can theme just its dialog
// with overlay=true, leaving the board layout and its reset boundary intact.
export function ExperimentUI({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  return <VStack className={`astryx-ui${overlay ? ' astryx-overlay' : ''}`}><Theme theme={theme} mode="light"><LinkProvider component={RouterLink}>{children}</LinkProvider></Theme></VStack>;
}
function RouterLink({ href, to: _to, ...props }: Omit<ComponentProps<typeof Link>, 'to'> & { href: string; to?: string }) {
  return <Link {...props} to={href} />;
}
