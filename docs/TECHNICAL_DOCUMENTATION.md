# Documentação Técnica e Arquitetural: pt-net-compiler

Esta documentação fornece uma análise aprofundada da arquitetura, implementação matemática, estrutura de código e integração com a API IPC do Cisco Packet Tracer implementadas no projeto **`pt-net-compiler`**.

---

## 1. Visão Geral do Sistema

O **`pt-net-compiler`** é um compilador de topologias de rede com dois modos de execução, escolhidos na primeira pergunta da CLI (`src/index.ts`):

| Modo | Orquestrador | Domínio |
| --- | --- | --- |
| **Checkpoint**: VLSM a partir dos RMs da dupla, 2 roteadores com RIP v2 e servidor | `modes/checkpoint.ts` | `checkpoint/` (seção 8) |
| **Calculadora livre**: FLSM/VLSM genérico com topologia adaptativa | `modes/free.ts` | `core/subnet-engine.ts` + `compiler/` (seções 4 a 6) |

Na calculadora livre, o ciclo de planejamento e provisionamento é:
1. **Entrada de Requisitos de Rede:** Coleta de parâmetros de rede via CLI interativa (bloco IP base, quantidade de sub-redes, modelo de alocação FLSM ou VLSM, número de hosts por rede e quantidade de PCs).
2. **Motor de Cálculo Bitwise:** Validação e cálculo matemático de endereçamento IP (endereços de rede, broadcast, gateways, máscaras decimais e wildcard, limites de hosts).
3. **Engine de Layout Visual:** Cálculo das coordenadas 2D $(X, Y)$ no plano cartesiano do espaço de trabalho lógico (*Logical Workspace*) do Packet Tracer, prevenindo colisões visuais de rótulos e cabos.
4. **Gerador de Código IPC (ES5/QtScript):** Emissão de um script executável compatível com a API interna do Cisco Packet Tracer que constrói dispositivos, passa o cabeamento, configura interfaces de rede, atribui gateways e injeta rotas estáticas.
5. **Gerador de Configurações Cisco IOS:** Emissão de comandos CLI IOS (`interface`, `ip address`, `no shutdown`, `ip route`, `write memory`) prontos para colar diretamente no terminal do roteador.

---

## 2. Pipeline e Fluxo de Dados

### 2.1. Seleção do modo

```
[ index.ts ] ── select ──┬──▶ modes/checkpoint.ts   (seção 8)
                         └──▶ modes/free.ts         (fluxo abaixo)
```

### 2.2. Calculadora livre

```
[ CLI Interativa ] (@inquirer/prompts)
       │
       ▼ (CompilerInput)
[ Subnet Engine ] ─── Usa ───▶ [ Bitwise Math ]
       │
       ▼ (CalculatedSubnet[])
   ┌───┴────────────────────────────────────────┐
   │                                            │
   ▼                                            ▼
[ Layout Engine ]                      [ Cisco IOS Compiler ]
   │                                            │
   ▼ (CanvasCoordinates)                        ▼
[ PT IPC Builder ]                     dist/cisco_ios.txt
   │
   ▼
dist/deploy_pt.js
   │
   ▼ (Execução no Cisco Packet Tracer)
Topologia provisionada e cabeada em tela com rotas ativas
```

### 2.3. Modo Checkpoint

```
[ checkpoint/prompts ] ── RMs, PCs, gerência ──▶ CheckpointInput
       │
       ▼
[ checkpoint/params ] ── S, N, paridade, d1..d5, Host_i ──▶ CheckpointParams
       │
       ▼
[ checkpoint/planner ] ── usa topology + bitwise ──▶ CheckpointPlan
       │
   ┌───┼───────────────────────────────┬────────────────────────┐
   ▼   ▼                               ▼                        ▼
printer (terminal)       checkpoint/deployment            checkpoint/report
                          │            │                        │
                          ▼            ▼                        ▼
                    PtDeployment   cisco_ios.txt          exercicio1.md
                          │
                          ▼
              compiler/pt-es5-runtime ──▶ deploy_pt.js
```

