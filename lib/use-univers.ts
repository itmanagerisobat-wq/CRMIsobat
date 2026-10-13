'use client';

import { useEffect, useState } from 'react';

function readUniversCookie(): 'b2b' | 'b2c' {
  const match = document.cookie.match(/(?:^|; )univers=(b2b|b2c)/);
  return match?.[1] === 'b2c' ? 'b2c' : 'b2b';
}

export function useUnivers(): 'b2b' | 'b2c' {
  const [univers, setUnivers] = useState<'b2b' | 'b2c'>('b2b');

  useEffect(() => {
    setUnivers(readUniversCookie());
    function onChange() { setUnivers(readUniversCookie()); }
    window.addEventListener('univers-changed', onChange);
    return () => window.removeEventListener('univers-changed', onChange);
  }, []);

  return univers;
}
