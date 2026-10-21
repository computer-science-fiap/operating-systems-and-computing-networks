export type PtDeviceKind = 'router' | 'switch' | 'pc' | 'server';

export type PtCable = 'straight' | 'cross' | 'serial' | 'fiber';

export interface PtHostIpConfig {
  port: string;
  address: string;
  mask: string;
  gateway: string;
}

export interface PtDevice {
  name: string;
  kind: PtDeviceKind;
  model: string;
  x: number;
  y: number;
  ipConfig?: PtHostIpConfig;
  cli?: string[];
}

export interface PtLink {
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  cable: PtCable;
}

export interface PtDeployment {
  devices: PtDevice[];
  links: PtLink[];
}