O `CheckpointPlan` é a fonte única de verdade: terminal, script, IOS e relatório leem dele, e nenhum recalcula endereços ou portas.

---

## 3. Estrutura de Arquivos e Módulos

```
pt-net-compiler/
├── src/
│   ├── index.ts                  # Ponto de entrada: seleção do tipo de execução
│   ├── modes/
│   │   ├── free.ts               # Fluxo da calculadora livre (FLSM / VLSM)
│   │   └── checkpoint.ts         # Fluxo do modo Checkpoint
│   ├── checkpoint/
│   │   ├── params.ts             # S, N, paridade e hosts a partir dos RMs
│   │   ├── planner.ts            # VLSM, gateways, WAN /30, gerência e IPs dos hosts
│   │   ├── topology.ts           # Modelos, interfaces e perfis de switch (cobre/fibra)
│   │   ├── deployment.ts         # Dispositivos, cabos e CLI de R1/R2/SW1 (RIP v2)
│   │   ├── prompts.ts            # Perguntas do modo Checkpoint
│   │   ├── printer.ts            # Tabelas do checkpoint no terminal
│   │   ├── report.ts             # Relatório Markdown do Exercício 1
│   │   └── planner.test.ts       # Testes contra o exemplo do enunciado
│   ├── types/
│   │   ├── network.ts            # Interfaces e tipos de dados do domínio de rede
│   │   ├── checkpoint.ts         # Tipos do modo Checkpoint
│   │   └── deployment.ts         # Descrição genérica de dispositivos e cabos
│   ├── core/
│   │   ├── bitwise.ts            # Operações bit a bit, conversões e fórmulas IPv4
│   │   └── subnet-engine.ts      # Algoritmos de alocação de sub-redes (FLSM / VLSM)
│   ├── cli/
│   │   ├── prompts.ts            # Perguntas da calculadora livre
│   │   ├── printer.ts            # Exibição tabular no terminal
│   │   └── output.ts             # Escrita dos arquivos gerados
│   └── compiler/
│       ├── layout-engine.ts      # Geometria 2D e cálculo de coordenadas no canvas
│       ├── pt-ipc-builder.ts     # Compilador ES5/IPC e gerador Cisco IOS
│       └── pt-es5-runtime.ts     # Runtime ES5 genérico (createLink com portas explícitas)
├── dist/                         # Arquivos gerados pela CLI
│   ├── deploy_pt.js              # Calculadora livre: script do Packet Tracer
│   ├── cisco_ios.txt             # Calculadora livre: comandos IOS
│   └── checkpoint_<RMA>_<RMB>/   # Modo Checkpoint (ignorado pelo git)
│       ├── deploy_pt.js
│       ├── cisco_ios.txt
│       └── exercicio1.md
├── package.json
└── tsconfig.json
```

---

## 4. Análise Detalhada dos Módulos

### 4.1. Tipos e Interfaces (`src/types/network.ts`)

Define os contratos de dados estáticos do compilador:

- **`AllocationMode`**: `'FLSM' | 'VLSM'` — Define se as sub-redes terão tamanho fixo (*Fixed-Length Subnet Mask*) ou variável (*Variable-Length Subnet Mask*).
- **`SubnetRequirement`**: Especificação de cada sub-rede requisitada pelo usuário:
  - `name`: Nome identificador (ex: `LAN_1`, `Financeiro`).
  - `requiredHosts`: Quantidade mínima de hosts úteis necessários.
  - `pcsToCreate`: Quantidade de PCs a serem desenhados e configurados no Packet Tracer.
- **`CompilerInput`**: Objeto raiz consolidado gerado pela CLI:
  - `baseIp`, `baseCidr`, `mode`, `fixedNewCidr?`, `subnets[]`.
