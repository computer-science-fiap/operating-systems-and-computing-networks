import { RouterId } from '../types/checkpoint';
import { PtCable } from '../types/deployment';

// Router-PT (genérico/modular): Fa0/0 e Fa1/0 são de cobre, Se2/0 e Se3/0 seriais,
// e Fa4/0 e Fa5/0 vêm com módulos de FIBRA (PT-ROUTER-NM-1FFE).
export const ROUTER_MODEL = 'Router-PT';
export const PC_MODEL = 'PC-PT';
export const SERVER_MODEL = 'Server-PT';

export const HOST_PORT = 'FastEthernet0';
export const WAN_INTERFACE = 'Serial2/0';
export const WAN_CLOCK_RATE = 64000;

export type LanMedium = 'copper' | 'fiber';

export interface SwitchProfile {
  model: string;
  uplinkPort: string;
  uplinkCable: PtCable;
  maxAccessPorts: number;
  accessPort(index: number): string;
}

// O 2960 não tem porta de fibra; o Switch-PT tem Fa0/1–Fa3/1 (cobre) e Fa4/1–Fa5/1 (fibra).
export const SWITCH_PROFILES: Record<LanMedium, SwitchProfile> = {
  copper: {
    model: '2960-24TT',
    uplinkPort: 'GigabitEthernet0/1',
    uplinkCable: 'straight',
    maxAccessPorts: 24,
    accessPort: (index) => `FastEthernet0/${index + 1}`,
  },
  fiber: {
    model: 'Switch-PT',
    uplinkPort: 'FastEthernet4/1',
    uplinkCable: 'fiber',
    maxAccessPorts: 4,
    accessPort: (index) => `FastEthernet${index}/1`,
  },
};

export interface LanInterface {
  name: string;
  medium: LanMedium;
}

export const LAN_INTERFACES: Record<RouterId, LanInterface[]> = {
  R1: [
    { name: 'FastEthernet0/0', medium: 'copper' },
    { name: 'FastEthernet1/0', medium: 'copper' },
    { name: 'FastEthernet4/0', medium: 'fiber' },
    { name: 'FastEthernet5/0', medium: 'fiber' },
  ],
  R2: [{ name: 'FastEthernet0/0', medium: 'copper' }],
};
