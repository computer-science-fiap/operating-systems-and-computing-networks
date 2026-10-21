import { PtCable } from './deployment';

export type GatewayRule = 'FIRST_HOST' | 'PENULTIMATE_HOST';

export type RouterId = 'R1' | 'R2';

export interface CheckpointInput {
  rmA: string;
  rmB: string;
  pcsPerDepartment: number;
  configureSwitchManagement: boolean;
}

export interface DepartmentRequirement {
  id: number;
  name: string;
  digit: number;
  requiredHosts: number;
  isServers: boolean;
  router: RouterId;
}

export interface CheckpointParams {
  rmA: number;
  rmB: number;
  sum: number;
  n: number;
  baseIp: string;
  baseCidr: number;
  isEven: boolean;
  gatewayRule: GatewayRule;
  digits: number[];
  departments: DepartmentRequirement[];
}

export interface EndDevice {
  name: string;
  ip: string;
  switchPort: string;
}

export interface DepartmentPlan extends DepartmentRequirement {
  order: number;
  cidr: number;
  subnetMask: string;
  wildcardMask: string;
  networkAddress: string;
  firstUsableIp: string;
  lastUsableIp: string;
  broadcastAddress: string;
  gateway: string;
  usableHosts: number;
  routerInterface: string;
  switchName: string;
  switchModel: string;
  switchUplinkPort: string;
  uplinkCable: PtCable;
  endDevices: EndDevice[];
}

export interface WanLinkPlan {
  networkAddress: string;
  cidr: number;
  subnetMask: string;
  r1Ip: string;
  r2Ip: string;
  broadcastAddress: string;
  r1Interface: string;
  r2Interface: string;
}

export interface SwitchManagementPlan {
  departmentId: number;
  switchName: string;
  ip: string;
  subnetMask: string;
  defaultGateway: string;
  autoConfigure: boolean;
}

export interface CheckpointPlan {
  params: CheckpointParams;
  departments: DepartmentPlan[];
  wan: WanLinkPlan;
  switchManagement: SwitchManagementPlan;
  ripNetwork: string;
}
