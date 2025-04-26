import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { AppProps } from 'next/app';


import '../components/index.css';

import FlyonuiScript from '../components/meta/FlyonUI';
import WindowHeader from '../components/meta/WindowHeader';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <main className="prevent-select h-screen overflow-hidden bg-zinc-800 text-zinc-200">
      {router.asPath !== '/' && <WindowHeader />}
      <Component {...pageProps} />
      <FlyonuiScript />
    </main>
  );
}

export default MyApp;
