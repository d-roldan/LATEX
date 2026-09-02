interface SkeletonRowProps {
  cols: number;
  rows?: number;
}

function SkeletonCell() {
  return (
    <td>
      <div
        style={{
          height: '0.9rem',
          borderRadius: '0.3rem',
          background: 'linear-gradient(90deg, var(--panel) 25%, var(--panel-elevated) 50%, var(--panel) 75%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.4s infinite',
          maxWidth: '140px'
        }}
      />
    </td>
  );
}

/**
 * Renders animated skeleton rows for table loading states.
 *
 * @example
 * {isLoading ? (
 *   <SkeletonRows cols={5} rows={4} />
 * ) : ( ... real rows ... )}
 */
export function SkeletonRows({ cols, rows = 4 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} style={{ opacity: 1 - rowIndex * 0.15 }}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <SkeletonCell key={colIndex} />
          ))}
        </tr>
      ))}
    </>
  );
}