- **`PCNode`**: Representação de um computador terminal:
  - `name`: Identificador do PC (ex: `PC_Financeiro_1`).
  - `ip`: Endereço IPv4 atribuído.
  - `switchPort`: Porta designada no switch local (ex: `FastEthernet0/1`).
- **`CalculatedSubnet`**: Dados matemáticos consolidados de cada sub-rede:
  - `id`, `name`, `routerInterface`, `vlanId`, `networkAddress`, `cidr`, `subnetMask`, `wildcardMask`, `gateway`, `firstUsableIp`, `lastUsableIp`, `broadcastAddress`, `totalHosts`, `usableHosts`, `pcs[]`.

---

### 4.2. Aritmética Bit a Bit (`src/core/bitwise.ts`)

Converte endereços IPv4 para representação inteira de 32 bits sem sinal (*unsigned 32-bit integer*), permitindo cálculos exatos através de operadores bitwise do JavaScript:

- **`ipToInt(ip: string): number`**: Divide o octeto em 4 partes numéricas e desloca cada octeto via bitwise shift:
  $$\text{int} = ((O_1 \ll 24) \mid (O_2 \ll 16) \mid (O_3 \ll 8) \mid O_4) \ggg 0$$
  O operador `>>> 0` garante que o valor seja tratado como um inteiro sem sinal de 32 bits no JavaScript.
- **`intToIp(int: number): string`**: Realiza a operação inversa, isolando cada bloco de 8 bits:
  $$[(int \ggg 24) \ \& \ 255, (int \ggg 16) \ \& \ 255, (int \ggg 8) \ \& \ 255, int \ \& \ 255].\text{join}('.')$$
- **`cidrToMask(cidr: number): string`**: Calcula a máscara decimal através do deslocamento de bits ligados:
  $$\text{maskInt} = (\sim 0 \ll (32 - \text{cidr})) \ggg 0$$
- **`cidrToWildcard(cidr: number): string`**: Calcula a máscara curinga (usada em ACLs e OSPF) invertendo a máscara de sub-rede:
  $$\text{wildcardInt} = \sim \text{maskInt} \ggg 0$$
- **`hostsToCidr(requiredHosts: number): number`**: Determina o menor prefixo de sub-rede suficiente para suportar a quantidade de hosts úteis somada a 3 endereços obrigatórios (Rede, Broadcast e Gateway):
  $$\text{totalNeeded} = \text{requiredHosts} + 3$$
  $$\text{hostBits} = \lceil \log_2(\text{totalNeeded}) \rceil$$
  $$\text{cidr} = 32 - \max(\text{hostBits}, 2)$$
- **`usableHostsToCidr(requiredHosts: number): number`** (modo Checkpoint): regra de livro, com o gateway contado entre os hosts:
  $$\text{hostBits} = \max(2, \lceil \log_2(\text{requiredHosts} + 2) \rceil), \quad \text{cidr} = 32 - \text{hostBits}$$
- **`classfulNetwork(ip: string): string`**: rede classful (A/B/C) do endereço. É usada no `network` do RIP.
- **`normalizeNetworkAddress(ip: string, cidr: number): number`**: Aplica uma operação lógica `AND` entre o IP informado e a máscara do CIDR para encontrar o endereço base de rede correspondente, corrigindo entradas com IPs de host informados como endereço de rede.

---

### 4.3. Motor de Sub-redes (`src/core/subnet-engine.ts`)

Executa o algoritmo de cálculo de blocos:

1. **Ordenação por Demanda (Regra VLSM):**
   - No modo **VLSM**, as requisições são obrigatoriamente ordenadas em ordem decrescente de `requiredHosts`. Esse ordenamento garante alocação contígua sem fragmentação do espaço de endereçamento.
   - No modo **FLSM**, a ordem fornecida pelo usuário é mantida, e todas as sub-redes utilizam o `fixedNewCidr`.
