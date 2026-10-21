import { CheckpointParams, DepartmentRequirement } from '../types/checkpoint';

const DEPARTMENT_COUNT = 5;
const SERVERS_DEPARTMENT_ID = 5;

export function parseRm(raw: string): number {
  const digits = raw.trim().replace(/^RM/i, '');
  if (!/^\d+$/.test(digits)) {
    throw new Error(`RM inválido: "${raw}". Use apenas os dígitos da matrícula.`);
  }
  return Number(digits);
}

export function departmentHosts(digit: number): number {
  return 20 + digit * 220;
}

export function computeCheckpointParams(rmARaw: string, rmBRaw: string): CheckpointParams {
  const rmA = parseRm(rmARaw);
  const rmB = parseRm(rmBRaw);
  const sum = rmA + rmB;
  const n = sum % 100;
  const isEven = sum % 2 === 0;

  const digits = String(sum % 10 ** DEPARTMENT_COUNT)
    .padStart(DEPARTMENT_COUNT, '0')
    .split('')
    .map(Number);

  const departments: DepartmentRequirement[] = digits.map((digit, index) => {
    const id = index + 1;
    const isServers = id === SERVERS_DEPARTMENT_ID;
    return {
      id,
      name: isServers ? 'Servidores' : `Depto ${id}`,
      digit,
      requiredHosts: departmentHosts(digit),
      isServers,
      router: isServers ? 'R2' : 'R1',
    };
  });

  return {
    rmA,
    rmB,
    sum,
    n,
    baseIp: `10.${n}.0.0`,
    baseCidr: 16,
    isEven,
    gatewayRule: isEven ? 'FIRST_HOST' : 'PENULTIMATE_HOST',
    digits,
    departments,
  };
}
