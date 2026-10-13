export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Endereço IP inválido: ${ip}`);
  }
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}
export function cidrToMask(cidr: number): string {
  if (cidr < 0 || cidr > 32) throw new Error(`CIDR inválido: /${cidr}`);
  const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return intToIp(maskInt);
}

export function cidrToWildcard(cidr: number): string {
  const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  const wildcardInt = ~maskInt >>> 0;
  return intToIp(wildcardInt);
}

export function hostsToCidr(requiredHosts: number): number {
  const totalNeeded = requiredHosts + 3;
  const hostBits = Math.ceil(Math.log2(totalNeeded));
  const cidr = 32 - Math.max(hostBits, 2);
  if (cidr < 8) {
    throw new Error(`Quantidade de hosts exagerada (${requiredHosts})`);
  }
  return cidr;
}

export function normalizeNetworkAddress(ip: string, cidr: number): number {
  const ipInt = ipToInt(ip);
  const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return (ipInt & maskInt) >>> 0;
}