2. **Cálculo de Limites de Bloco:**
   - O tamanho do bloco é definido por $2^{(32 - \text{targetCidr})}$.
   - O endereço de broadcast é $(\text{networkInt} + \text{blockSize} - 1) \ggg 0$.
   - O sistema valida se `broadcastInt <= maxBaseBlockIp`. Caso ultrapasse o limite do bloco base fornecido, lança uma exceção com mensagem de erro amigável.
3. **Distribuição de IPs:**
   - **Gateway:** Atribuído ao primeiro endereço útil ($\text{networkInt} + 1$).
   - **PCs:** Alocados consecutivamente a partir de $\text{gatewayInt} + 1 + p$.
   - **Broadcast:** Último endereço do bloco.
   - O ponteiro `currentNetworkPointer` avança para $(\text{broadcastInt} + 1) \ggg 0$ para a próxima sub-rede.

---

### 4.4. Motor de Layout Visual (`src/compiler/layout-engine.ts`)

O Packet Tracer utiliza um sistema de coordenadas cartesiano bidimensional $(X, Y)$ onde o topo esquerdo é a origem. O `layout-engine.ts` calcula dinamicamente o posicionamento estético dos equipamentos no canvas lógico:

- **Espaçamento Horizontal (`subnetSpacingX = 360`):** Garante espaço suficiente entre switches adjacentes para acomodar até 10 PCs por sub-rede sem que os rótulos de nomes e IPs colidam.
- **Espaçamento de PCs (`pcSpacingX = 110`):** Espaçamento horizontal individual entre computadores da mesma sub-rede, centralizados sob o respectivo switch.
- **Desnível Vertical Alternado (Staggering):**
  - PCs em índices pares: $Y = 460$ (ou $420$ em topologia monoroteador).
  - PCs em índices ímpares: $Y = 525$ (ou $485$ em topologia monoroteador).
  - Essa alternância evita que as etiquetas de texto dos PCs adjacentes se sobreponham na tela.
- **Cálculo de Roteadores e Backbone:**
  - **Monoroteador ($\le 3$ sub-redes):** Posiciona 1 `Core-Router` no ponto central superior ($X = \text{centerX}, Y = 90$).
  - **Multirroteador ($> 3$ sub-redes):**
    - `SW-Backbone`: Posicionado no topo ($X = \text{centerX}, Y = 45$).
    - Roteadores: Posicionados a $Y = 175$, centralizados acima de cada par de sub-redes que atendem.

---

### 4.5. Compilador Packet Tracer IPC e Cisco IOS (`src/compiler/pt-ipc-builder.ts`)

Gera dois artefatos independentes a partir da mesma base matemática:

1. **`compileToPacketTracerES5(subnets: CalculatedSubnet[]): string`**:
   - Emite código JavaScript ES5/QtScript puro contendo o payload de rede e coordenadas embutido como JSON.
   - Executa rotinas de limpeza, instanciação, cabeamento, configuração de interfaces, injeção de rotas e renomeação.
2. **`compileToCiscoIOS(subnets: CalculatedSubnet[]): string`**:
   - Emite o script de comandos CLI padrão da Cisco.
   - Gera blocos por roteador com configuração de interfaces físicas, descrições, endereçamento, `no shutdown` e rotas estáticas `ip route`.

---

## 5. Topologia Adaptativa: De 1 a N Sub-redes

O roteador padrão do Cisco Packet Tracer utilizado no projeto é o **Cisco 2911**, que possui nativamente **3 portas GigabitEthernet** (`GigabitEthernet0/0`, `0/1` e `0/2`).

Para superar esse limite de forma escalável e sem exigir módulos seriais manuais ou placas extras, o compilador adota uma **arquitetura adaptativa**:

### 5.1. Modo Monoroteador (1 a 3 Sub-redes)

- **Topologia:** Estrela simples.
- **Equipamento Central:** 1 roteador `Core-Router`.
- **Portas Utilizadas:**
  - Sub-rede 1: `GigabitEthernet0/0` $\rightarrow$ Switch LAN 1
  - Sub-rede 2: `GigabitEthernet0/1` $\rightarrow$ Switch LAN 2
  - Sub-rede 3: `GigabitEthernet0/2` $\rightarrow$ Switch LAN 3
