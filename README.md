# Packet Tracer Network Compiler (`pt-net-compiler`)

> Compilador e gerador automático de topologias de rede, cálculo de sub-redes (FLSM/VLSM) e provisionamento via API IPC para o **Cisco Packet Tracer**.

Projeto desenvolvido no âmbito dos estudos de **Sistemas Operacionais e Redes de Computadores** na FIAP (2CCPS).

---

## 📌 Sobre o Projeto

O **Packet Tracer Network Compiler** é uma ferramenta em TypeScript / Node.js que resolve de ponta a ponta o planejamento de endereçamento IPv4 e o desenho da infraestrutura no Cisco Packet Tracer. Ao iniciar, a CLI oferece dois tipos de execução:

| Modo | Para que serve | Entrada |
| --- | --- | --- |
| **🎓 Checkpoint** | Resolve o checkpoint integrador da disciplina (VLSM + 2 roteadores com RIP + servidor) | Os dois RMs da dupla |
| **🧮 Calculadora livre** | Calcula FLSM/VLSM para qualquer bloco e monta uma topologia adaptativa | Bloco IP, nº de sub-redes, modo e PCs |

Os dois modos geram:

- **`deploy_pt.js`**: script ES5 para a API IPC do Packet Tracer. Ele limpa o canvas, cria os equipamentos, conecta os cabos e configura IPs, gateways e roteamento.
- **`cisco_ios.txt`**: comandos Cisco IOS prontos para colar na CLI dos equipamentos. Também servem de plano B se algo falhar no script.

---

## 🚀 Como Executar

### Pré-requisitos

- **Node.js** v18 ou superior e **npm** v9 ou superior
- **Cisco Packet Tracer** v7.x ou v8.x

### Instalação e execução

```bash
cd pt-net-compiler
npm install
npm start          # inicia a CLI interativa
npm test           # roda os testes automatizados
```

Para compilar para JavaScript:

```bash
npm run build
node build/index.js
```

A primeira pergunta da CLI é o tipo de execução:

```
? Qual tipo de execução?
❯ Checkpoint — VLSM pelos RMs da dupla + R1/R2 com RIP + servidor
  Calculadora livre — FLSM/VLSM genérico
```

---

## 🎓 Modo Checkpoint (VLSM + Packet Tracer)

Automatiza o checkpoint integrador: a partir dos dois RMs, calcula o Exercício 1 inteiro e gera a topologia do Exercício 2 pronta para os testes.

### Perguntas da CLI

