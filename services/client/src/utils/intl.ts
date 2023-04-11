import type { ReactNode } from 'react';
import type { IntlShape, MessageDescriptor } from 'react-intl';
import { isPlainObject } from './check.js';

export function isMessageDescriptor(input: unknown): input is MessageDescriptor {
  return isPlainObject(input) && input.id != null;
}

export function formatMessageOrString(intl: IntlShape, message: MessageDescriptor | ReactNode) {
  if (isMessageDescriptor(message)) {
    return intl.formatMessage(message);
  }

  return message;
}
