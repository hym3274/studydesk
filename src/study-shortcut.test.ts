import { describe, expect, it, vi } from 'vitest';
import { isStudyShortcut, registerStudySaveGuard, requestStudyNavigation, STUDY_URL } from './study-shortcut';

const key = { key: 'z', repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false };
describe('study shortcut', () => {
  it('accepts a plain Z key only outside editable fields', () => {
    expect(isStudyShortcut(key,false)).toBe(true);
    expect(isStudyShortcut(key,true)).toBe(false);
    expect(isStudyShortcut({...key,key:'x'},false)).toBe(false);
  });
  it.each(['repeat','isComposing','ctrlKey','altKey','metaKey','shiftKey'] as const)('ignores %s', flag => {
    expect(isStudyShortcut({...key,[flag]:true},false)).toBe(false);
  });
  it('finishes saving before navigating to the intended query', () => {
    const target = new EventTarget(), actions: string[] = [];
    const dispose = registerStudySaveGuard(target, () => {actions.push('saved');return true;},vi.fn());
    expect(requestStudyNavigation(target,url => actions.push(url))).toBe(true);
    expect(actions).toEqual(['saved', STUDY_URL]);
    expect(new URL(STUDY_URL).searchParams.get('q')).toBe('英検準2級');
    dispose();
  });
  it('keeps the match open when storage fails and removes the guard on unmount', () => {
    const target = new EventTarget(), navigate = vi.fn(), failure = vi.fn();
    const dispose = registerStudySaveGuard(target, () => false, failure);
    expect(requestStudyNavigation(target,navigate)).toBe(false);
    expect(failure).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    dispose();
    expect(requestStudyNavigation(target,navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith(STUDY_URL);
  });
});