- **Roteamento:** Direto (todas as redes são diretamente conectadas ao mesmo roteador; nenhuma rota estática é necessária).

### 5.2. Modo Multirroteador com Switch de Backbone (4 ou mais Sub-redes)

Quando há mais de 3 sub-redes, o sistema distribui a carga em múltiplos roteadores $R = \lceil N / 2 \rceil$:

```
                            [ SW-Backbone ] (10.255.255.0/24)
                           /               \
            (Gi0/0: .1)   /                 \   (Gi0/0: .2)
                 [ Core-Router-1 ]       [ Core-Router-2 ]
                 /             \         /             \
         (Gi0/1)/       (Gi0/2) \ (Gi0/1)/       (Gi0/2)\
            [SW 1]             [SW 2]  [SW 3]             [SW 4]
            | | |              | | |   | | |              | | |
            PCs                PCs     PCs                PCs
```

- **Rede de Trânsito / Backbone:** `10.255.255.0/24`.
- **Switch de Interconexão:** `SW-Backbone` (Cisco 2960-24TT).
- **Alocação por Roteador:**
  - Porta `GigabitEthernet0/0`: Uplink conectado ao `SW-Backbone` com IP `10.255.255.X/24` (onde $X$ é o índice do roteador).
  - Portas `GigabitEthernet0/1` e `GigabitEthernet0/2`: Conectadas aos Switches das LANs atribuídas àquele roteador.
- **Tabela de Roteamento Estático Cruzado:**
  - O compilador calcula automaticamente todas as rotas estáticas necessárias para que qualquer roteador conheça as redes dos outros roteadores via rede de trânsito:
    $$\text{ip route } <\text{rede\_destino}> <\text{mascara}> <\text{ip\_backbone\_do\_roteador\_dono}>$$
  - Exemplo: O `Core-Router-1` (`10.255.255.1`) recebe rotas para a LAN 3 e LAN 4 com *Next-Hop* `10.255.255.2`.

---

## 6. Mecânica Interna no Cisco Packet Tracer (IPC API)

O Cisco Packet Tracer implementa internamente o ambiente de execução **QtScript** (baseado no padrão ECMAScript 5). A comunicação entre scripts e a simulação de hardware é feita através do objeto global **`ipc`**.

### 6.1. Objetos Principais da API IPC

| Objeto / Método | Descrição |
|---|---|
| `ipc.network()` | Acessa a camada de dados da rede simulada (*Network Data Layer*). Permite listar e obter objetos de dispositivos. |
| `ipc.appWindow().getActiveWorkspace().getLogicalWorkspace()` | Acessa o canvas visual do espaço de trabalho lógico (*Logical Workspace*). Responsável por adicionar, remover e conectar cabos entre dispositivos. |
| `lw.removeDevice(deviceName)` | Remove um dispositivo pelo nome do canvas. |
| `lw.addDevice(typeId, modelName, x, y)` | Instancia um novo dispositivo na tela com modelo e coordenadas. `typeId`: `0` roteador, `1` switch, `8` PC, `9` servidor. |
| `lw.autoConnectDevices(devA, devB)` | Cria automaticamente o link físico entre as primeiras portas livres compatíveis. Usado pela calculadora livre. |
| `lw.createLink(devA, portA, devB, portB, tipo)` | Cria o cabo entre portas **explícitas**. Retorna `false` em caso de falha. Usado pelo modo Checkpoint. Tipos validados: `8100` cobre direto, `8103` fibra, `8106` serial (a 1ª ponta é DCE). |
| `dev.getPortCount()` / `dev.getPortAt(i)` | Enumera as portas reais de um dispositivo. Usado no diagnóstico de cabos que falham. |
| `dev.getPort(portName)` | Obtém a interface de rede física de um dispositivo (ex: `"GigabitEthernet0/0"`, `"FastEthernet0"`). |
| `port.setIpSubnetMask(ip, mask)` | Atribui endereço IP e máscara na interface de rede. |
| `port.setPower(true)` | Liga a porta de rede (equivalente ao comando `no shutdown` no Cisco IOS). |
| `pcObj.setDefaultGateway(gateway)` | Configura o gateway padrão do PC. |
| `routerObj.skipBoot()` | Pula a tela de inicialização do IOS, fazendo o roteador entrar imediatamente no modo operacional CLI. |
| `dev.getCommandLine().enterCommand(cmd)` | Envia um comando diretamente para a CLI do roteador ou switch. Ver o cuidado com o diálogo inicial em 8.4. |
| `devObj.setName(label)` / `devObj.setCustomName(label)` | Altera o rótulo de exibição visual do dispositivo no canvas. |

