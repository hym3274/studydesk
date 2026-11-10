export const STUDY_URL = 'https://www.google.com/search?q=%E8%8B%B1%E6%A4%9C%E6%BA%962%E7%B4%9A';
export const BEFORE_STUDY_NAVIGATION = 'desk:before-study-navigation';

type KeyState = Pick<KeyboardEvent, 'key' | 'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;
export function isStudyShortcut(event: KeyState, editing: boolean): boolean {
  return !editing && event.key.toLowerCase() === 'z' && !event.repeat && !event.isComposing
    && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}

/** Save guards run synchronously before the document is left. */
export function requestStudyNavigation(target: EventTarget, navigate: (url: string) => void): boolean {
  if (!target.dispatchEvent(new Event(BEFORE_STUDY_NAVIGATION, { cancelable: true }))) return false;
  navigate(STUDY_URL);
  return true;
}

export function registerStudySaveGuard(target: EventTarget, save: () => boolean, onFailure: () => void): () => void {
  const listener = (event: Event) => {
    if (!save()) { event.preventDefault(); onFailure(); }
  };
  target.addEventListener(BEFORE_STUDY_NAVIGATION, listener);
  return () => target.removeEventListener(BEFORE_STUDY_NAVIGATION, listener);
}

export function installStudyShortcut(): () => void {
  function handleKey(event: KeyboardEvent) {
    const editable = [event.target, document.activeElement].some(target => target instanceof Element &&
      (target.closest('input, textarea, select, [role="textbox"], [role="combobox"]') !== null ||
        target instanceof HTMLElement && target.isContentEditable));
    if (!isStudyShortcut(event, editable) || event.defaultPrevented) return;
    event.preventDefault();
    requestStudyNavigation(window, url => window.location.assign(url));
  }
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}
