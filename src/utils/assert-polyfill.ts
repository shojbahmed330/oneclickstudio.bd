
export const ok = (value: any, message?: string) => {
  if (!value) throw new Error(message || 'Assertion failed');
};

export const equal = (a: any, b: any, message?: string) => {
  if (a != b) throw new Error(message || `Assertion failed: ${a} != ${b}`);
};

export const strictEqual = (a: any, b: any, message?: string) => {
  if (a !== b) throw new Error(message || `Assertion failed: ${a} !== ${b}`);
};

export default {
  ok,
  equal,
  strictEqual
};
