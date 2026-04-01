import * as React from 'react';

import { LiveActivityModuleViewProps } from './LiveActivityModule.types';

export default function LiveActivityModuleView(props: LiveActivityModuleViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
