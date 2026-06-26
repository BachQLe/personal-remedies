const SHAPE_CLS = {
  text: 'h-3 rounded-sm',
  heading: 'h-5 rounded-sm',
  circle: 'rounded-full',
  card: 'rounded-xl',
  pill: 'rounded-pill h-7',
  block: 'rounded-lg',
};

export default function Skeleton({
  shape = 'text',
  className = '',
  tint,
  children,
}) {
  const base = SHAPE_CLS[shape] || SHAPE_CLS.text;
  const bg = tint || 'bg-sand-200';

  if (children) {
    return (
      <div className={`animate-pulse ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`animate-pulse ${bg} ${base} ${className}`} />
  );
}

export function SkeletonGroup({ rows = 3, gap = 'gap-2', className = '' }) {
  const widths = ['w-full', 'w-3/4', 'w-5/6', 'w-2/3', 'w-4/5'];
  return (
    <div className={`flex flex-col ${gap} ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} shape="text" className={widths[i % widths.length]} />
      ))}
    </div>
  );
}
