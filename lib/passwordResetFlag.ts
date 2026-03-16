let _active = false;

export const passwordResetFlag = {
  get: () => _active,
  set: (v: boolean) => { _active = v; },
};