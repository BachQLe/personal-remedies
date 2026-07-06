/**
 * Confetti — celebratory one-shot animation via Framer Motion.
 *
 * Renders ~30 colored particles that burst upward and fall with gravity.
 * Auto-unmounts after the animation completes (~2s).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const COLORS = [
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#15803d', // green-700 (forest)
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#a78bfa', // violet-400
  '#60a5fa', // blue-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
];

const PARTICLE_COUNT = 30;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: randomBetween(-120, 120),
    y: randomBetween(-200, -60),
    rotation: randomBetween(0, 720),
    scale: randomBetween(0.5, 1.2),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: randomBetween(0, 0.3),
    width: randomBetween(6, 12),
    height: randomBetween(6, 12),
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
  }));
}

export default function Confetti({ show, onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (show) {
      setParticles(generateParticles());
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute"
              style={{
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
              }}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                x: p.x,
                y: [p.y, p.y + 300],
                scale: [0, p.scale, p.scale * 0.5],
                rotate: p.rotation,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 1.8,
                delay: p.delay,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
