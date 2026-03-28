import type { HarnessRole, HarnessGroupStatus } from '../../types';

interface ConnectionLineProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromRole: HarnessRole;
  toRole: HarnessRole;
  groupStatus: HarnessGroupStatus;
  isRework?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  'planner-generator': '#3b82f6',
  'planner-evaluator': '#3b82f6',
  'generator-evaluator': '#f97316',
  'evaluator-generator': '#ef4444',
};

function getColor(fromRole: HarnessRole, toRole: HarnessRole, isRework?: boolean): string {
  if (isRework) return ROLE_COLORS['evaluator-generator'];
  return ROLE_COLORS[`${fromRole}-${toRole}`] || '#6b7280';
}

function isDashed(fromRole: HarnessRole, toRole: HarnessRole): boolean {
  return fromRole === 'planner' && toRole === 'evaluator';
}

export function ConnectionLine({
  fromX, fromY, toX, toY,
  fromRole, toRole,
  groupStatus,
  isRework,
}: ConnectionLineProps) {
  const color = getColor(fromRole, toRole, isRework);
  const dashed = isDashed(fromRole, toRole);
  const isRunning = groupStatus === 'running';

  // Smart bezier: curve based on direction
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(dist * 0.3, 80);

  // Determine control point direction based on relative position
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  let cx1: number, cy1: number, cx2: number, cy2: number;

  if (isHorizontal) {
    cx1 = fromX + curvature * Math.sign(dx);
    cy1 = fromY;
    cx2 = toX - curvature * Math.sign(dx);
    cy2 = toY;
  } else {
    cx1 = fromX;
    cy1 = fromY + curvature * Math.sign(dy);
    cx2 = toX;
    cy2 = toY - curvature * Math.sign(dy);
  }

  const pathD = `M ${fromX} ${fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toX} ${toY}`;

  // Arrow at end — compute tangent direction at endpoint
  const angle = Math.atan2(toY - cy2, toX - cx2);
  const arrowLen = 10;
  const arrow1X = toX - arrowLen * Math.cos(angle - Math.PI / 6);
  const arrow1Y = toY - arrowLen * Math.sin(angle - Math.PI / 6);
  const arrow2X = toX - arrowLen * Math.cos(angle + Math.PI / 6);
  const arrow2Y = toY - arrowLen * Math.sin(angle + Math.PI / 6);

  // Label at midpoint
  const labelX = (fromX + toX) / 2;
  const labelY = (fromY + toY) / 2 - 12;
  const label = `${fromRole[0].toUpperCase()}→${toRole[0].toUpperCase()}`;

  return (
    <g>
      {/* Main path */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2}
        strokeDasharray={dashed ? '6 4' : undefined} opacity={0.8} />

      {/* Flow animation when running */}
      {isRunning && (
        <path d={pathD} fill="none" stroke={color} strokeWidth={2}
          strokeDasharray="4 8" opacity={0.6}>
          <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
        </path>
      )}

      {/* Arrow */}
      <polygon points={`${toX},${toY} ${arrow1X},${arrow1Y} ${arrow2X},${arrow2Y}`}
        fill={color} opacity={0.9} />

      {/* Label */}
      <text x={labelX} y={labelY} textAnchor="middle" fill={color}
        fontSize={11} fontWeight={600} className="select-none pointer-events-none">
        {label}
      </text>
    </g>
  );
}
