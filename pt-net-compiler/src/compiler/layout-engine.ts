import { CalculatedSubnet } from '../types/network';

export interface CanvasCoordinates {
  backbone: { x: number; y: number } | null;
  routers: Array<{ x: number; y: number }>;
  subnets: Array<{
    switchPos: { x: number; y: number };
    pcPositions: Array<{ x: number; y: number }>;
  }>;
}

export function calculateCanvasLayout(subnets: CalculatedSubnet[]): CanvasCoordinates {
  const totalSubnets = subnets.length;
  const isMultiRouter = totalSubnets > 3;
  const subnetSpacingX = 360;
  const pcSpacingX = 110;

  const totalWidth = Math.max(0, (totalSubnets - 1) * subnetSpacingX);
  const startX = 220;
  const centerX = startX + totalWidth / 2;

  const switchY = isMultiRouter ? 320 : 260;
  const pcBaseY = isMultiRouter ? 460 : 420;
  const pcStaggerY = isMultiRouter ? 525 : 485;

  const subnetLayouts = subnets.map((sub, index) => {
    const switchX = startX + index * subnetSpacingX;

    const totalPcs = sub.pcs.length;
    const pcPositions = sub.pcs.map((_, pcIndex) => {
      const offset = (pcIndex - (totalPcs - 1) / 2) * pcSpacingX;
      return {
        x: Math.round(switchX + offset),
        y: pcIndex % 2 === 1 ? pcStaggerY : pcBaseY,
      };
    });

    return {
      switchPos: { x: Math.round(switchX), y: switchY },
      pcPositions,
    };
  });

  const routers: Array<{ x: number; y: number }> = [];

  if (!isMultiRouter) {
    routers.push({ x: Math.round(centerX), y: 90 });
  } else {
    const totalRouters = Math.ceil(totalSubnets / 2);
    for (let r = 0; r < totalRouters; r++) {
      const firstSubIdx = r * 2;
      const secondSubIdx = Math.min(firstSubIdx + 1, totalSubnets - 1);
      const x1 = subnetLayouts[firstSubIdx].switchPos.x;
      const x2 = subnetLayouts[secondSubIdx].switchPos.x;
      routers.push({
        x: Math.round((x1 + x2) / 2),
        y: 175,
      });
    }
  }

  return {
    backbone: isMultiRouter ? { x: Math.round(centerX), y: 45 } : null,
    routers,
    subnets: subnetLayouts,
  };
}
