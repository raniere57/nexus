import type { Server, ServerSnapshot } from '../../shared/types.ts';

/**
 * Check a server via SSH and collect CPU, RAM, Disk metrics.
 * Uses sshpass for password-based authentication.
 */
export async function checkServerViaSSH(server: Server): Promise<ServerSnapshot> {
  const timeout = Math.max(Math.floor(server.checkIntervalSeconds / 2), 10);

  // Single command that outputs metrics separated by pipes.
  // Uses vmstat for CPU (more reliable than top across distros),
  // free for RAM, df for disk, /proc/uptime for uptime.
  const remoteScript = [
    // CPU idle from vmstat (1 second sample, 2nd line)
    "CPU_IDLE=$(vmstat 1 2 | tail -1 | awk '{print $15}'); echo $((100 - CPU_IDLE))",
    'echo "|"',
    // RAM percent via /proc/meminfo (universal across all Linux distros)
    "awk '/MemTotal:/{t=$2} /MemAvailable:/{a=$2} /MemFree:/{f=$2} /Buffers:/{b=$2} /^Cached:/{c=$2} END{if(a>0) printf \"%.1f\",(t-a)/t*100; else printf \"%.1f\",(t-f-b-c)/t*100}' /proc/meminfo",
    'echo "|"',
    // Disk percent (root)
    "df / | awk 'NR==2{gsub(/%/,\"\"); print $5}'",
    'echo "|"',
    // Uptime seconds
    "cat /proc/uptime | awk '{print int($1)}'"
  ].join('; ');

  // Use SSHPASS env var instead of -p to avoid quoting issues with passwords
  const sshArgs = [
    'sshpass', '-e',
    'ssh',
    '-o', `ConnectTimeout=${timeout}`,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'PubkeyAuthentication=no',
    '-o', 'PreferredAuthentications=password',
    '-p', String(server.sshPort),
    `${server.sshUser}@${server.host}`,
    remoteScript
  ];

  try {
    const proc = Bun.spawn(sshArgs, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        SSHPASS: server.sshPassword
      }
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      console.error(`[SSH] Failed to check ${server.name} (exit ${exitCode}): ${stderr.trim()}`);
      return {
        serverId: server.id,
        status: 'offline',
        cpuPercent: null,
        ramPercent: null,
        diskPercent: null,
        uptimeSeconds: null,
        lastCheckedAt: new Date().toISOString()
      };
    }

    console.log(`[SSH] Raw output from ${server.name}: ${stdout.trim()}`);

    // Parse the piped output
    const parts = stdout.split('|').map((s: string) => s.trim());
    const cpu = parseFloat(parts[0]);
    const ram = parseFloat(parts[1]);
    const disk = parseFloat(parts[2]);
    const uptime = parseInt(parts[3]);

    return {
      serverId: server.id,
      status: 'online',
      cpuPercent: isNaN(cpu) ? null : cpu,
      ramPercent: isNaN(ram) ? null : ram,
      diskPercent: isNaN(disk) ? null : disk,
      uptimeSeconds: isNaN(uptime) ? null : uptime,
      lastCheckedAt: new Date().toISOString()
    };
  } catch (err: any) {
    console.error(`[SSH] Exception checking ${server.name}:`, err.message);
    return {
      serverId: server.id,
      status: 'offline',
      cpuPercent: null,
      ramPercent: null,
      diskPercent: null,
      uptimeSeconds: null,
      lastCheckedAt: new Date().toISOString()
    };
  }
}
