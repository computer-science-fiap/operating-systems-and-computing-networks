import { CalculatedSubnet } from '../types/network';
import { calculateCanvasLayout } from './layout-engine';
import { ES5_HELPERS } from './pt-es5-runtime';

export function compileToPacketTracerES5(subnets: CalculatedSubnet[]): string {
  const layout = calculateCanvasLayout(subnets);
  const payload = JSON.stringify({ subnets, layout }, null, 2);

  return `${ES5_HELPERS}

function injectStaticRoutes(rObj, routes) {
    if (!rObj || routes.length === 0) return;
    try {
        if (typeof rObj.skipBoot === "function") {
            rObj.skipBoot();
        }
        if (typeof rObj.getCommandLine === "function") {
            var cli = rObj.getCommandLine();
            if (cli && typeof cli.enterCommand === "function") {
                cli.enterCommand("");
                cli.enterCommand("no");
                cli.enterCommand("");
                cli.enterCommand("enable");
                cli.enterCommand("configure terminal");
                for (var i = 0; i < routes.length; i++) {
                    var rt = routes[i];
                    cli.enterCommand("ip route " + rt.network + " " + rt.mask + " " + rt.nextHop);
                }
                cli.enterCommand("end");
                cli.enterCommand("write memory");
            }
        }
    } catch (e) {
        logMsg("Erro ao injetar rotas: " + e);
    }
}

function deployTopology() {
    var net = ipc.network();
    var lw = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();

    clearCanvas(net, lw);

    var data = ${payload};
    var subnets = data.subnets;
    var layout = data.layout;
    var isMultiRouter = subnets.length > 3;

    var backboneSwName = null;
    var backboneSwObj = null;

    if (isMultiRouter && layout.backbone) {
        backboneSwName = lw.addDevice(1, "2960-24TT", layout.backbone.x, layout.backbone.y);
        backboneSwObj = net.getDevice(backboneSwName);
    }

    var routers = [];
    var totalRoutersNeeded = layout.routers.length;

    for (var r = 0; r < totalRoutersNeeded; r++) {
        var rPos = layout.routers[r];
        var rName = lw.addDevice(0, "2911", rPos.x, rPos.y);
        var rObj = net.getDevice(rName);

        if (rObj && typeof rObj.skipBoot === "function") {
            rObj.skipBoot();
        }

        var backboneIp = "10.255.255." + (r + 1);
        var rLabel = totalRoutersNeeded === 1
            ? "Core-Router"
            : "Core-Router-" + (r + 1) + " (" + backboneIp + ")";

        if (isMultiRouter && backboneSwName) {
            lw.autoConnectDevices(rName, backboneSwName);
            if (rObj) {
                var uplinkPort = rObj.getPort("GigabitEthernet0/0");
                if (uplinkPort) {
                    uplinkPort.setIpSubnetMask(backboneIp, "255.255.255.0");
                    uplinkPort.setPower(true);
                }
            }
        }

        routers.push({ name: rName, obj: rObj, label: rLabel, backboneIp: backboneIp });
    }

    for (var i = 0; i < subnets.length; i++) {
        var sub = subnets[i];
        var subLayout = layout.subnets[i];

        var routerIndex = isMultiRouter ? Math.floor(i / 2) : 0;
        var portIndex = isMultiRouter ? (i % 2) + 1 : i;
        var targetRouter = routers[routerIndex];
        var routerPortName = "GigabitEthernet0/" + portIndex;

        var swName = lw.addDevice(1, "2960-24TT", subLayout.switchPos.x, subLayout.switchPos.y);
        var swObj = net.getDevice(swName);

        lw.autoConnectDevices(targetRouter.name, swName);

        if (targetRouter.obj) {
            var rPort = targetRouter.obj.getPort(routerPortName);
            if (rPort) {
                rPort.setIpSubnetMask(sub.gateway, sub.subnetMask);
                rPort.setPower(true);
            }
        }

        for (var p = 0; p < sub.pcs.length; p++) {
            var pcData = sub.pcs[p];
            var pcPos = subLayout.pcPositions[p];

            var pcName = lw.addDevice(8, "PC-PT", pcPos.x, pcPos.y);
            var pcObj = net.getDevice(pcName);

            lw.autoConnectDevices(swName, pcName);

            if (pcObj) {
                var pcPort = pcObj.getPort("FastEthernet0");
                if (pcPort) {
                    pcPort.setIpSubnetMask(pcData.ip, sub.subnetMask);
                    if (typeof pcPort.setDefaultGateway === "function") {
                        pcPort.setDefaultGateway(sub.gateway);
                    }
                }
                if (typeof pcObj.setDefaultGateway === "function") {
                    pcObj.setDefaultGateway(sub.gateway);
                }
                renameDevice(pcObj, pcData.name + " (" + pcData.ip + ")");
            }
        }

        renameDevice(swObj, sub.name + " (GW: " + sub.gateway + ")");
    }

    if (isMultiRouter) {
        for (var rIdx = 0; rIdx < routers.length; rIdx++) {
            var staticRoutes = [];
            for (var sIdx = 0; sIdx < subnets.length; sIdx++) {
                var ownerRouterIdx = Math.floor(sIdx / 2);
                if (ownerRouterIdx !== rIdx) {
                    staticRoutes.push({
                        network: subnets[sIdx].networkAddress,
                        mask: subnets[sIdx].subnetMask,
                        nextHop: routers[ownerRouterIdx].backboneIp
                    });
                }
            }
            injectStaticRoutes(routers[rIdx].obj, staticRoutes);
        }
        if (backboneSwObj) {
            renameDevice(backboneSwObj, "SW-Backbone (10.255.255.0/24)");
        }
    }

    for (var rRenameIdx = 0; rRenameIdx < routers.length; rRenameIdx++) {
        renameDevice(routers[rRenameIdx].obj, routers[rRenameIdx].label);
    }

    logMsg("Deploy concluido. Dispositivos: " + net.getDeviceCount() + " | Cabos: " + net.getLinkCount());
}

function main() {
    deployTopology();
}

function cleanUp() {
}
`;
}

