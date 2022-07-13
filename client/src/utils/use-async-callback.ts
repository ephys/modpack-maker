import { useState } from 'react';
import { useSnackbar } from '../components/snackbar';
import type { MaybePromise } from './typing.js';

type ResponseCallbacks<Res> = {
  error?(e: unknown): void,
  success?(data: Res): void,
};

type CallOperationIn<Args extends any[], Res> = (...args: Args) => MaybePromise<Res>;

export type CallOperationOut<Args extends any[], Res> = (...args: Args) => Promise<TOpStatus<Res>>;

export type TOpStatus<Res> = {
  loading: boolean,
  error: unknown | undefined,
  data: Res | undefined,
};

export function useAsyncCallback<Args extends any[], Res>(
  callback: CallOperationIn<Args, Res>,
  responseCallbacks?: ResponseCallbacks<Res>,
): [CallOperationOut<Args, Res>, TOpStatus<Res>] {
  const addSnack = useSnackbar();

  const [mutationStatus, setStatus] = useState<TOpStatus<Res>>({
    loading: false,
    error: undefined,
    data: undefined,
  });

  async function callMutation(...args: Args) {

    setStatus({
      ...mutationStatus,
      loading: true,
    });

    let newStatus: TOpStatus<Res>;

    try {
      const result: Res = await callback(...args);

      responseCallbacks?.success?.(result);

      newStatus = {
        loading: false,
        error: void 0,
        data: result,
      };
    } catch (e) {
      responseCallbacks?.error?.(e);
      addSnack('An error occurred', { type: 'error' });

      newStatus = {
        loading: false,
        error: e,
        data: void 0,
      };
    }

    setStatus(newStatus);

    return newStatus;
  }

  return [callMutation, mutationStatus];
}
