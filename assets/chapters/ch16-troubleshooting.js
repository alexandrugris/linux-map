/* ch16 — Troubleshooting: a diagnostic playbook */
(function () {
  LX.push({
    id: "troubleshooting",
    title: "When it is broken: a diagnostic playbook",
    tagline: "Symptom → triage → how to read it → fix → why it comes back. Every failure below has a root cause you can name.",
    sections: [
      {
        type: "prose",
        h: "The rules that make diagnosis fast",
        p: [
          "Troubleshooting is not intuition, it is a fixed order of operations that stops you from guessing. Four rules, and every one of them exists because of a specific failure mode engineers actually hit.",
          "<strong>Read the error, all of it.</strong> The last line of a stack trace is where the program gave up; the first is where it stopped making sense. <code>error:</code> is your friend and <code>Something went wrong</code> is a refusal to tell you anything.",
          "<strong>Change one variable at a time.</strong> The urge to try three things at once is strong and it destroys information. If you restart, upgrade and change permissions simultaneously, success tells you nothing about which one mattered.",
          "<strong>Get the timeline before the theory.</strong> <code>journalctl --since</code>, <code>journalctl -b -1</code>, <code>dmesg -T</code> with human timestamps, access logs. Most outages have a start time, and knowing what happened two minutes before it is worth more than any amount of theorising about the present.",
          "<strong>Know the blast radius before you fix it.</strong> A restart that takes three seconds on one service might evict every connection on a load balancer, or block a shutdown hook, or interrupt a database migration half-way. <code>systemctl show nginx -p TimeoutStopUSec -p KillMode</code> answers that in a second."
        ],
        noteTitle: "The first five commands on any broken Linux box",
        note: "<code>systemctl --failed</code> · <code>journalctl -p err -b --no-pager | tail -40</code> · <code>journalctl -k -b | tail -40</code> · <code>df -h</code> and <code>df -i</code> · <code>ps -eo stat,pid,comm | awk '$1 ~ /^D/'</code>. Then <code>free -m</code>, <code>uptime</code>, and the service's own status. This covers the large majority of incidents and takes about twenty seconds.",
        noteKind: "boss"
      },
      {
        type: "prose",
        h: "The network failure triage — the most valuable flow in this chapter",
        p: [
          "“It doesn't work” on a network is one of three completely different bugs wearing the same coat, and the kernel hands you the discriminating information for free if you know where to look. Every network failure resolves to one of these, and the tool that tells them apart is the same one every time.",
          "<strong>Connection refused</strong> means a packet <em>arrived</em> and the host actively rejected it. Something is listening on the port and said no — usually because the process is not running, or is running but not bound to the address you expected (<code>127.0.0.1</code> instead of <code>0.0.0.0</code>). You will see a <code>RST</code> on the wire. <strong>Connection timed out</strong> means packets went into the void — no answer at all, and no rejection. A firewall dropped them, a route does not exist, or the host is down. <strong>No route to host</strong> is the most specific and usually the easiest: your own routing table or ARP resolution failed, so the kernel never even sent the packet.",
          "That distinction tells you where to look. Refused = look at the process. Timed out = look at the path (firewall, routing, NAT). No route = look at your own interface. The diagram below is the flow; commit it to memory rather than the individual commands."
        ]
      },
      {
        type: "diagram",
        h: "Network triage: which failure is it?",
        caption: "Start at the top and follow the evidence, not the hypothesis. The three failure modes are distinguishable from the <b>client side alone</b> with <code>curl -sv</code> and one <code>ss</code> on the server, which is why the first two steps need no SSH at all.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Network failure triage decision tree">
  <rect class="box-a" x="400" y="20" width="300" height="46" rx="9"/>
  <text class="t-accent" x="550" y="48" text-anchor="middle" font-size="15">request fails against host:port</text>

  <path class="ln-a" d="M550,66 L550,100" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="340" y="100" width="420" height="56" rx="9"/>
  <text class="t-sm" x="358" y="124">1 · on the SERVER: is anything listening?</text>
  <text class="t-xs" x="358" y="144">ss -tanp state listening | grep :443  ·  curl -sv http://127.0.0.1:443  (from the server itself)</text>

  <path class="ln" d="M420,156 L420,196" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="300" y="180">nothing listening</text>

  <path class="ln-b" d="M700,128 L830,128" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="840" y="124" font-size="13">REFUSED</text>
  <text class="t-xs" x="840" y="142" font-size="13">the process, not the network</text>

  <rect class="box-b" x="760" y="160" width="310" height="150" rx="10"/>
  <text class="t-bad" x="778" y="184" font-size="14">branch A · refused</text>
  <text class="t-xs" x="778" y="206">· the service is down → journalctl -u x -b -n 50</text>
  <text class="t-xs" x="778" y="226">· it IS running but bound to 127.0.0.1</text>
  <text class="t-xs" x="778" y="242">  → nginx: listen 80; not listen 127.0.0.1:80</text>
  <text class="t-xs" x="778" y="264">· wrong port entirely (443 vs 80)</text>
  <text class="t-xs" x="778" y="284">· the port is bound in a container's netns</text>
  <text class="t-xs" x="778" y="300">  and only published on a different one</text>

  <rect class="box-b" x="40" y="196" width="330" height="150" rx="10"/>
  <text class="t-bad" x="58" y="220" font-size="14">branch C · no route</text>
  <text class="t-xs" x="58" y="242">· wrong interface up?  ip -br addr</text>
  <text class="t-xs" x="58" y="262">· route missing?  ip route get &lt;dest&gt;</text>
  <text class="t-xs" x="58" y="282">· ARP unanswered → wrong subnet mask,</text>
  <text class="t-xs" x="58" y="298">  or the host is really down</text>
  <text class="t-xs" x="58" y="318">· check: ip neigh, ping the gateway</text>

  <path class="ln-a" d="M550,156 L550,196" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="560" y="180">listening, and localhost works</text>

  <rect class="box-w" x="340" y="196" width="420" height="76" rx="9"/>
  <text class="t-sm" x="358" y="220">2 · from the CLIENT: is the packet leaving at all?</text>
  <text class="t-xs" x="358" y="240">ping -c1 &lt;dest&gt;  ·  traceroute / tracepath &lt;dest&gt;</text>
  <text class="t-xs" x="358" y="260">curl -sv --connect-timeout 5 http://&lt;dest&gt;:&lt;port&gt;</text>

  <path class="ln-v" d="M760,234 L900,234 L900,330" marker-end="url(#lm-arrow)"/>
  <rect class="box-w" x="560" y="330" width="510" height="256" rx="10"/>
  <text class="t-warn" x="578" y="354" font-size="15">branch B · timed out — the packet vanished</text>
  <text class="t-sm" x="578" y="380">Check, in this order:</text>
  <text class="t-sm" x="578" y="404">1. <tspan font-weight="700">ufw / iptables / nftables on the server</tspan> — ufw status verbose, then read the rules:</text>
  <text class="t-xs" x="596" y="424">iptables -L -n -v  ·  iptables -t nat -L -n  ·  nft list ruleset</text>
  <text class="t-xs" x="596" y="442">cloud provider security group in front of it — a very common invisible wall</text>
  <text class="t-sm" x="578" y="468">2. <tspan font-weight="700">Which interface is it bound to</tspan> — a socket on 127.0.0.1 is unreachable from anywhere else, ever</text>
  <text class="t-sm" x="578" y="492">3. <tspan font-weight="700">Reverse path filtering</tspan> — rp_filter=1 on a multi-homed or Tailscale host drops asymmetric packets</text>
  <text class="t-sm" x="578" y="516">4. <tspan font-weight="700">NAT / masquerade</tspan> — correct for egress; a missing return route shows up as exactly this</text>
  <text class="t-sm" x="578" y="540">5. <tspan font-weight="700">MTU</tspan> — the signature is small replies fine, TLS or large responses hang forever</text>
  <text class="t-xs" x="596" y="562">ping -M do -s 1400 -c2 &lt;dest&gt; to find the real path MTU; clamp with MSS clamping</text>
  <text class="t-sm" x="578" y="584">6. On the wire, once:  tcpdump -ni any 'tcp port 443'  — did the SYN arrive at all?</text>

  <rect class="box-ok" x="40" y="370" width="330" height="216" rx="10"/>
  <text class="t-ok" x="58" y="394" font-size="15">It reaches, but the app fails</text>
  <text class="t-xs" x="58" y="418">502 / 504 from nginx:</text>
  <text class="t-xs" x="58" y="438">· upstream down — is the app actually running?</text>
  <text class="t-xs" x="58" y="456">· proxy_pass path wrong (the trailing</text>
  <text class="t-xs" x="58" y="472">  slash decides path rewriting)</text>
  <text class="t-xs" x="58" y="492">· unix socket permissions — the</text>
  <text class="t-xs" x="58" y="508">  nginx user cannot traverse to it</text>
  <text class="t-xs" x="58" y="530">TLS errors:</text>
  <text class="t-xs" x="58" y="550">· expired (openssl x509 -enddate)</text>
  <text class="t-xs" x="58" y="568">· wrong chain order, missing intermediate</text>
  <text class="t-xs" x="58" y="584">· SNI mismatch — the cert does not cover the host</text>
</svg>`
      },
      {
        type: "prose",
        h: "A service will not start",
        p: [
          "This is the most common incident and the most over-mismanaged one, because people restart, edit, restart, and eventually fix it by accident without learning why. The exit code tells you which family of failure you are in, and <code>systemctl status</code> tells you the rest.",
          "Start with <code>systemctl status &lt;unit&gt;</code> — it shows the last log lines and the exit code, and the “since when” timestamp tells you whether this is a fresh failure or a restart loop that has been failing for hours. Then <code>journalctl -u &lt;unit&gt; -b -n 100 --no-pager</code> for the full context; add <code>-f</code> and try starting it again. Note the <code>-b</code>: without it you are reading last week's failure, which is the single most common wasted step in service debugging.",
          "Then classify by exit code: <strong>1</strong> is the program's own generic failure (read the log, it will say why), <strong>2</strong> is a bad usage or missing unit file, <strong>126</strong> means the unit is not executable (wrong permissions on the binary), <strong>127</strong> means the executable was not found (wrong <code>ExecStart</code> path, missing interpreter, or a library the loader cannot find), <strong>203/EXEC</strong> is systemd failing to execute it at all (same family, different layer), <strong>200/CHDIR</strong> means the working directory does not exist, and <strong>OOMKILL</strong> means the kernel killed it — which is not a service problem at all, it is a memory problem.",
          "And the two that catch everyone: a config test that passes but a bind that fails because something else holds the port, and a service that starts fine but whose dependencies were not actually started, because systemd's <code>Requires=</code> only orders <em>starting</em>, not readiness."
        ]
      },
      {
        type: "diagram",
        h: "“It won't start” — the decision tree",
        caption: "Read top to bottom. The two exit codes worth memorising are <b>127</b> (the binary itself is not runnable) and <b>OOMKILL</b> (the kernel killed it, which is a capacity problem wearing a service costume). Everything else is in the log.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Decision tree for a service that will not start">
  <rect class="box-a" x="390" y="20" width="320" height="46" rx="9"/>
  <text class="t-accent" x="550" y="42" text-anchor="middle" font-size="15">systemctl start x → job failed</text>
  <text class="t-xs" x="550" y="58" text-anchor="middle">status is failed, or it re-failed in a Restart= loop</text>
  <path class="ln-a" d="M550,66 L550,96" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="330" y="96" width="440" height="44" rx="9"/>
  <text class="t-sm" x="348" y="114">systemctl status x  → read ExecMainStatus / Result</text>
  <text class="t-xs" x="348" y="132">Result=exit-code · timeout · signal · oom-kill · protocol · resources</text>

  <path class="ln" d="M400,140 L400,176" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M550,140 L550,176" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M700,140 L700,176" marker-end="url(#lm-arrow)"/>

  <rect class="box-b" x="60" y="176" width="330" height="120" rx="9"/>
  <text class="t-bad" x="78" y="200" font-size="14">exit 1 — the program said no</text>
  <text class="t-xs" x="78" y="222">The log has the reason. Config</text>
  <text class="t-xs" x="78" y="240">syntax, missing file, bad flag, DB</text>
  <text class="t-xs" x="78" y="258">unreachable, cert unreadable.</text>
  <text class="t-xs" x="78" y="282">Run the binary by hand, same</text>
  <text class="t-xs" x="78" y="298">user: systemd-run -u nginx -p</text>
  <text class="t-xs" x="78" y="314">WorkingDirectory=/ /usr/sbin/nginx -t</text>

  <rect class="box-b" x="410" y="176" width="280" height="120" rx="9"/>
  <text class="t-bad" x="428" y="200" font-size="14">127 / 126 — not runnable</text>
  <text class="t-xs" x="428" y="222">· wrong ExecStart path →</text>
  <text class="t-xs" x="428" y="238">  readlink -f $(command -v nginx)</text>
  <text class="t-xs" x="428" y="258">· missing interpreter in #!</text>
  <text class="t-xs" x="428" y="274">· file not executable / noexec mount</text>
  <text class="t-xs" x="428" y="294">· library the loader cannot find</text>
  <text class="t-xs" x="428" y="310">  → ldd /path/to/bin | grep "not found"</text>

  <rect class="box-b" x="710" y="176" width="330" height="120" rx="9"/>
  <text class="t-bad" x="728" y="200" font-size="14">OOMKILL / signal=KILL</text>
  <text class="t-xs" x="728" y="222">Not a service bug. The kernel</text>
  <text class="t-xs" x="728" y="240">killed it under memory pressure.</text>
  <text class="t-xs" x="728" y="262">dmesg -T | grep -i "killed process"</text>
  <text class="t-xs" x="728" y="282">free -m  ·  journalctl -k -b | grep -i oom</text>
  <text class="t-xs" x="728" y="302">On 2 GB, a real memory-hungry</text>
  <text class="t-xs" x="728" y="318">neighbour is often the cause</text>

  <path class="ln-a" d="M550,296 L550,330" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="330" y="330" width="440" height="44" rx="9"/>
  <text class="t-sm" x="348" y="348">still stuck? get the whole picture</text>
  <text class="t-xs" x="348" y="366">journalctl -u x -b -n 200 --no-pager -o short-precise</text>

  <rect class="box-p" x="60" y="330" width="250" height="150" rx="10"/>
  <text class="t-bad" x="78" y="354" font-size="14">config vs runtime</text>
  <text class="t-xs" x="78" y="376">nginx -t   (validates, does not bind)</text>
  <text class="t-xs" x="78" y="396">systemd-analyze verify /etc/systemd/system/x.service</text>
  <text class="t-xs" x="78" y="416">systemctl cat x   — is there a stale</text>
  <text class="t-xs" x="78" y="432">drop-in overriding what you edited?</text>
  <text class="t-xs" x="78" y="456">daemon-reload done? A unit edited by</text>
  <text class="t-xs" x="78" y="472">hand without it keeps the OLD unit.</text>

  <rect class="box-p" x="330" y="394" width="250" height="86" rx="10"/>
  <text class="t-bad" x="348" y="418" font-size="14">port already in use</text>
  <text class="t-xs" x="348" y="440">ss -tanp state listening | grep :443</text>
  <text class="t-xs" x="348" y="460">docker ps / crictl ps — a container may hold it invisibly</text>

  <rect class="box-p" x="600" y="394" width="440" height="86" rx="10"/>
  <text class="t-bad" x="618" y="418" font-size="14">starts, then dies immediately</text>
  <text class="t-xs" x="618" y="440">Type=oneshot with RemainAfterExit, or a dependency that finished</text>
  <text class="t-xs" x="618" y="460">→ systemctl status shows “dead (finished)”. That is normal, not a failure.</text>

  <rect class="box-ok" x="60" y="504" width="980" height="122" rx="10"/>
  <text class="t-ok" x="78" y="528" font-size="15">Before you restart anything that is currently working</text>
  <text class="t-sm" x="78" y="552">systemctl show x -p NRestarts -p ExecMainStartTimestamp -p ActiveState</text>
  <text class="t-xs" x="78" y="576">A unit that has been up for months and restarts cleanly is a unit whose outage you are choosing. A unit that has restarted</text>
  <text class="t-xs" x="78" y="596">nine times in an hour is telling you something, and journalctl -u x -b -1 is where it is written down. Fix the cause</text>
  <text class="t-xs" x="78" y="616">before the restart, or you will be back here on the same page next week with less evidence.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Slow, full, and out of memory",
        p: [
          "Three distinct resource problems that get conflated because they all present as “the machine is slow”. The first question is always the same: is anything actually using CPU? Because load average does not mean CPU, and acting on the wrong one wastes an hour.",
          "<strong>High load with high CPU</strong> is a process problem. <code>ps -eo pid,comm,%cpu --sort=-%cpu | head</code> finds it. Check whether it is one process or many — many is a fork bomb or a runaway job queue, one is usually a loop, a GC thrash, or an interrupt storm where the time is accounted to <code>irq/</code> or <code>softirq/</code> rather than to any process name.",
          "<strong>High load with idle CPU</strong> is blocked I/O, and it is the case people misdiagnose most often. The evidence is D-state processes: <code>ps -eo stat,wchan:30,comm | awk '$1 ~ /^D/'</code>. A task in D is waiting on a device that is not answering — a dead NFS mount, a degraded RAID array, a full disk blocking writes, or an iSCSI target that went away. You cannot kill it, which is why restarting the application does nothing and restarting the machine hides the cause. <code>/proc/pressure/io</code> confirms it independently.",
          "<strong>Out of memory</strong> needs two questions: is it the machine or a limit? <code>free -m</code> plus <code>dmesg -T | grep -i oom</code> answers the machine. If the kernel log says <code>Out of memory: Killed process N (name)</code> with a total, that is a host-level OOM. If instead a process died with no such line, or if you are in a container or unit, the limit is a cgroup one — and on your Ubuntu 18.04 box that is v1, so check <code>memory.limit_in_bytes</code> and <code>memory.max_usage_in_bytes</code> in the unit's cgroup.",
          "One warning specific to small servers: <strong>swap on a 2 GB machine converts an OOM kill into thrash</strong>. A process that needs 300 MB of anonymous memory will happily page it out and in against a disk, making the whole box unresponsive without killing anything. If you must have swap, a low swappiness is better than none; but the actual fix is memory or a limit, not more swap."
        ]
      },
      {
        type: "diagram",
        h: "The disk is full — and the three ways it lies to you",
        caption: "<code>df</code> lies in exactly three situations, and all three are common: deleted files still held open, mounts nested inside each other so <code>df</code> double-counts, and inodes exhausted while bytes remain. Each has a different tool and a different fix. The fourth box is the one people forget — a full disk is often caused by a <b>delete that never completed</b>.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="Disk full triage including deleted open files, nested mounts and inode exhaustion">
  <rect class="box-a" x="390" y="20" width="320" height="46" rx="9"/>
  <text class="t-accent" x="550" y="42" text-anchor="middle" font-size="15">df -h says the filesystem is full</text>
  <path class="ln-a" d="M550,66 L550,96" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="330" y="96" width="440" height="46" rx="9"/>
  <text class="t-sm" x="348" y="114">which filesystem? df -hT  ·  findmnt  ·  du -x -h --max-depth=1 /</text>
  <text class="t-xs" x="348" y="132">note -x: stay on one filesystem, or du walks into mounts and lies</text>

  <path class="ln" d="M400,142 L400,180" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M550,142 L550,180" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M700,142 L700,180" marker-end="url(#lm-arrow)"/>

  <rect class="box-b" x="40" y="180" width="340" height="196" rx="10"/>
  <text class="t-bad" x="58" y="204" font-size="15">1 · deleted but still open</text>
  <text class="t-xs" x="58" y="226">A file was unlinked while a process</text>
  <text class="t-xs" x="58" y="242">still holds it. df counts it, du</text>
  <text class="t-xs" x="58" y="258">does not, and it is invisible to both.</text>
  <text class="t-xs" x="58" y="280">lsof +L1</text>
  <text class="t-xs" x="58" y="298">/proc/*/fd | grep deleted</text>
  <text class="t-xs" x="58" y="320">Classic: rotated nginx or journald log</text>
  <text class="t-xs" x="58" y="336">that a daemon still writes to.</text>
  <text class="t-xs" x="58" y="356">Fix: restart the holder, or</text>
  <text class="t-xs" x="58" y="372">logrotate copytruncate.</text>
  <text class="t-xs" x="58" y="368"></text>
  <text class="t-xs" x="58" y="368" font-size="1"></text>

  <rect class="box-b" x="400" y="180" width="340" height="196" rx="10"/>
  <text class="t-bad" x="418" y="204" font-size="15">2 · inodes exhausted</text>
  <text class="t-xs" x="418" y="226">df -h shows space free, but</text>
  <text class="t-xs" x="418" y="242">df -i shows Use%=100%.</text>
  <text class="t-xs" x="418" y="262">Every new file fails with</text>
  <text class="t-xs" x="418" y="278">ENOSPC even though bytes remain.</text>
  <text class="t-xs" x="418" y="300">Cause: one directory with</text>
  <text class="t-xs" x="418" y="316">millions of tiny files —</text>
  <text class="t-xs" x="418" y="332">session dirs, mail spools,</text>
  <text class="t-xs" x="418" y="348">a chatty container log dir.</text>
  <text class="t-xs" x="418" y="368">ext4 default is fine; ext3 with</text>
  <text class="t-xs" x="418" y="384">small inodes and a 19 GB disk is not.</text>

  <rect class="box-b" x="760" y="180" width="310" height="196" rx="10"/>
  <text class="t-bad" x="778" y="204" font-size="15">3 · it is not that filesystem</text>
  <text class="t-xs" x="778" y="226">Nested mounts double-count in du.</text>
  <text class="t-xs" x="778" y="246">Also: the boot disk filled by</text>
  <text class="t-xs" x="778" y="262">/var while your data lives on</text>
  <text class="t-xs" x="778" y="278">another volume.</text>
  <text class="t-xs" x="778" y="300">ncdu -x / is the honest answer.</text>
  <text class="t-xs" x="778" y="320">Always check /var first on Debian:</text>
  <text class="t-xs" x="778" y="336">logs, apt cache, containers.</text>

  <rect class="box-w" x="40" y="400" width="1030" height="186" rx="10"/>
  <text class="t-warn" x="58" y="424" font-size="15">4 · what actually fills a Linux server</text>
  <text class="t-sm" x="58" y="450">journald        — uncapped, it reached 1.8 GB on this box once. Check journalctl --disk-usage, set SystemMaxUse, then vacuum.</text>
  <text class="t-sm" x="58" y="476">/var/log        — old logs and .gz rotations nobody deleted. logrotate keeps them; someone must prune them.</text>
  <text class="t-sm" x="58" y="502">/var/lib/containerd — image layers plus every dead container's writable layer. nerdctl system prune / crictl rmi --prune.</text>
  <text class="t-sm" x="58" y="528">/var/lib/docker   — same story, plus the build cache and volumes nobody mounted again.</text>
  <text class="t-sm" x="58" y="554">/var/cache/apt   — apt-get clean, or a periodic timer. Trivially reclaimable, almost always forgotten.</text>
  <text class="t-xs" x="58" y="578">On your 19 GB disk, 16 unpruned docroot backups were holding ~374 MB. Not an emergency — but the pattern is how disks fill: nothing here is huge, and all of it is permanent.</text>
</svg>`
      },
      {
        type: "diagram",
        h: "The restart loop",
        caption: "Most incidents are this loop re-entered by a human. The bottom row is the only place worth stopping: a service that works fine on its own and fails only when started by systemd is nearly always a <b>permission, working directory, environment or hardening</b> problem, not a code problem.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Restart loop cycle and how to break it">
  <rect class="box-b" x="40" y="30" width="230" height="60" rx="10"/>
  <text class="t-bad" x="58" y="54" font-size="14">it broke</text>
  <text class="t-xs" x="58" y="74">user sees 502, timeout, or nothing</text>
  <path class="ln-b" d="M270,60 L340,60" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-w" x="340" y="30" width="230" height="60" rx="10"/>
  <text class="t-warn" x="358" y="54" font-size="14">restart it</text>
  <text class="t-xs" x="358" y="74">hoping the transient cause passed</text>
  <path class="ln" d="M455,90 L455,130" marker-end="url(#lm-arrow)"/>

  <rect class="box-a" x="340" y="130" width="230" height="60" rx="10"/>
  <text class="t-accent" x="358" y="154" font-size="14">works for 4 minutes</text>
  <text class="t-xs" x="358" y="174">the original trigger was transient</text>
  <path class="ln-a" d="M340,160 L270,160" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="40" y="130" width="230" height="60" rx="10"/>
  <text class="t-bad" x="58" y="154" font-size="14">it breaks again</text>
  <text class="t-xs" x="58" y="174">the real cause was never touched</text>
  <path class="ln-b" d="M155,190 L155,90" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>

  <path class="ln-ok" d="M600,60 L680,60" marker-end="url(#lm-arrow-ok)" stroke="var(--ok)"/>
  <text class="t-ok" x="600" y="46" font-size="13">instead</text>

  <rect class="box-ok" x="680" y="20" width="390" height="270" rx="10"/>
  <text class="t-ok" x="698" y="46" font-size="15">break it with evidence</text>
  <text class="t-sm" x="698" y="72">1. Get the last failure, not the current state</text>
  <text class="t-xs" x="716" y="92">journalctl -u x -b -1 -n 200   (previous boot)</text>
  <text class="t-xs" x="716" y="108">journalctl -u x --since "-30min"</text>
  <text class="t-sm" x="698" y="136">2. Find what ELSE changed at that moment</text>
  <text class="t-xs" x="716" y="156">journalctl --since "-1h" -p notice | less   (all units)</text>
  <text class="t-xs" x="716" y="172">apt history / /var/log/apt/history.log</text>
  <text class="t-xs" x="716" y="188">last reboot / last login: who touched this?</text>
  <text class="t-sm" x="698" y="216">3. Reproduce it by hand, with the same context</text>
  <text class="t-xs" x="716" y="236">systemd-run --uid=nginx --pty -p WorkingDirectory=/ \\</text>
  <text class="t-xs" x="716" y="252">    -- /usr/sbin/nginx -g 'daemon off;'</text>
  <text class="t-xs" x="716" y="270">Same user, same cwd, same environment, no unit file.</text>
  <text class="t-sm" x="698" y="296">4. If it only fails under systemd, compare contexts:</text>
  <text class="t-xs" x="716" y="314">Environment, EnvironmentFile, User, Group, WorkingDirectory,</text>
  <text class="t-xs" x="716" y="330">UMask, and every hardening directive you added.</text>
  <text class="t-xs" x="716" y="348">systemctl show x -p User -p Group -p WorkingDirectory -p Environment -p UMask</text>
  <text class="t-xs" x="716" y="366">systemd-analyze security x</text>
  <text class="t-xs" x="716" y="282" font-size="1"></text>
  <text class="t-xs" x="716" y="282"></text>
  <text class="t-xs" x="716" y="284"></text>
</svg>`
      },
      {
        type: "prose",
        h: "DNS: which layer is lying",
        p: [
          "DNS failures are almost always one of five caches telling a different story, and the fix is always to walk the layers rather than flush them. On a modern Ubuntu box the layers are: the application, glibc's resolver, <code>/etc/hosts</code>, <code>/etc/resolv.conf</code>, systemd-resolved on 127.0.0.53, its own cache and split-DNS logic, and then whatever upstream resolver you have configured.",
          "The mistake everybody makes is editing <code>/etc/resolv.conf</code>. On a systemd-resolved system that file is a symlink into <code>/run</code>, and resolved rewrites it — which is why hand-written nameservers vanish and it feels like the machine is ignoring you. Use <code>resolvectl</code> to see what is actually configured, <code>resolvectl query &lt;name&gt;</code> to ask it directly, and if you must edit a file, edit <code>/etc/systemd/resolved.conf</code> and restart resolved.",
          "To isolate which layer is wrong, escalate outward: <code>getent hosts example.com</code> (glibc's view, honours <code>/etc/hosts</code> and nsswitch), then <code>resolvectl query example.com</code> (resolved's view), then <code>dig example.com</code> (bypasses both and asks the configured server), then <code>dig @1.1.1.1 example.com</code> (a known-good resolver), then <code>dig +trace example.com</code> (walks delegation from the root). Where it first goes wrong tells you exactly which component is at fault."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The escalation ladder — each step removes one layer between you and the answer",
        code:
`# ---- 0. is it DNS at all? separate name resolution from connectivity ----
getent hosts example.com          # resolves via NSS/glibc, honours /etc/hosts
curl -sv https://93.184.216.34/ -H 'Host: example.com'   # bypass DNS entirely
# if the IP works and the name does not, stop looking at nginx/TLS/firewall

# ---- 1. what does this machine think its resolver is? ----
resolvectl status | head -20
resolvectl query example.com
cat /run/systemd/resolve/stub-resolv.conf   # what /etc/resolv.conf actually points at
grep ^nameserver /etc/resolv.conf
grep ^search /etc/resolv.conf              # Tailscale adds a search domain here

# ---- 2. ask the resolver directly, and look at the flags ----
dig example.com
#   +short            one-line answer
#   @1.1.1.1          ask a specific server, ignoring your config
#   +trace            walk delegation from the root — the definitive view
#   +tcp              force TCP; see below for the TC flag
#   -x 1.2.3.4        reverse lookup (PTR)

# ---- 3. reading the answer (the header is where the truth is) ----
#   status: NOERROR = the name exists
#           NXDOMAIN = the name does not exist (check the zone, not your client)
#           SERVFAIL = the server tried and failed — DNSSEC, zone not loaded, etc.
#   flags:  aa = authoritative answer
#          rd = recursion desired, ra = recursion available
#          tc = TRUNCATED -> the UDP response was too big
#          -> retry with +tcp (this is normal for DNSSEC and big responses)

# ---- 4. is my own authoritative server the problem? ----
dig @127.0.0.1 example.com +noall +answer +comments
dig @ns1.example.com example.com AXFR   # if it transfers, your zone is served correctly
dig example.com SOA                       # compare the serial with the file
systemctl reload named ; tail -20 /var/log/syslog | grep named
rndc status ; rndc zonestatus example.com

# ---- 5. hosts file, and nsswitch ordering ----
grep example /etc/hosts
getent ahostsv4 example.com               # shows every address it would return
grep ^hosts /etc/nsswitch.conf            # nss: myhostname dns [!UNAVAIL=return] files`
      },
      {
        type: "prose",
        h: "Symptom → cause index",
        p: [
          "A lookup table is only useful if you can jump to the right row from a vague complaint. These are the phrasings people actually type, mapped to the chapter that contains the mechanism and the command that settles it.",
          "Two of them deserve special emphasis because they are constantly misdiagnosed. <strong>“Too many open files”</strong> has two different ceilings: <code>RLIMIT_NOFILE</code> per process (check <code>/proc/PID/limits</code>) and <code>fs.file-max</code> system-wide (check <code>/proc/sys/fs/file-max</code>) — raising the wrong one changes nothing. And <strong>“permission denied” on a file that is clearly readable</strong> is almost never the permission bits: it is an ACL, an AppArmor or SELinux denial (look for the LSM message in <code>dmesg</code>), the immutable attribute (<code>lsattr</code>), an NFS mount with <code>root_squash</code>, or a parent directory without the execute bit — which blocks access to a file even when the file itself is world-readable."
        ]
      },
      {
        type: "table",
        cols: ["What you observe", "Most likely cause", "Settle it with"],
        rows: [
          ["“Connection refused”", "Nothing listening on that port, or bound to 127.0.0.1, or the wrong port", "<code>ss -tanp state listening | grep :PORT</code> on the server"],
          ["“Connection timed out”", "Firewall DROP, wrong security group, no NAT return, bad MTU, host down", "<code>curl -sv</code> + <code>tcpdump -ni any</code> + <code>ip route get</code>"],
          ["“No route to host”", "Interface down, no route, or ARP failure", "<code>ip -br addr</code> · <code>ip route get DST</code> · <code>ip neigh</code>"],
          ["Works on localhost, not remotely", "Bound to 127.0.0.1, or a firewall on the server, or on your laptop", "<code>ss -tanp</code> shows the bind address; check both hosts"],
          ["Service will not start", "Config, missing file, bad ExecStart, port taken, OOM", "<code>systemctl status</code> + <code>journalctl -u x -b -n 100</code>"],
          ["Service restarts repeatedly", "A dependency keeps failing; crash loop on bad config", "<code>journalctl -u x -b -1</code> — the previous boot's log"],
          ["High load, low CPU", "D-state processes: blocked on dead or slow I/O", "<code>ps -eo stat,wchan:30,comm | awk '$1 ~ /^D/'</code>"],
          ["High load, high CPU, no obvious process", "Interrupt/softirq storm, or a kernel thread", "<code>top</code> → %Cpu(s) line: check <code>irq</code>/<code>softirq</code> fields"],
          ["Killed, nothing in the log", "The kernel OOM killer (your userspace logs nothing)", "<code>dmesg -T | grep -i 'killed process'</code>"],
          ["Disk full but nothing big found", "Deleted-but-open files, or nested mounts", "<code>lsof +L1</code> · <code>du -x --max-depth=1 /</code>"],
          ["Space free, cannot create files", "Inodes exhausted", "<code>df -i</code>"],
          ["“Too many open files”", "RLIMIT_NOFILE (per process) or fs.file-max (system)", "<code>cat /proc/PID/limits</code> · <code>ulimit -n</code>"],
          ["Permission denied on a readable file", "ACL, LSM, immutable bit, root_squash, or no +x on a parent dir", "<code>getfacl</code> · <code>lsattr</code> · <code>dmesg | grep -i denied</code> · <code>namei -l PATH</code>"],
          ["TLS: certificate has expired", "Not renewing; certbot timer failing", "<code>openssl x509 -enddate -noout -in cert.pem</code> · <code>certbot renew --dry-run</code>"],
          ["TLS works for one host, not another", "SNI — the certificate does not cover that name, or the default vhost is answering", "<code>openssl s_client -connect HOST:443 -servername HOST</code>"],
          ["nginx 502", "Upstream not running, wrong path (trailing slash), socket permissions", "<code>curl -sv http://127.0.0.1:PORT/</code> · <code>tail error.log</code>"],
          ["nginx 504", "Upstream too slow; proxy timeouts too tight", "<code>proxy_read_timeout</code> · is the app blocked on its database?"],
          ["DNS resolves from the server, not from my laptop", "Split-horizon DNS, or a search domain resolving it differently", "<code>dig @SERVER name</code> from both places and compare"],
          ["Rebooted itself / went down overnight", "OOM killer, kernel panic, or a failed upgrade", "<code>journalctl -b -1 -p warning</code> — if the boot is listed at all"],
          ["Container will not start", "PID 1 exiting, missing secret, or a readiness probe failing", "<code>crictl logs</code> · <code>kubectl logs --previous</code>"],
          ["Will not boot after an edit", "/etc/fstab, grub.cfg, or the initramfs", "Provider console; comment the entry, or <code>systemd.unit=rescue.target</code>"],
          ["Time is wrong, TLS keeps failing", "No time sync, or the wrong timezone", "<code>timedatectl</code> · <code>chronyc tracking</code> — clock skew breaks TLS and DNS"],
          ["Everything is slow after a deploy", "cgroup limits hit, or swap thrash", "<code>systemctl show x -p MemoryCurrent -p MemoryMax</code> · <code>vmstat 1</code> si/so"]
        ]
      },
      {
        type: "callout",
        kind: "danger",
        title: "Before you reboot",
        text: "A reboot destroys the evidence and converts a diagnosable problem into an anecdote. It is also, on a remote box you reach over Tailscale, the one action that can make things permanently unreachable — because if boot fails, the tunnel that is your only route in does not exist yet either.<br><br>Before you do it, capture: <code>journalctl -b -1 --no-pager &gt; /tmp/prev.log</code> · <code>dmesg -T &gt; /tmp/dmesg.txt</code> · <code>systemctl --failed</code> · <code>df -hT</code> · <code>free -m</code> · <code>ps -eo pid,ppid,stat,etimes,comm</code>. Five commands, ten seconds, and the post-reboot investigation is still possible. And know whether your provider's out-of-band console works <b>before</b> you need it — on a Tailscale-only VPS, that is the difference between a reboot and an outage."
      }
    ],
    takeaways: [
      "<strong>Refused vs timed out vs no-route</strong> is the whole ballgame: process problem, path problem, local problem. Learn it once, use it forever.",
      "A restart loop without evidence is not a fix, it is a delay. <code>journalctl -u x -b -1</code> is the log of the failure you are trying to explain.",
      "High load with idle CPU means <strong>D state</strong> — blocked I/O. Restarting hides it; <code>lsof +L1</code> and <code>df -i</code> find the two disk-full variants everyone misses.",
      "Exit code 127 means the binary is not runnable; <code>OOMKILL</code> means this was never a service problem. Everything else is in the log.",
      "When something works by hand but not under systemd, compare <strong>User, Group, WorkingDirectory, Environment, UMask</strong> before you touch the application.",
      "Editing <code>/etc/resolv.conf</code> on a systemd-resolved system is a no-op. Use <code>resolvectl</code>, and escalate outward with <code>dig @1.1.1.1</code> and <code>+trace</code>.",
      "Capture the previous boot's logs <b>before</b> any reboot, and confirm your provider console works before you need it."
    ],
    glossary: {
      "connection refused": "The host received the packet and rejected it (RST). Something is listening on the port and said no, or nothing is.",
      "connection timed out": "Packets went unanswered. A firewall dropped them, a route is missing, or the host is down. No rejection was returned.",
      "D state": "Uninterruptible sleep — blocked on I/O, cannot be killed. The fingerprint of a high-load-but-idle-CPU machine.",
      "RLIMIT_NOFILE": "The per-process open descriptor limit. Checked in /proc/PID/limits. Distinct from the system-wide fs.file-max.",
      "lsof +L1": "Lists open files with a link count below 1 — deleted files still held open, which occupy disk invisibly.",
      "inode exhaustion": "df -i at 100% while df -h shows free space. Every new file fails with ENOSPC.",
      "OOM killer": "The kernel's victim selection under memory pressure. Logs 'Out of memory: Killed process' to dmesg and nothing to your app's log.",
      "namei -l": "Walks a path component by component showing permissions — the fastest way to find a directory that blocks access to a readable file.",
      "journalctl -b -1": "The previous boot's journal. The most useful command in a restart loop investigation.",
      "systemd-analyze verify": "Checks a unit file for syntax errors and unknown directives — including directives your systemd version does not support.",
      "critical chain": "systemd-analyze critical-chain — the ordered sequence of units that determined total boot time.",
      "split-horizon DNS": "The same name resolving differently depending on which resolver asks. Makes 'it works on the server' and 'it fails on my laptop' both true."
    }
  });
})();