export function compileToCiscoIOS(subnets: CalculatedSubnet[]): string {
  const isMultiRouter = subnets.length > 3;

  if (!isMultiRouter) {
    const lines: string[] = [
      'enable',
      'configure terminal',
      'hostname Core-Router',
      'no ip domain-lookup',
    ];

    for (const sub of subnets) {
      lines.push(`interface ${sub.routerInterface}`);
      lines.push(` description LAN_${sub.name.replace(/\s+/g, '_').toUpperCase()}`);
      lines.push(` ip address ${sub.gateway} ${sub.subnetMask}`);
      lines.push(' no shutdown');
      lines.push(' exit');
    }

    lines.push('end');
    lines.push('write memory');
    return lines.join('\n');
  }

  const totalRouters = Math.ceil(subnets.length / 2);
  const blocks: string[] = [];

  for (let r = 0; r < totalRouters; r++) {
    const lines: string[] = [
      `! === CORE-ROUTER-${r + 1} ===`,
      'enable',
      'configure terminal',
      `hostname Core-Router-${r + 1}`,
      'no ip domain-lookup',
      'interface GigabitEthernet0/0',
      ' description UPLINK_BACKBONE',
      ` ip address 10.255.255.${r + 1} 255.255.255.0`,
      ' no shutdown',
      ' exit',
    ];

    for (let s = 0; s < subnets.length; s++) {
      const owner = Math.floor(s / 2);
      const sub = subnets[s];
      if (owner === r) {
        const portIdx = (s % 2) + 1;
        lines.push(`interface GigabitEthernet0/${portIdx}`);
        lines.push(` description LAN_${sub.name.replace(/\s+/g, '_').toUpperCase()}`);
        lines.push(` ip address ${sub.gateway} ${sub.subnetMask}`);
        lines.push(' no shutdown', ' exit');
      } else {
        lines.push(`ip route ${sub.networkAddress} ${sub.subnetMask} 10.255.255.${owner + 1}`);
      }
    }

    lines.push('end', 'write memory', '');
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n');
}