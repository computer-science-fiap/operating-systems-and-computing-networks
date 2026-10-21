import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckpointPlan } from './planner';
import { computeCheckpointParams } from './params';
import { buildCheckpointDeployment } from './deployment';
import { compileDeploymentToES5 } from '../compiler/pt-es5-runtime';

const input = { rmA: '566966', rmB: 'RM568401', pcsPerDepartment: 1, configureSwitchManagement: false };

test('parâmetros da dupla batem com a planilha', () => {
  const p = computeCheckpointParams(input.rmA, input.rmB);
  assert.equal(p.sum, 1135367);
  assert.equal(p.n, 67);
  assert.equal(p.baseIp, '10.67.0.0');
  assert.equal(p.gatewayRule, 'PENULTIMATE_HOST');
  assert.deepEqual(p.digits, [3, 5, 3, 6, 7]);
  assert.deepEqual(p.departments.map((d) => d.requiredHosts), [680, 1120, 680, 1340, 1560]);
});

test('S com menos de 5 dígitos completa com zeros e paridade par usa 1º host', () => {
  const p = computeCheckpointParams('100', '20');
  assert.deepEqual(p.digits, [0, 0, 1, 2, 0]);
  assert.equal(p.n, 20);
  assert.equal(p.gatewayRule, 'FIRST_HOST');
});

test('VLSM, gateways, WAN e gerência batem com o gabarito do checkpoint', () => {
  const plan = buildCheckpointPlan(input);
  const rows = plan.departments.map((d) => [d.id, d.cidr, d.networkAddress, d.broadcastAddress, d.gateway]);
  assert.deepEqual(rows, [
    [5, 21, '10.67.0.0', '10.67.7.255', '10.67.7.253'],
    [4, 21, '10.67.8.0', '10.67.15.255', '10.67.15.253'],
    [2, 21, '10.67.16.0', '10.67.23.255', '10.67.23.253'],
    [1, 22, '10.67.24.0', '10.67.27.255', '10.67.27.253'],
    [3, 22, '10.67.28.0', '10.67.31.255', '10.67.31.253'],
  ]);
  assert.deepEqual(
    [plan.wan.networkAddress, plan.wan.r1Ip, plan.wan.r2Ip, plan.wan.broadcastAddress],
    ['10.67.32.0', '10.67.32.1', '10.67.32.2', '10.67.32.3']
  );
  assert.equal(plan.switchManagement.ip, '10.67.27.254');
  assert.equal(plan.ripNetwork, '10.0.0.0');
});

test('hosts nunca usam o gateway nem o IP de gerência', () => {
  const plan = buildCheckpointPlan({ ...input, pcsPerDepartment: 4 });
  for (const d of plan.departments) {
    for (const h of d.endDevices) {
      assert.notEqual(h.ip, d.gateway);
      assert.notEqual(h.ip, plan.switchManagement.ip);
    }
  }
});

test('topologia: Deptos 1–4 no R1, Servidores no R2, portas sem repetição', () => {
  const plan = buildCheckpointPlan(input);
  const dep = buildCheckpointDeployment(plan);
  const r1Lans = dep.links.filter((l) => l.from === 'R1' && l.to.startsWith('SW'));
  const r2Lans = dep.links.filter((l) => l.from === 'R2');
  assert.equal(r1Lans.length, 4);
  assert.deepEqual(r2Lans.map((l) => l.to), ['SW5']);
  const used = dep.links.flatMap((l) => [`${l.from}:${l.fromPort}`, `${l.to}:${l.toPort}`]);
  assert.equal(new Set(used).size, used.length);
  assert.ok(dep.devices.some((d) => d.kind === 'server' && d.name === 'Servidor'));
});

test('Fa4/0 e Fa5/0 (fibra) do R1 ligam em Switch-PT com cabo de fibra', () => {
  const plan = buildCheckpointPlan({ ...input, pcsPerDepartment: 4 });
  const dep = buildCheckpointDeployment(plan);
  for (const port of ['FastEthernet4/0', 'FastEthernet5/0']) {
    const link = dep.links.find((l) => l.from === 'R1' && l.fromPort === port)!;
    assert.equal(link.cable, 'fiber');
    assert.equal(link.toPort, 'FastEthernet4/1');
    assert.equal(dep.devices.find((d) => d.name === link.to)!.model, 'Switch-PT');
  }
  const sw3Hosts = dep.links.filter((l) => l.to === 'SW3' && l.from.startsWith('PC')).map((l) => l.toPort);
  assert.deepEqual(sw3Hosts, ['FastEthernet0/1', 'FastEthernet1/1', 'FastEthernet2/1', 'FastEthernet3/1']);
  assert.equal(dep.devices.find((d) => d.name === 'SW1')!.model, '2960-24TT');
});

test('script só responde "no" ao diálogo inicial em roteadores', () => {
  const plan = buildCheckpointPlan({ ...input, configureSwitchManagement: true });
  const deployment = buildCheckpointDeployment(plan);
  const script = compileDeploymentToES5(deployment);
  assert.match(script, /if \(kind === "router"\) \{\s+cli\.enterCommand\("no"\);/);
  assert.match(script, /runCli\(targetObj, target\.cli, target\.kind\)/);
  assert.equal(deployment.devices.find((d) => d.name === 'SW1')!.kind, 'switch');
});
