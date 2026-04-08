# Command Checker

Executa comandos shell para verificar a disponibilidade de serviços.

## Configuração

O checker aceita o seguinte JSON de configuração:

```json
{
  "command": "comando a ser executado",
  "successPattern": "string opcional para verificar na saída",
  "stdoutOnly": false,
  "exactMatch": false
}
```

### Parâmetros

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `command` | Sim | O comando shell a ser executado |
| `successPattern` | Não | String para buscar na saída (stdout/stderr). Se não fornecido, apenas o exit code 0 é considerado sucesso |
| `stdoutOnly` | Não | Se `true`, verifica apenas stdout. Se `false` (padrão), verifica stdout + stderr |
| `exactMatch` | Não | Se `true`, a saída deve ser igual ao `successPattern`. Se `false` (padrão), a saída deve conter o `successPattern` |

## Exemplos

### 1. Verificar apenas exit code (padrão)
```json
{
  "command": "curl -sf http://localhost:8080/health"
}
```
Sucesso se o comando sair com código 0.

### 2. Verificar systemctl (usando successPattern)
```json
{
  "command": "systemctl status nginx.service",
  "successPattern": "active (running)"
}
```
Sucesso se o comando sair com código 0 **E** a saída contiver "active (running)".

### 3. Verificar se processo está rodando
```json
{
  "command": "pgrep -x node > /dev/null",
  "successPattern": ""
}
```

### 4. Verificar arquivo específico
```json
{
  "command": "cat /var/log/myapp.log",
  "successPattern": "ERROR",
  "exactMatch": false
}
```

## Comandos Úteis para systemctl

### Verificar se serviço está ativo e rodando
```json
{
  "command": "systemctl is-active meu-servico.service",
  "successPattern": "active"
}
```

### Verificar múltiplos serviços
```json
{
  "command": "systemctl list-units --type=service --state=active | grep meu-servico",
  "successPattern": "meu-servico.service"
}
```

### Verificar porta TCP (alternativa ao curl)
```json
{
  "command": "timeout 5 bash -c 'echo > /dev/tcp/localhost/8080'",
  "successPattern": ""
}
```

## Notas

- O comando roda com permissões do usuário que executa o backend
- Timeout padrão é 10 segundos (configurável no serviço)
- Saída stderr é incluída na mensagem de erro em caso de falha
