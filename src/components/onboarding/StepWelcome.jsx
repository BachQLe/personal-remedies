import { motion } from 'framer-motion';

// Reusable floating-item generator — plug in shapes later
// eslint-disable-next-line no-unused-vars
function generateFloatingItems(count) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 16 + Math.random() * 18,
      rotation: Math.random() * 360,
      delay: Math.random() * 4,
      duration: 6 + Math.random() * 8,
      driftX: (Math.random() - 0.5) * 40,
      driftY: (Math.random() - 0.5) * 30,
      spin: (Math.random() - 0.5) * 60,
    });
  }
  return items;
}

export default function StepWelcome({ onNext }) {
  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6 pb-8 text-center relative overflow-hidden"
      style={{ backgroundColor: '#C8A8E8' }}
    >
      <div className="relative z-10">
        <h1
          className="font-semibold tracking-normal text-[34px] text-blue-950 leading-tight mb-3"
          style={{ fontFamily: 'Chillax, sans-serif' }}
        >
          Let's set up your
          <br />
          profile!
        </h1>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 relative z-30"
      >
        <button
          onClick={onNext}
          className="px-12 py-4 rounded-pill text-blue-950 font-semibold text-base bg-white hover:bg-white/90 transition-colors duration-fast min-h-[48px] font-sans shadow-md"
        >
          Let's go!
        </button>
      </motion.div>

      <p className="text-xs text-blue-950/50 mt-4 font-sans relative z-10">Takes about 2 minutes</p>
    </div>
  );
}
