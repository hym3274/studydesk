import { useEffect } from 'react';
import { installStudyShortcut } from './study-shortcut';

export function StudyShortcut() {
  useEffect(installStudyShortcut, []);
  return null;
}
