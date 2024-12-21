import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ServiceIndex() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => window.ipc.send('openApp', null), 3000);
  }, [router]);

  return (
    <>
      <div className="flex flex-col justify-center items-center place-items-center h-screen bg-zinc-900 my-auto">
        <img src="/img/vatacars-logo-dark.png" className="h-12" alt="" />
        <div className="my-2 flex">
          <span className="loading loading-infinity loading-lg animate-pulse" />
        </div>
      </div>
      <p className="absolute bottom-2 right-4 text-sm text-zinc-600 text-right mt-2">Version {require('../../package.json').version}</p>
    </>
  );
}
