/* eslint-disable @next/next/no-img-element */
import type { InvitationExperience } from '@/lib/planning';
export function InvitationFlowers({
  style,
  className = '',
}: {
  style: InvitationExperience['flowers'];
  className?: string;
}) {
  if (style === 'none') return null;
  return (
    <div
      className={`inv-flowers inv-flowers-${style} ${className}`}
      aria-hidden="true"
    >
      {style === 'ivory' && (
        <img
          src="/invitation/ivory-garden.webp"
          alt=""
          width="768"
          height="512"
        />
      )}
      <svg viewBox="0 0 500 180" fill="none">
        {[false, true].map((mirror) => (
          <g
            key={String(mirror)}
            transform={mirror ? 'translate(500 0) scale(-1 1)' : undefined}
          >
            <path
              d="M250 155C190 155 120 117 37 40M230 150C150 135 90 140 12 111M180 129C160 90 150 58 158 10"
              stroke="var(--inv-foliage)"
              strokeWidth="1.5"
            />
            {[
              [55, 55, -40],
              [89, 86, -26],
              [128, 106, -25],
              [170, 130, -15],
              [154, 43, 30],
              [160, 77, 20],
              [48, 121, 65],
              [90, 133, 75],
              [197, 143, 15],
            ].map(([x, y, r], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
                <path
                  d="M0 0Q-32 -25 -5 -48Q16 -27 0 0Z"
                  fill={style === 'minimal' ? 'none' : 'var(--inv-foliage)'}
                  fillOpacity=".5"
                  stroke="var(--inv-foliage)"
                />
                <path d="M0 0L-5 -40" stroke="var(--inv-foliage)" />
              </g>
            ))}
            {[
              [119, 98, 0.85],
              [198, 128, 1],
              [76, 72, 0.45],
            ].map(([x, y, scale], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${scale})`}>
                {[0, 60, 120, 180, 240, 300].map((r) => (
                  <ellipse
                    key={r}
                    cx="0"
                    cy="-16"
                    rx="15"
                    ry="24"
                    transform={`rotate(${r})`}
                    fill={style === 'minimal' ? 'none' : 'var(--inv-flower)'}
                    stroke="var(--inv-accent)"
                    strokeOpacity=".45"
                    strokeWidth=".8"
                  />
                ))}
                <circle r="7" fill="var(--inv-accent)" />
                {[0, 72, 144, 216, 288].map((r) => (
                  <circle
                    key={r}
                    cx={(Math.cos((r * Math.PI) / 180) * 10).toFixed(4)}
                    cy={(Math.sin((r * Math.PI) / 180) * 10).toFixed(4)}
                    r="1.8"
                    fill="var(--inv-accent)"
                  />
                ))}
              </g>
            ))}
            {[
              [24, 70],
              [40, 90],
              [135, 30],
              [185, 77],
              [204, 92],
              [98, 24],
            ].map(([x, y], i) => (
              <g key={i}>
                <path
                  d={`M${x + 20} ${y + 30}L${x} ${y}`}
                  stroke="var(--inv-accent)"
                  strokeWidth=".7"
                />
                <circle cx={x} cy={y} r="3" fill="var(--inv-accent)" />
                <circle cx={x + 8} cy={y + 3} r="2" fill="var(--inv-accent)" />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
