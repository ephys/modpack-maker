import { useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

type TPopupControls<T> = {
  set(val?: T): void,
  reset(): void,
};

export function useHistoryState<T>(popupId: string, defaultValue: T): [T, TPopupControls<T>] {
  const location = useLocation();
  const history = useHistory();

  const currentValue = location.state?.[popupId];

  const set = useCallback((val: T) => {
    const liveLoc = history.location;

    if (val === undefined) {
      throw new Error('val cannot be undefined');
    }

    if (liveLoc.state?.[popupId] === val) {
      return;
    }

    history.push({
      ...liveLoc,
      state: {
        // @ts-expect-error
        ...liveLoc.state,
        [popupId]: val,
      },
    });
  }, [history, popupId]);

  const reset = useCallback(() => {
    const liveLoc = history.location;

    if (liveLoc.state?.[popupId] === undefined) {
      return;
    }

    // TODO: go back until state doesn't have popupId = true
    history.goBack();
  }, [history, popupId]);

  return [currentValue ?? defaultValue, { set, reset }];
}
