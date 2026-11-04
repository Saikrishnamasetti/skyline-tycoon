import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Landing } from './pages/Landing';
import { Room } from './pages/Room';
import { Toasts } from './ui/Toasts';
import { useSocketBridge } from './hooks/useSocketBridge';

// Matches Vite's `base`, so the app also works from a sub-path such as
// https://user.github.io/skyline-tycoon/.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  useSocketBridge();
  return (
    // Honour the system "reduce motion" setting in every animation.
    <MotionConfig reducedMotion="user">
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/room/:code" element={<Room key="online" mode="online" />} />
          <Route path="/solo/:code" element={<Room key="solo" mode="solo" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </BrowserRouter>
    </MotionConfig>
  );
}