### 6.2. Ciclo de Execução do `deploy_pt.js` da Calculadora Livre

1. **`clearCanvas(net, lw)`**:
   - Itera de forma decrescente sobre `net.getDeviceCount()` e chama `lw.removeDevice()`, limpando completamente a topologia anterior sem deixar resíduos.
2. **Criação do Backbone e Roteadores**:
   - Se for topologia multirroteador, cria o switch `SW-Backbone` (`addDevice(1, "2960-24TT", x, y)`).
   - Instancia os roteadores Cisco 2911 (`addDevice(0, "2911", x, y)`).
   - Chama `skipBoot()` em cada roteador para liberar imediatamente a CLI.
   - Conecta a interface `GigabitEthernet0/0` de cada roteador ao `SW-Backbone` via `autoConnectDevices` e atribui o IP `10.255.255.X/24`.
3. **Criação dos Switches e Conexão com Roteadores**:
   - Instancia os switches de acesso das sub-redes (`addDevice(1, "2960-24TT", x, y)`).
   - Conecta o roteador correspondente ao switch da LAN via `autoConnectDevices`.
   - Atribui o IP de Gateway e máscara na interface correspondente do roteador e liga a porta (`setPower(true)`).
4. **Criação dos PCs e Cabeamento das LANs**:
   - Para cada sub-rede, instancia os computadores (`addDevice(8, "PC-PT", x, y)`).
   - Conecta cada PC ao seu switch com `autoConnectDevices`.
   - Configura o IP do PC, a máscara de sub-rede e o Gateway com `setIpSubnetMask` e `setDefaultGateway`.
   - Renomeia o PC para incluir o IP no rótulo: `PC_Setor_1 (192.168.10.2)`.
5. **Renomeação dos Switches**:
   - Atualiza o rótulo dos switches com o nome da sub-rede e o Gateway: `Setor (GW: 192.168.10.1)`.
6. **Injeção de Rotas Estáticas via CLI (`injectStaticRoutes`)**:
   - Em topologias com 4 ou mais sub-redes, acessa o terminal virtual de cada roteador via `rObj.getCommandLine().enterCommand()`.
   - Envia os comandos de transição de modo: `no`, `enable`, `configure terminal`.
   - Envia os comandos `ip route <rede> <mascara> <next-hop>` para todas as sub-redes remotas.
   - Salva a configuração com `end` e `write memory`.
7. **Renomeação dos Roteadores**:
   - Renomeia os roteadores após os cabos estarem devidamente conectados, garantindo que o `autoConnectDevices` utilize os identificadores nativos durante o cabeamento.

---

## 7. Instruções de Execução

### 7.1. Compilando o Projeto

```bash
cd pt-net-compiler
npm install
npm run build
npm start
```

### 7.2. Executando no Cisco Packet Tracer

