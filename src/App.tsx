import { Suspense } from 'react';
import { PpbsApp } from './ppbs/App';

export default function App() {
  return (
    <Suspense fallback={null}>
      <PpbsApp />
    </Suspense>
  );
}
