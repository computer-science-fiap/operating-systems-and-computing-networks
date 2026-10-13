export type AllocationMode = 'FLSM' | 'VLSM';

export interface SubnetRequirement {
  name: string;
  requiredHosts: number; 
  pcsToCreate: number; 
}

export interface CompilerInput {
  baseIp: string;
  baseCidr: number;
  mode: AllocationMode;
  fixedNewCidr?: number;
  subnets: SubnetRequirement[];
}

export interface PCNode {
  name: string;
  ip: string;
  switchPort: string;
}

export interface CalculatedSubnet {
  id: number;
  name: string;
  routerInterface: string;
  vlanId: number;
  networkAddress: string;
  cidr: number;
  subnetMask: string;
  wildcardMask: string;
  gateway: string;
  firstUsableIp: string;
  lastUsableIp: string;
  broadcastAddress: string;
  totalHosts: number;
  usableHosts: number;
  pcs: PCNode[];
}