import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './LiveActivityModule.types';

type LiveActivityModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class LiveActivityModule extends NativeModule<LiveActivityModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(LiveActivityModule, 'LiveActivityModule');
