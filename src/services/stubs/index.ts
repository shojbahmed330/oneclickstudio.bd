import { jsGlobals } from './jsGlobals';
import { domGlobals } from './domGlobals';
import { reactGlobals } from './reactGlobals';

export const defaultTypeStubs = `
  ${jsGlobals}
  ${domGlobals}
  ${reactGlobals}
`;