1. **Matrícula A (RM)**: só os dígitos. O prefixo `RM` também é aceito.
2. **Matrícula B (RM)**
3. **PCs por departamento** (Deptos 1–4): de 1 a 4.
4. **Configurar já o IP de gerência do SW1?** Veja [Teste do switch: antes e depois](#teste-do-switch-antes-e-depois).

### O que é calculado

1. **Parâmetros:**
   - `S = RM_A + RM_B`.
   - `N` = dois últimos dígitos de S, o que dá o bloco `10.N.0.0/16`.
   - A paridade de S define o gateway: par → 1º host; ímpar → penúltimo host.
   - `d1..d5` = cinco últimos dígitos de S, com `Host_i = 20 + d_i × 220`.
2. **VLSM:** ordena do maior para o menor (empates mantêm a ordem dos departamentos) e escolhe o menor prefixo com `2ⁿ − 2 ≥ hosts`.
3. **Endereçamento:**
   - Sub-redes em sequência a partir de `10.N.0.0`.
   - **WAN /30** no próximo bloco livre (R1 = 1º host, R2 = 2º host).
   - **IP de gerência do SW1** = último host válido do Depto 1.
4. **Topologia:**

```
                    WAN /30 (Serial2/0 ↔ Serial2/0, RIP v2)
          ┌──── R1 ─────────────────────────────── R2 ────┐
          │  (Router-PT)                       (Router-PT)│
   ┌──────┼───────┬──────────┬──────────┐                 │
 Fa0/0  Fa1/0   Fa4/0      Fa5/0                        Fa0/0
 cobre  cobre   fibra      fibra                        cobre
   │      │       │          │                            │
  SW1    SW2     SW3        SW4                          SW5
 (2960) (2960) (Switch-PT) (Switch-PT)                  (2960)
   │      │       │          │                            │
  PC1    PC2     PC3        PC4                        Servidor
```

| Equipamento | Detalhe |
| --- | --- |
| R1 e R2 | `Router-PT` (genérico/modular) |
| Deptos 1 e 2 | Switch 2960 ligado nas portas de **cobre** do R1 |
| Deptos 3 e 4 | `Switch-PT` ligado por **cabo de fibra**: as portas `Fa4/0` e `Fa5/0` do Router-PT são de fibra, e o 2960 não tem porta de fibra |
| Servidores (Depto 5) | No R2, com um `Server-PT` (HTTP já vem ligado) |
| Roteamento | `router rip`, `version 2`, `no auto-summary` e `network` da rede classful do bloco |

### Arquivos gerados

Os arquivos ficam em `pt-net-compiler/dist/checkpoint_<RMA>_<RMB>/`. A pasta é ignorada pelo git porque traz os RMs da dupla e pode ser gerada de novo a qualquer momento.

| Arquivo | Conteúdo |
| --- | --- |
| `deploy_pt.js` | Script IPC: cria os dispositivos, liga os cabos em portas explícitas e configura IPs, roteadores e RIP |
| `cisco_ios.txt` | Comandos IOS de R1, R2 e SW1, mais a tabela de IPs dos hosts |
| `exercicio1.md` | Respostas do Exercício 1 (tabelas 1.1, 1.2 e 1.3), interfaces, hosts, explicação do ping ao switch e roteiro dos 5 testes com os IPs da dupla |

### Testes exigidos no Packet Tracer

Todos são feitos a partir do **PC1**. Os IPs exatos estão no `exercicio1.md`.

| # | Ação no PC1 | O que comprova | Resultado esperado |
| --- | --- | --- | --- |
| 1 | `ping <gateway do Depto 1>` | Gateway local ativo | Reply, TTL 255 |
| 2 | `ping <PC2>` | R1 roteia entre as redes | Reply, TTL 127 (1 roteador) |
| 3 | `ping <IP de gerência do SW1>` | Switch com IP responde | Antes: timeout · Depois: Reply |
| 4 | `ping <Servidor>` | WAN + RIP nos 2 roteadores | Reply, TTL 126 (2 roteadores) |
| 5 | **Desktop → Web Browser** → `http://<Servidor>` | Acesso HTTP remoto | Página "Cisco Packet Tracer" |

O 1º pacote de um ping pode dar *Request timed out* enquanto o ARP é resolvido. Isso é normal.

### Teste do switch: antes e depois

O checkpoint pede um print do ping ao SW1 **antes** e **depois** de ele receber o IP de gerência.

- **Respondendo "não" na pergunta 4 (padrão):**
  1. Rode o script e faça o ping ao SW1: ele falha (print do "antes").
  2. Cole na CLI do SW1 o bloco de gerência do `cisco_ios.txt`.
  3. Pingue de novo: ele responde (print do "depois").
- **Respondendo "sim":** o SW1 já sai configurado, com o prompt `SW1#`. Para o "antes":
  1. Na CLI do SW1, rode `configure terminal` → `interface vlan 1` → `shutdown` e faça o ping (falha).
  2. Rode `no shutdown` e pingue de novo (responde).

### Entrega

- Salve o projeto como `Checkpoint_<RMA>_<RMB>.pkt` (o nome é sugerido no fim da execução).
- Anexe as tabelas do `exercicio1.md` e os prints dos 5 testes, incluindo o antes e o depois do teste 3.
- ⚠️ Gere o projeto com os **RMs reais da dupla**: N, a paridade e os tamanhos dos departamentos dependem deles.

---

## 🧮 Modo Calculadora Livre (FLSM/VLSM)

### Perguntas da CLI

1. **Bloco IP base**, por exemplo `192.168.10.0/24` ou `10.0.0.0/16`.
2. **Quantidade de sub-redes** (1 a 24).
3. **Modo de divisão:**
   - **FLSM:** confirme ou personalize o novo prefixo CIDR (ex.: `/26`).
   - **VLSM:** informe o nome e a demanda de hosts de cada sub-rede. A ordenação por maior demanda é automática.
4. **PCs por sub-rede** (1 a 10), para desenhar no canvas.

### Topologia adaptativa

- **Até 3 sub-redes:** 1 roteador Cisco 2911 central, usando as portas nativas `GigabitEthernet0/0`, `0/1` e `0/2`.
- **4 ou mais sub-redes:** um switch de trânsito (`SW-Backbone`, rede `10.255.255.0/24`) e ⌈N/2⌉ roteadores, com as **rotas estáticas cruzadas** injetadas via CLI.

Os arquivos são gerados em `pt-net-compiler/dist/` (`deploy_pt.js` e `cisco_ios.txt`).

---

## 🖥️ Como Aplicar no Cisco Packet Tracer

1. Abra o **Cisco Packet Tracer** com um **arquivo novo, em branco**. O script apaga tudo que estiver no canvas.
2. Vá em **Extensions → Scripting** e crie ou abra um Script Module. O nome do menu varia entre as versões 7 e 8.
3. Cole o conteúdo inteiro do `deploy_pt.js` gerado. Ele já define `main()` e `cleanUp()`.
4. Execute e acompanhe o console do editor. O esperado é uma linha como:
   ```
   Deploy concluido. Dispositivos: 12 | Cabos: 11
   ```
5. Espere uns 30 segundos para o roteamento convergir. No roteador, confira com `show ip route`: as rotas do RIP aparecem com **R**.

### Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `Falha ao ligar <A> <porta> <-> <B> <porta>` no console | Porta inexistente ou de outro tipo na sua versão do PT | O console lista as portas reais dos dois dispositivos. Ajuste `checkpoint/topology.ts` ou use o `cisco_ios.txt` como plano B |
| `Destination host unreachable` vindo do gateway | O IP pingado não existe nesta topologia, por exemplo IPs de outro par de RMs | Use os IPs do `exercicio1.md` gerado para os RMs usados |
| Ping ao servidor falha, mas o ping ao PC2 funciona | O RIP ainda não convergiu | Espere e confira `show ip route` no R1 |
| SW1 não responde, prompt `Switch>` | O IP de gerência não foi aplicado | Cole o bloco de gerência do `cisco_ios.txt` na CLI do SW1 |

---

## 📂 Estrutura do Repositório

```
├── README.md                           # Visão geral e guia de uso
├── docs/
│   └── TECHNICAL_DOCUMENTATION.md      # Documentação técnica detalhada
└── pt-net-compiler/
    ├── src/
    │   ├── index.ts                    # Ponto de entrada: seleção do tipo de execução
    │   ├── modes/
    │   │   ├── checkpoint.ts           # Orquestra o modo Checkpoint
    │   │   └── free.ts                 # Orquestra a calculadora livre
    │   ├── checkpoint/
    │   │   ├── params.ts               # S, N, paridade e hosts a partir dos RMs
    │   │   ├── planner.ts              # VLSM, gateways, WAN /30, gerência e IPs dos hosts
    │   │   ├── topology.ts             # Modelos, interfaces e perfis de switch (cobre/fibra)
    │   │   ├── deployment.ts           # Dispositivos, cabos e CLI de R1/R2/SW1 + cisco_ios.txt
    │   │   ├── prompts.ts              # Perguntas do modo Checkpoint
    │   │   ├── printer.ts              # Tabelas no terminal
    │   │   ├── report.ts               # Relatório exercicio1.md
    │   │   └── planner.test.ts         # Testes (gabarito do enunciado)
    │   ├── core/
    │   │   ├── bitwise.ts              # Aritmética IPv4 bit a bit
    │   │   └── subnet-engine.ts        # Alocação FLSM/VLSM da calculadora livre
    │   ├── compiler/
    │   │   ├── pt-es5-runtime.ts       # Runtime ES5 genérico (dispositivos + cabos explícitos)
    │   │   ├── pt-ipc-builder.ts       # Script ES5 e IOS da calculadora livre
    │   │   └── layout-engine.ts        # Coordenadas no canvas da calculadora livre
    │   ├── cli/
    │   │   ├── prompts.ts              # Perguntas da calculadora livre
    │   │   ├── printer.ts              # Tabela da calculadora livre
    │   │   └── output.ts               # Escrita dos arquivos gerados
    │   └── types/
    │       ├── network.ts              # Tipos da calculadora livre
    │       ├── checkpoint.ts           # Tipos do modo Checkpoint
    │       └── deployment.ts           # Descrição genérica de dispositivos e cabos do PT
    ├── dist/                           # Artefatos gerados (checkpoint_* fica fora do git)
    ├── package.json
    └── tsconfig.json
```

---

## 📖 Documentação Técnica Detalhada

Para a arquitetura, as fórmulas de sub-rede, a API IPC do Packet Tracer e as decisões de topologia, consulte:

👉 **[docs/TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md)**

---

## 📝 Licença

Projeto desenvolvido para fins educacionais no curso de Ciência da Computação da FIAP.
