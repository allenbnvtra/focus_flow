import { requireNativeView } from 'expo';
import * as React from 'react';

import { LiveActivityModuleViewProps } from './LiveActivityModule.types';

const NativeView: React.ComponentType<LiveActivityModuleViewProps> =
  requireNativeView('LiveActivityModule');

export default function LiveActivityModuleView(props: LiveActivityModuleViewProps) {
  return <NativeView {...props} />;
}
