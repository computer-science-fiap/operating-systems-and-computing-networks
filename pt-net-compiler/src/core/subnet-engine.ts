import { CompilerInput, CalculatedSubnet, PCNode } from '../types/network';
import {
  intToIp,
  cidrToMask,
  cidrToWildcard,
  hostsToCidr,
  normalizeNetworkAddress,
} from './bitwise';

export function calculateSubnets(input: CompilerInput): CalculatedSubnet[] {
  const baseNetworkInt = normalizeNetworkAddress(input.baseIp, input.baseCidr);
  const maxBaseBlockIp = (baseNetworkInt + Math.pow(2, 32 - input.baseCidr) - 1) >>> 0;
  const orderedReqs =
    input.mode === 'VLSM'
      ? [...input.subnets].sort((a, b) => b.requiredHosts - a.requiredHosts)
      : [...input.subnets];

  let currentNetworkPointer = baseNetworkInt;
  const results: CalculatedSubnet[] = [];

  for (let i = 0; i < orderedReqs.length; i++) {
    const req = orderedReqs[i];

    const targetCidr =
      input.mode === 'FLSM'
        ? input.fixedNewCidr!
        : hostsToCidr(req.requiredHosts);

    const blockSize = Math.pow(2, 32 - targetCidr);
    const networkInt = currentNetworkPointer;
    const broadcastInt = (networkInt + blockSize - 1) >>> 0;

    if (broadcastInt > maxBaseBlockIp) {
      throw new Error(
        `Estouro de endereço! A sub-rede "${req.name}" (/${targetCidr}) ultrapassa o bloco base ${input.baseIp}/${input.baseCidr}.`
      );
    }

    const firstUsableInt = (networkInt + 1) >>> 0;
    const lastUsableInt = (broadcastInt - 1) >>> 0;
    const gatewayInt = firstUsableInt;
    const pcs: PCNode[] = [];
    for (let p = 0; p < req.pcsToCreate; p++) {
      const pcIpInt = (gatewayInt + 1 + p) >>> 0;
      if (pcIpInt > lastUsableInt) {
        throw new Error(
          `A sub-rede "${req.name}" (/${targetCidr}) só suporta ${blockSize - 3} PCs além do Gateway, mas você pediu para criar ${req.pcsToCreate} PCs.`
        );
      }

      pcs.push({
        name: `PC_${req.name.replace(/\s+/g, '')}_${p + 1}`,
        ip: intToIp(pcIpInt),
        switchPort: `FastEthernet0/${p + 1}`,
      });
    }

    results.push({
      id: i + 1,
      name: req.name,
      routerInterface: `GigabitEthernet0/${i}`,
      vlanId: (i + 1) * 10, 
      networkAddress: intToIp(networkInt),
      cidr: targetCidr,
      subnetMask: cidrToMask(targetCidr),
      wildcardMask: cidrToWildcard(targetCidr),
      gateway: intToIp(gatewayInt),
      firstUsableIp: intToIp(firstUsableInt),
      lastUsableIp: intToIp(lastUsableInt),
      broadcastAddress: intToIp(broadcastInt),
      totalHosts: blockSize,
      usableHosts: Math.max(0, blockSize - 2),
      pcs,
    });

    currentNetworkPointer = (broadcastInt + 1) >>> 0;
  }

  return results;
}