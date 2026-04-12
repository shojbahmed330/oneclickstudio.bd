import { LanguageService } from './src/services/LanguageService';

const ls = LanguageService.getInstance();
ls.updateVFS({
  'src/App.tsx': `
    import React, { useState } from 'react';
    export function App() {
      const [count, setCount] = useState(0);
      return <div onClick={() => setCount(count + 1)}>{count}</div>;
    }
  `
});
const errors = ls.validateFiles(['src/App.tsx']);
console.log("Errors:", errors);