1. Abra o **Cisco Packet Tracer** (versão 7.x ou 8.x) com um **arquivo novo, em branco**. O script remove todos os dispositivos do canvas.
2. Vá em **Extensions → Scripting** e crie ou abra um Script Module. O nome do menu varia entre versões.
3. Cole o conteúdo completo do `deploy_pt.js` gerado (`dist/` ou `dist/checkpoint_<RMA>_<RMB>/`) e execute.
4. Acompanhe o console do editor. Ao final aparece `Deploy concluido. Dispositivos: N | Cabos: M`, e falhas de cabo ou de CLI são registradas antes dessa linha.
5. Aguarde a convergência do roteamento (cerca de 30 s no RIP) e teste com `ping` a partir dos PCs.

---

## 8. Modo Checkpoint

Selecionado no início da CLI. Recebe os dois RMs e produz o projeto completo do checkpoint (VLSM + 2 roteadores). O fluxo foi **validado no Packet Tracer**: os 5 testes do enunciado passaram (gateway, PC2, gerência do SW1, servidor e HTTP).

### 8.1. Cálculo dos parâmetros (`checkpoint/params.ts`)

- `S = RM_A + RM_B`; `N = S mod 100` → bloco base `10.N.0.0/16`.
- `S` par → gateway = 1º host; `S` ímpar → gateway = penúltimo host (último válido − 1).
- `d1..d5` = `S mod 100000` completado com zeros à esquerda; `Host_i = 20 + d_i × 220`. O Depto 5 é o de Servidores (R2).

### 8.2. Plano de endereçamento (`checkpoint/planner.ts`)

- Ordena os departamentos por hosts em ordem decrescente (ordenação estável).
- Prefixo = menor `/n` com `2^(32−n) − 2 ≥ hosts` (`usableHostsToCidr` em `core/bitwise.ts`). Esta regra difere da `hostsToCidr` da calculadora livre, que reserva um IP extra para o gateway.
- Aloca em sequência a partir de `10.N.0.0`. Como os blocos estão em ordem decrescente, cada um começa alinhado e o `/30` da WAN cai no ponteiro seguinte.
- Os IPs dos PCs e do servidor começam no 1º host e pulam o gateway e o IP de gerência do SW1 (último host do Depto 1).

### 8.3. Topologia e deploy (`checkpoint/deployment.ts` + `compiler/pt-es5-runtime.ts`)

O plano vira um `PtDeployment` (`types/deployment.ts`): uma lista declarativa de dispositivos (nome, tipo, modelo, posição, IP opcional, CLI opcional) e de cabos (dispositivo e porta nas duas pontas, mais o tipo de cabo). O runtime é genérico e não conhece regras do checkpoint.

| Roteador | Interface | Ligação | Rede |
| --- | --- | --- | --- |
| R1 | FastEthernet0/0 | cobre direto → SW1 (2960) Gi0/1 | Depto 1 |
| R1 | FastEthernet1/0 | cobre direto → SW2 (2960) Gi0/1 | Depto 2 |
| R1 | FastEthernet4/0 | **fibra** → SW3 (Switch-PT) Fa4/1 | Depto 3 |
| R1 | FastEthernet5/0 | **fibra** → SW4 (Switch-PT) Fa4/1 | Depto 4 |
| R1 | Serial2/0 | serial (DCE, `clock rate 64000`) → R2 Serial2/0 | WAN |
| R2 | FastEthernet0/0 | cobre direto → SW5 (2960) Gi0/1 | Servidores |

Os perfis de switch ficam em `checkpoint/topology.ts` (`SWITCH_PROFILES`):

| Meio | Modelo | Uplink | Portas de acesso | Máx. hosts |
| --- | --- | --- | --- | --- |
| `copper` | `2960-24TT` | `GigabitEthernet0/1` (cabo direto) | `FastEthernet0/1..24` | 24 |
| `fiber` | `Switch-PT` | `FastEthernet4/1` (fibra) | `FastEthernet0/1..3/1` | 4 |

Por isso o prompt limita a 4 PCs por departamento. O planner também garante que o switch de gerência (Depto 1) seja um 2960, porque a gerência usa a SVI `interface vlan 1`.

