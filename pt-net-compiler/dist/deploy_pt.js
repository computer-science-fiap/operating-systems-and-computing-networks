function logMsg(msg) {
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
}

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

    var data = {
  "subnets": [
    {
      "id": 1,
      "name": "LAN_1",
      "routerInterface": "GigabitEthernet0/0",
      "vlanId": 10,
      "networkAddress": "192.168.10.0",
      "cidr": 26,
      "subnetMask": "255.255.255.192",
      "wildcardMask": "0.0.0.63",
      "gateway": "192.168.10.1",
      "firstUsableIp": "192.168.10.1",
      "lastUsableIp": "192.168.10.62",
      "broadcastAddress": "192.168.10.63",
      "totalHosts": 64,
      "usableHosts": 62,
      "pcs": [
        {
          "name": "PC_LAN_1_1",
          "ip": "192.168.10.2",
          "switchPort": "FastEthernet0/1"
        },
        {
          "name": "PC_LAN_1_2",
          "ip": "192.168.10.3",
          "switchPort": "FastEthernet0/2"
        },
        {
          "name": "PC_LAN_1_3",
          "ip": "192.168.10.4",
          "switchPort": "FastEthernet0/3"
        }
      ]
    },
    {
      "id": 2,
      "name": "LAN_2",
      "routerInterface": "GigabitEthernet0/1",
      "vlanId": 20,
      "networkAddress": "192.168.10.64",
      "cidr": 26,
      "subnetMask": "255.255.255.192",
      "wildcardMask": "0.0.0.63",
      "gateway": "192.168.10.65",
      "firstUsableIp": "192.168.10.65",
      "lastUsableIp": "192.168.10.126",
      "broadcastAddress": "192.168.10.127",
      "totalHosts": 64,
      "usableHosts": 62,
      "pcs": [
        {
          "name": "PC_LAN_2_1",
          "ip": "192.168.10.66",
          "switchPort": "FastEthernet0/1"
        },
        {
          "name": "PC_LAN_2_2",
          "ip": "192.168.10.67",
          "switchPort": "FastEthernet0/2"
        },
        {
          "name": "PC_LAN_2_3",
          "ip": "192.168.10.68",
          "switchPort": "FastEthernet0/3"
        }
      ]
    },
    {
      "id": 3,
      "name": "LAN_3",
      "routerInterface": "GigabitEthernet0/2",
      "vlanId": 30,
      "networkAddress": "192.168.10.128",
      "cidr": 26,
      "subnetMask": "255.255.255.192",
      "wildcardMask": "0.0.0.63",
      "gateway": "192.168.10.129",
      "firstUsableIp": "192.168.10.129",
      "lastUsableIp": "192.168.10.190",
      "broadcastAddress": "192.168.10.191",
      "totalHosts": 64,
      "usableHosts": 62,
      "pcs": [
        {
          "name": "PC_LAN_3_1",
          "ip": "192.168.10.130",
          "switchPort": "FastEthernet0/1"
        },
        {
          "name": "PC_LAN_3_2",
          "ip": "192.168.10.131",
          "switchPort": "FastEthernet0/2"
        },
        {
          "name": "PC_LAN_3_3",
          "ip": "192.168.10.132",
          "switchPort": "FastEthernet0/3"
        }
      ]
    }
  ],
  "layout": {
    "backbone": null,
    "routers": [
      {
        "x": 580,
        "y": 90
      }
    ],
    "subnets": [
      {
        "switchPos": {
          "x": 220,
          "y": 260
        },
        "pcPositions": [
          {
            "x": 110,
            "y": 420
          },
          {
            "x": 220,
            "y": 485
          },
          {
            "x": 330,
            "y": 420
          }
        ]
      },
      {
        "switchPos": {
          "x": 580,
          "y": 260
        },
        "pcPositions": [
          {
            "x": 470,
            "y": 420
          },
          {
            "x": 580,
            "y": 485
          },
          {
            "x": 690,
            "y": 420
          }
        ]
      },
      {
        "switchPos": {
          "x": 940,
          "y": 260
        },
        "pcPositions": [
          {
            "x": 830,
            "y": 420
          },
          {
            "x": 940,
            "y": 485
          },
          {
            "x": 1050,
            "y": 420
          }
        ]
      }
    ]
  }
};
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
