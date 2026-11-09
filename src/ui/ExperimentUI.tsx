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
    '--color-background-body': '#ffffff',
    '--color-background-surface': '#ffffff',
    '--color-accent': '#111111',
  },
  components: {
    button: { 'size:lg': { minHeight: '48px', fontSize: '16px' } },
  },
});
// Keep the theme and reset outside the match route. Existing game components
// and their storage/rules stay untouched by the experiment.
export function ExperimentUI({ children }: { children: ReactNode }) {
  return <VStack className="astryx-ui"><Theme theme={theme} mode="light"><LinkProvider component={RouterLink}>{children}</LinkProvider></Theme></VStack>;
}
function RouterLink({ href, to: _to, ...props }: Omit<ComponentProps<typeof Link>, 'to'> & { href: string; to?: string }) {
  return <Link {...props} to={href} />;
}
