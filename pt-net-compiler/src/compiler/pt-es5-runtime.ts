import { PtDeployment } from '../types/deployment';

export const ES5_HELPERS = `function logMsg(msg) {
    if (typeof dprint === "function") {
        dprint(String(msg));
    }
}

function clearCanvas(net, lw) {
    var count = net.getDeviceCount();
    for (var d = count - 1; d >= 0; d--) {
        var dev = net.getDeviceAt(d);
        if (dev) {
            lw.removeDevice(dev.getName());
        }
    }
}

function renameDevice(devObj, label) {
    if (!devObj) return;
    if (typeof devObj.setName === "function") {
        devObj.setName(label);
    } else if (typeof devObj.setCustomName === "function") {
        devObj.setCustomName(label);
    }
}`;

export function compileDeploymentToES5(deployment: PtDeployment): string {
  const payload = JSON.stringify(deployment, null, 2);

  return `${ES5_HELPERS}

var DEVICE_TYPES = { router: 0, "switch": 1, pc: 8, server: 9 };
var CABLE_TYPES = { straight: 8100, cross: 8101, fiber: 8103, serial: 8106 };

function runCli(devObj, commands, kind) {
    if (!devObj || !commands || commands.length === 0) return;
    try {
        if (typeof devObj.skipBoot === "function") {
            devObj.skipBoot();
        }
        var cli = typeof devObj.getCommandLine === "function" ? devObj.getCommandLine() : null;
        if (!cli || typeof cli.enterCommand !== "function") {
            logMsg("CLI indisponivel em " + devObj.getName());
            return;
        }
        cli.enterCommand("");
        // Só roteadores perguntam pelo "initial configuration dialog". Num switch,
        // "no" vira uma tentativa de Telnet ao host "no" e engole os comandos seguintes.
        if (kind === "router") {
            cli.enterCommand("no");
            cli.enterCommand("");
        }
        for (var i = 0; i < commands.length; i++) {
            cli.enterCommand(commands[i]);
        }
    } catch (e) {
        logMsg("Erro na CLI de " + devObj.getName() + ": " + e);
    }
}

function describePorts(devObj) {
    if (!devObj || typeof devObj.getPortCount !== "function") return "?";
    var list = [];
    for (var p = 0; p < devObj.getPortCount(); p++) {
        var port = devObj.getPortAt(p);
        if (port) list.push(port.getName());
    }
    return list.join(", ");
}

function applyHostIp(devObj, cfg) {
    var port = devObj.getPort(cfg.port);
    if (port) {
        port.setIpSubnetMask(cfg.address, cfg.mask);
        if (typeof port.setDefaultGateway === "function") {
            port.setDefaultGateway(cfg.gateway);
        }
    }
    if (typeof devObj.setDefaultGateway === "function") {
        devObj.setDefaultGateway(cfg.gateway);
    }
}

function deployTopology() {
    var net = ipc.network();
    var lw = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();

    clearCanvas(net, lw);

    var data = ${payload};
    var names = {};
    var i;

    for (i = 0; i < data.devices.length; i++) {
        var dev = data.devices[i];
        var ptName = lw.addDevice(DEVICE_TYPES[dev.kind], dev.model, dev.x, dev.y);
        var obj = net.getDevice(ptName);
        if (!obj) {
            logMsg("Falha ao criar " + dev.name + " (" + dev.model + ")");
            continue;
        }
        if (typeof obj.skipBoot === "function") {
            obj.skipBoot();
        }
        renameDevice(obj, dev.name);
        names[dev.name] = obj.getName();
    }

    for (i = 0; i < data.links.length; i++) {
        var link = data.links[i];
        var ok;
        try {
            ok = lw.createLink(names[link.from], link.fromPort, names[link.to], link.toPort, CABLE_TYPES[link.cable]);
        } catch (e) {
            ok = false;
        }
        if (ok === false) {
            logMsg("Falha ao ligar " + link.from + " " + link.fromPort + " <-> " + link.to + " " + link.toPort + " (" + link.cable + ")");
            logMsg("  portas de " + link.from + ": " + describePorts(net.getDevice(names[link.from])));
            logMsg("  portas de " + link.to + ": " + describePorts(net.getDevice(names[link.to])));
        }
    }

    for (i = 0; i < data.devices.length; i++) {
        var target = data.devices[i];
        var targetObj = net.getDevice(names[target.name]);
        if (!targetObj) continue;
        if (target.ipConfig) {
            applyHostIp(targetObj, target.ipConfig);
        }
        if (target.cli) {
            runCli(targetObj, target.cli, target.kind);
        }
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