Roteamento: `router rip` / `version 2` / `no auto-summary` / `network <rede classful do bloco>` nos dois roteadores. Como todo o bloco `10.N.0.0/16` cabe na rede classful `10.0.0.0`, um único `network` anuncia todas as sub-redes. O `no auto-summary` impede que o RIP resuma as sub-redes VLSM pela classe.

### 8.4. Runtime ES5 (`compiler/pt-es5-runtime.ts`)

O `deploy_pt.js` executa quatro fases:

1. **Limpeza:** remove todos os dispositivos do canvas.
2. **Criação:** `lw.addDevice` para cada dispositivo, depois `skipBoot()` e renomeação. O nome real retornado pelo PT é guardado num mapa, usado nas fases seguintes.
3. **Cabeamento:** `lw.createLink` com as portas explícitas. Se falhar, o console registra o cabo e a lista de portas reais dos dois dispositivos (`describePorts`).
4. **Configuração:** IP, máscara e gateway nos hosts via API (`setIpSubnetMask`, `setDefaultGateway`) e envio da CLI para roteadores e switch.

**Cuidado com o diálogo inicial:** só os **roteadores** perguntam *"Would you like to enter the initial configuration dialog? [yes/no]"*. Por isso o `runCli` envia `no` apenas quando `kind === "router"`. Num switch, um `no` solto é interpretado como Telnet ao host "no". O console fica preso tentando resolver o nome e descarta os comandos seguintes. Esse foi o bug que deixava o SW1 sem IP de gerência.

### 8.5. Artefatos

| Arquivo | Gerado por | Conteúdo |
| --- | --- | --- |
| `deploy_pt.js` | `compileDeploymentToES5(buildCheckpointDeployment(plan))` | Topologia completa no PT |
| `cisco_ios.txt` | `compileCheckpointToCiscoIOS(plan)` | CLI de R1, R2 e SW1 (o bloco do SW1 é marcado como manual quando a gerência não é automática), mais a tabela de hosts |
| `exercicio1.md` | `compileCheckpointReport(plan)` | Tabelas 1.1–1.3, interfaces, hosts, configuração RIP, explicação do ping ao switch e roteiro dos testes |

A CLI dos roteadores e do SW1 é gerada uma única vez (`buildRouterCli`, `buildSwitchManagementCli`) e reaproveitada pelos três artefatos.

### 8.6. Testes automatizados (`checkpoint/planner.test.ts`)

Rodam com `npm test` (`node:test` via `tsx`) e cobrem:

- Parâmetros e hosts do exemplo do enunciado (RMs 566966 + 568401 → `10.67.0.0/16`, ímpar).
- S com menos de 5 dígitos (zeros à esquerda) e a regra do 1º host para S par.
- A tabela 1.2 completa, a WAN `10.67.32.0/30` e a gerência `10.67.27.254`, comparadas com o gabarito.
- Hosts que nunca recebem o IP do gateway ou o IP de gerência.
- Topologia: Deptos 1–4 no R1, Servidores no R2, nenhuma porta usada duas vezes.
- Ligação por fibra de `Fa4/0` e `Fa5/0` em Switch-PT.
- O `no` do diálogo inicial enviado só para roteadores.

### 8.7. Lições da validação no Packet Tracer

| Sintoma observado | Causa | Correção |
| --- | --- | --- |
| `Falha ao ligar R1 FastEthernet4/0 <-> SW3 GigabitEthernet0/1` | No Router-PT, `Fa4/0` e `Fa5/0` são módulos de fibra (`PT-ROUTER-NM-1FFE`), e o 2960 não tem porta de fibra | Deptos 3 e 4 passaram a usar Switch-PT com cabo de fibra |
| SW1 com prompt `Switch>` e `Vlan1` sem IP | O `no` do diálogo inicial dos roteadores era enviado também ao switch | `no` só para `kind === "router"` |
| `Destination host unreachable` vindo do gateway | Pings para IPs de outro par de RMs | Usar os IPs do `exercicio1.md` gerado para os RMs usados |
