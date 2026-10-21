import {
  CheckpointInput,
  CheckpointPlan,
  DepartmentPlan,
  EndDevice,
  RouterId,
  WanLinkPlan,
} from '../types/checkpoint';
import {
  cidrToMask,
  cidrToWildcard,
  classfulNetwork,
  intToIp,
  ipToInt,
  usableHostsToCidr,
} from '../core/bitwise';
import { computeCheckpointParams } from './params';
import { LAN_INTERFACES, LanInterface, SWITCH_PROFILES, WAN_INTERFACE } from './topology';

const MANAGEMENT_DEPARTMENT_ID = 1;
const WAN_CIDR = 30;

export function buildCheckpointPlan(input: CheckpointInput): CheckpointPlan {
  const params = computeCheckpointParams(input.rmA, input.rmB);
  const baseInt = ipToInt(params.baseIp);
  const maxBaseIp = baseInt + 2 ** (32 - params.baseCidr) - 1;

  // Ordenação estável: empates mantêm a ordem dos departamentos.
  const ordered = [...params.departments].sort((a, b) => b.requiredHosts - a.requiredHosts);

  const interfaceCursor: Record<RouterId, number> = { R1: 0, R2: 0 };
  const interfaceByDepartment = new Map<number, LanInterface>();
  for (const dept of params.departments) {
    const available = LAN_INTERFACES[dept.router];
    const idx = interfaceCursor[dept.router]++;
    if (idx >= available.length) {
      throw new Error(`O ${dept.router} não tem interfaces suficientes para "${dept.name}".`);
    }
    interfaceByDepartment.set(dept.id, available[idx]);
  }

  if (interfaceByDepartment.get(MANAGEMENT_DEPARTMENT_ID)!.medium !== 'copper') {
    throw new Error('O switch de gerência precisa ser um 2960 (interface de cobre no roteador).');
  }

  let pointer = baseInt;
  const departments: DepartmentPlan[] = ordered.map((dept, index) => {
    const cidr = usableHostsToCidr(dept.requiredHosts);
    const blockSize = 2 ** (32 - cidr);
    const networkInt = pointer;
    const broadcastInt = networkInt + blockSize - 1;
    if (broadcastInt > maxBaseIp) {
      throw new Error(`Estouro de endereço: "${dept.name}" (/${cidr}) ultrapassa ${params.baseIp}/${params.baseCidr}.`);
    }

    const firstInt = networkInt + 1;
    const lastInt = broadcastInt - 1;
    const gatewayInt = params.gatewayRule === 'FIRST_HOST' ? firstInt : lastInt - 1;
    const reserved = new Set<number>([gatewayInt]);
    if (dept.id === MANAGEMENT_DEPARTMENT_ID) reserved.add(lastInt);

    const lan = interfaceByDepartment.get(dept.id)!;
    const switchProfile = SWITCH_PROFILES[lan.medium];
    const deviceCount = dept.isServers ? 1 : input.pcsPerDepartment;
    if (deviceCount > switchProfile.maxAccessPorts) {
      throw new Error(`O switch de "${dept.name}" (${switchProfile.model}) só tem ${switchProfile.maxAccessPorts} portas livres.`);
    }
    const endDevices: EndDevice[] = [];
    for (let ipInt = firstInt; endDevices.length < deviceCount; ipInt++) {
      if (ipInt > lastInt) {
        throw new Error(`"${dept.name}" (/${cidr}) não comporta ${deviceCount} dispositivo(s).`);
      }
      if (reserved.has(ipInt)) continue;
      const k = endDevices.length + 1;
      endDevices.push({
        name: dept.isServers ? 'Servidor' : deviceCount === 1 ? `PC${dept.id}` : `PC${dept.id}-${k}`,
        ip: intToIp(ipInt),
        switchPort: switchProfile.accessPort(endDevices.length),
      });
    }

    pointer = broadcastInt + 1;

    return {
      ...dept,
      order: index + 1,
      cidr,
      subnetMask: cidrToMask(cidr),
      wildcardMask: cidrToWildcard(cidr),
      networkAddress: intToIp(networkInt),
      firstUsableIp: intToIp(firstInt),
      lastUsableIp: intToIp(lastInt),
      broadcastAddress: intToIp(broadcastInt),
      gateway: intToIp(gatewayInt),
      usableHosts: blockSize - 2,
      routerInterface: lan.name,
      switchName: `SW${dept.id}`,
      switchModel: switchProfile.model,
      switchUplinkPort: switchProfile.uplinkPort,
      uplinkCable: switchProfile.uplinkCable,
      endDevices,
    };
  });

  // Blocos em ordem decrescente terminam sempre alinhados, então o /30 começa no ponteiro.
  const wanInt = pointer;
  if (wanInt + 3 > maxBaseIp) {
    throw new Error('Não há espaço para o enlace WAN /30 dentro do bloco base.');
  }
  const wan: WanLinkPlan = {
    networkAddress: intToIp(wanInt),
    cidr: WAN_CIDR,
    subnetMask: cidrToMask(WAN_CIDR),
    r1Ip: intToIp(wanInt + 1),
    r2Ip: intToIp(wanInt + 2),
    broadcastAddress: intToIp(wanInt + 3),
    r1Interface: WAN_INTERFACE,
    r2Interface: WAN_INTERFACE,
  };

  const mgmtDept = departments.find((d) => d.id === MANAGEMENT_DEPARTMENT_ID)!;

  return {
    params,
    departments,
    wan,
    switchManagement: {
      departmentId: mgmtDept.id,
      switchName: mgmtDept.switchName,
      ip: mgmtDept.lastUsableIp,
      subnetMask: mgmtDept.subnetMask,
      defaultGateway: mgmtDept.gateway,
      autoConfigure: input.configureSwitchManagement,
    },
    ripNetwork: classfulNetwork(params.baseIp),
  };
}
