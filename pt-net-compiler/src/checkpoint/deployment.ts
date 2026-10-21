import { CheckpointPlan, DepartmentPlan, RouterId } from '../types/checkpoint';
import { PtDeployment, PtDevice, PtLink } from '../types/deployment';
import {
  HOST_PORT,
  PC_MODEL,
  ROUTER_MODEL,
  SERVER_MODEL,
  WAN_CLOCK_RATE,
} from './topology';

const ROUTERS: RouterId[] = ['R1', 'R2'];

const LAYOUT = {
  lanStartX: 120,
  lanSpacingX: 230,
  r2X: 1100,
  routerY: { R1: 110, R2: 60 } as Record<RouterId, number>,
  switchY: 280,
  hostY: 430,
  hostStaggerY: 60,
  hostSpacingX: 90,
};

function departmentsOf(plan: CheckpointPlan, router: RouterId): DepartmentPlan[] {
  return plan.departments.filter((d) => d.router === router).sort((a, b) => a.id - b.id);
}

function interfaceDescription(dept: DepartmentPlan): string {
  return dept.isServers ? 'SERVIDORES' : `DEPTO_${dept.id}`;
}

export function buildRouterCli(plan: CheckpointPlan, router: RouterId): string[] {
  const { wan } = plan;
  const lines = ['enable', 'configure terminal', `hostname ${router}`, 'no ip domain-lookup'];

  for (const dept of departmentsOf(plan, router)) {
    lines.push(
      `interface ${dept.routerInterface}`,
      ` description ${interfaceDescription(dept)}`,
      ` ip address ${dept.gateway} ${dept.subnetMask}`,
      ' no shutdown',
      ' exit'
    );
  }

  lines.push(
    `interface ${router === 'R1' ? wan.r1Interface : wan.r2Interface}`,
    ' description WAN_R1_R2',
    ` ip address ${router === 'R1' ? wan.r1Ip : wan.r2Ip} ${wan.subnetMask}`,
    ` clock rate ${WAN_CLOCK_RATE}`,
    ' no shutdown',
    ' exit',
    'router rip',
    ' version 2',
    ' no auto-summary',
    ` network ${plan.ripNetwork}`,
    ' exit',
    'end',
    'write memory'
  );
  return lines;
}

export function buildSwitchManagementCli(plan: CheckpointPlan): string[] {
  const mgmt = plan.switchManagement;
  return [
    'enable',
    'configure terminal',
    `hostname ${mgmt.switchName}`,
    'interface vlan 1',
    ` ip address ${mgmt.ip} ${mgmt.subnetMask}`,
    ' no shutdown',
    ' exit',
    `ip default-gateway ${mgmt.defaultGateway}`,
    'end',
    'write memory',
  ];
}

export function buildCheckpointDeployment(plan: CheckpointPlan): PtDeployment {
  const devices: PtDevice[] = [];
  const links: PtLink[] = [];
  const r1Depts = departmentsOf(plan, 'R1');
  const r1Width = (r1Depts.length - 1) * LAYOUT.lanSpacingX;

  const routerX: Record<RouterId, number> = {
    R1: LAYOUT.lanStartX + r1Width / 2,
    R2: LAYOUT.r2X,
  };

  for (const router of ROUTERS) {
    devices.push({
      name: router,
      kind: 'router',
      model: ROUTER_MODEL,
      x: Math.round(routerX[router]),
      y: LAYOUT.routerY[router],
      cli: buildRouterCli(plan, router),
    });
  }

  const lanSlots = [...r1Depts, ...departmentsOf(plan, 'R2')];
  lanSlots.forEach((dept, slot) => {
    const switchX = dept.router === 'R1' ? LAYOUT.lanStartX + slot * LAYOUT.lanSpacingX : LAYOUT.r2X;
    const isMgmtSwitch = dept.id === plan.switchManagement.departmentId;

    devices.push({
      name: dept.switchName,
      kind: 'switch',
      model: dept.switchModel,
      x: switchX,
      y: LAYOUT.switchY,
      cli: isMgmtSwitch && plan.switchManagement.autoConfigure ? buildSwitchManagementCli(plan) : undefined,
    });
    links.push({
      from: dept.router,
      fromPort: dept.routerInterface,
      to: dept.switchName,
      toPort: dept.switchUplinkPort,
      cable: dept.uplinkCable,
    });

    const total = dept.endDevices.length;
    dept.endDevices.forEach((host, k) => {
      devices.push({
        name: host.name,
        kind: dept.isServers ? 'server' : 'pc',
        model: dept.isServers ? SERVER_MODEL : PC_MODEL,
        x: Math.round(switchX + (k - (total - 1) / 2) * LAYOUT.hostSpacingX),
        y: LAYOUT.hostY + (k % 2) * LAYOUT.hostStaggerY,
        ipConfig: { port: HOST_PORT, address: host.ip, mask: dept.subnetMask, gateway: dept.gateway },
      });
      links.push({
        from: host.name,
        fromPort: HOST_PORT,
        to: dept.switchName,
        toPort: host.switchPort,
        cable: 'straight',
      });
    });
  });

  // R1 é a primeira ponta do cabo serial, então fica como DCE (clock rate).
  links.push({
    from: 'R1',
    fromPort: plan.wan.r1Interface,
    to: 'R2',
    toPort: plan.wan.r2Interface,
    cable: 'serial',
  });

  return { devices, links };
}

export function compileCheckpointToCiscoIOS(plan: CheckpointPlan): string {
  const blocks: string[] = [];

  for (const router of ROUTERS) {
    blocks.push([`! === ${router} ===`, ...buildRouterCli(plan, router)].join('\n'));
  }

  const mgmt = plan.switchManagement;
  const mgmtHeader = mgmt.autoConfigure
    ? `! === ${mgmt.switchName} (IP de gerência) ===`
    : `! === ${mgmt.switchName} (IP de gerência) — aplicar manualmente DEPOIS do ping "antes" ===`;
  blocks.push([mgmtHeader, ...buildSwitchManagementCli(plan)].join('\n'));

  const hostLines = ['! === Hosts (Desktop > IP Configuration) ==='];
  for (const dept of [...plan.departments].sort((a, b) => a.id - b.id)) {
    for (const host of dept.endDevices) {
      hostLines.push(`! ${host.name}: IP ${host.ip} | Máscara ${dept.subnetMask} | Gateway ${dept.gateway}`);
    }
  }
  blocks.push(hostLines.join('\n'));

  return blocks.join('\n\n') + '\n';
}
