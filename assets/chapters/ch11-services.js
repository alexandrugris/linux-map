/* ch11 — Services: nginx, BIND, sshd */
(function () {
  LX.push({
    id: "services",
    title: "The services you actually run: nginx, BIND, sshd",
    tagline: "A service is three files — a unit, a config, and the supervision contract between them — and almost every outage is a disagreement about one of the three.",
    sections: [
      {
        type: "prose",
        h: "The shape of a network service",
        p: [
          "On a systemd box a service is not one thing. It is a <strong>supervisor relationship</strong> between three parties, and each of the three can fail independently: systemd owns the unit definition and the lifecycle, the master process owns the listening sockets and the worker pool, and the workers own the actual request handling. Understanding which of the three has stopped is most of the work in any incident.",
          "The master exists for two reasons that are both about <em>not dropping connections</em>. It owns the listening socket, so no client ever sees a refused connection while a restart is happening; and it owns the worker lifecycle, so it can start new workers before retiring old ones. A restart that severs live traffic is a design choice, and for nginx it is a choice you should never make by accident.",
          "The second thing systemd brings is <strong>cgroups</strong>, which turn a process tree into a resource and restart boundary. Every process systemd starts is in one cgroup whether or not it has children, so a runaway can be found and killed as a unit, memory-limited as a unit, and log-attributed as a unit. On this box that is cgroups <strong>v1</strong> — separate controller trees under <code>/sys/fs/cgroup/memory</code> and <code>/sys/fs/cgroup/pids</code>, with <code>MemoryLimitInBytes</code> and <code>PidsLimit</code> as the real files. On cgroup v2 the same unit has one directory with <code>memory.max</code> and <code>pids.max</code>, and <code>systemd show -p MemoryMax</code> shows the v2 name. The unit file does not change; only the plumbing underneath it does."
        ]
      },
      {
        type: "diagram",
        h: "systemd, the master, and the workers",
        caption: "The shape nginx, named and almost every daemonized service have on Linux. systemd knows one main PID and treats the whole cgroup as the unit; the master forks workers and reaps their zombies; workers are interchangeable and hold no state that survives their death. Everything systemd knows about this unit — restart counting, resource limits, log attribution, <code>systemctl stop</code> — applies to <em>the whole box above the dashed line</em>, which is why <code>kill -9</code> on one worker is harmless and <code>kill -9</code> on the master is an outage.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="systemd managing a master process and its worker pool within a cgroup">
  <!-- systemd -->
  <rect class="box-ok" x="30" y="24" width="240" height="72" rx="10"/>
  <text class="t-ok" x="46" y="48" font-size="15">systemd (PID 1)</text>
  <text class="t-sm" x="46" y="68">Type=forking · PIDFile=</text>
  <text class="t-sm" x="46" y="86">/run/nginx.pid</text>

  <path class="ln-ok" d="M270,60 L360,60" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="276" y="50" font-size="13">waits for the PID</text>
  <text class="t-xs" x="276" y="78">to appear, then tracks it</text>

  <!-- cgroup boundary -->
  <rect class="box-v" x="360" y="24" width="710" height="500" rx="12"/>
  <text class="t-violet" x="380" y="50" font-size="15">cgroup: nginx.service — the restart and resource boundary</text>
  <text class="t-xs" x="380" y="70">/sys/fs/cgroup/memory/nginx.service/  (cgroups v1 on this box)</text>

  <!-- master -->
  <rect class="box-p" x="390" y="90" width="300" height="96" rx="10"/>
  <text class="t-bad" x="406" y="114" font-size="15">master process</text>
  <text class="t-sm" x="406" y="136">PID 1234 — the one systemd tracks</text>
  <text class="t-sm" x="406" y="154">owns :80 and :443 (inherited by workers)</text>
  <text class="t-sm" x="406" y="172">reads config, forks, reaps zombies (waitpid)</text>

  <path class="ln-p" d="M540,186 L540,222" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="556" y="208" font-size="13">fork × worker_processes</text>

  <!-- workers -->
  <rect class="box-a" x="390" y="222" width="220" height="76" rx="9"/>
  <text class="t-accent" x="406" y="246" font-size="14">worker 1</text>
  <text class="t-sm" x="406" y="266">accept → parse → serve</text>
  <text class="t-xs" x="406" y="284">no state between requests</text>

  <rect class="box-a" x="630" y="222" width="220" height="76" rx="9"/>
  <text class="t-accent" x="646" y="246" font-size="14">worker 2</text>
  <text class="t-sm" x="646" y="266">accept → parse → serve</text>
  <text class="t-xs" x="646" y="284">crash = exit, master refills</text>

  <rect class="box-a" x="870" y="222" width="180" height="76" rx="9"/>
  <text class="t-accent" x="886" y="246" font-size="14">worker N</text>
  <text class="t-sm" x="886" y="266">auto = nproc</text>
  <text class="t-xs" x="886" y="284">on a 2 vCPU box: 2</text>

  <path class="ln-w" d="M500,298 L500,330" marker-end="url(#lm-arrow-warn)"/>
  <path class="ln-w" d="M740,298 L740,330" marker-end="url(#lm-arrow-warn)"/>

  <!-- signals -->
  <rect class="box-w" x="390" y="330" width="660" height="116" rx="10"/>
  <text class="t-warn" x="406" y="354" font-size="15">signals the master understands</text>
  <text class="t-sm" x="406" y="378">SIGHUP   reload config: new workers start, old workers finish in-flight requests, then exit</text>
  <text class="t-sm" x="406" y="400">SIGQUIT  fast shutdown — kills workers immediately, drops in-flight requests</text>
  <text class="t-sm" x="406" y="422">SIGTERM  graceful shutdown, same as systemctl stop (waited for up to TimeoutStopSec=90s)</text>
  <text class="t-xs" x="406" y="440">systemctl reload nginx sends SIGHUP to the master — the master does the work, systemd does not restart the unit</text>

  <!-- control channel -->
  <path class="ln-ok" d="M390,138 L300,138" marker-end="url(#lm-arrow-ok)" stroke-dasharray="5 4"/>
  <path class="ln-ok" d="M1050,138 L1070,138" marker-end="url(#lm-arrow-ok)" stroke-dasharray="5 4"/>

  <rect class="box" x="30" y="160" width="240" height="110" rx="10"/>
  <text x="46" y="184" font-size="14.5">what systemd enforces</text>
  <text class="t-sm" x="46" y="206">Restart=on-failure</text>
  <text class="t-sm" x="46" y="226">StartLimitIntervalSec=30s</text>
  <text class="t-sm" x="46" y="246">StartLimitBurst=5</text>
  <text class="t-xs" x="46" y="264">a crash loop stops the unit</text>

  <rect class="box" x="30" y="290" width="240" height="120" rx="10"/>
  <text x="46" y="314" font-size="14.5">what systemd cannot know</text>
  <text class="t-sm" x="46" y="336">that a worker is leaking</text>
  <text class="t-sm" x="46" y="356">that the config is wrong but</text>
  <text class="t-sm" x="46" y="376">the process is still alive</text>
  <text class="t-xs" x="46" y="398">this is why nginx -t exists and</text>
  <text class="t-xs" x="46" y="412">must run before every reload</text>

  <rect class="box-b" x="390" y="466" width="660" height="118" rx="10"/>
  <text class="t-bad" x="406" y="490" font-size="15">the PID file, and what happens when it lies</text>
  <text class="t-sm" x="406" y="514">The master writes its PID to /run/nginx.pid after daemonising. systemd waits for that file, then tracks the number in it.</text>
  <text class="t-sm" x="406" y="534">If the file is stale — a crash that skipped cleanup, or a PID reused by an unrelated process — systemd will happily track,</text>
  <text class="t-sm" x="406" y="554">signal and eventually kill the wrong program. That is a real class of incident, not a hypothetical.</text>
  <text class="t-xs" x="406" y="578">Defences: RuntimeDirectory=nginx plus ExecStartPre=/usr/bin/rm -f /run/nginx.pid, and Type=exec for daemons that do not fork.</text>
  <text class="t-xs" x="406" y="592">systemd 248+ can use pidfd for race-free tracking; on systemd 237 (this box) it is PID-file watching, and the default since v232.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Reload, restart, and the difference you will be judged on",
        p: [
          "A <strong>reload</strong> asks a running process to re-read its configuration without losing state: the master keeps the listening sockets, brings up new workers on the new config, and lets the old ones drain what they are holding. No connection is refused, no TLS session is broken, no in-flight request fails. A <strong>restart</strong> stops the process and starts it again, which means the listening socket is closed and reopened — and anything that connects in that window gets a connection refused, because there is no process holding the port.",
          "Every daemon draws that line differently, which is why \"just restart it\" is not always available and \"just reload it\" is not always safe. <code>nginx -s reload</code> is a genuine zero-downtime reload. <code>systemctl reload sshd</code> re-execs the listener with the new config and existing sessions continue untouched, because sshd forks a child per connection and the children are not signalled. <code>rndc reload</code> makes named re-read its zones; a running query in progress is completed against the in-memory tree it started with. <code>systemctl reload cron</code> on Debian simply restarts it, because cron has no reload — so a \"reload\" of cron is a restart, and a cron job in flight gets killed.",
          "There is a third option that people forget exists: <strong>do nothing and let the process pick it up</strong>. A daemon that stats its own config file per request (or re-reads a certificate path per connection) needs no reload at all. This is exactly why the recommended way to renew a TLS certificate is to write the new files and reload nginx — but if nginx were configured to resolve the certificate path at handshake time and you only pointed it at a symlink, you would need neither. The general rule: <strong>the reload exists to make the change take effect immediately, not because the process cannot cope without it</strong>."
        ],
        noteKind: "tip",
        noteTitle: "The sequence that should be muscle memory",
        note: "<code>nginx -t</code> first, every time. A reload with a broken config does not reload — the master logs the error and keeps running the old config, which is the correct behaviour and the reason you will not notice until the next real deploy. Then <code>systemctl reload nginx</code>, then <code>systemctl status nginx</code> and <code>tail /var/log/nginx/error.log</code>. On this box a deploy is <code>rsync</code> into <code>/var/www/html</code>, so <code>nginx -t</code> is really a permissions and symlink check rather than a syntax check — but it is still the cheapest verification available."
      },
      {
        type: "prose",
        h: "Socket activation: accepting connections before the service exists",
        p: [
          "The interesting part of <code>ListenStream=</code> is what systemd does with it. It does not \"start the service earlier\". It <strong>creates and binds and listens on the socket itself</strong>, at boot, and then holds it open. The service is not started until something actually connects — and when it is, systemd passes the already-listening socket to it as file descriptor 3, along with the inherited environment telling it which address and port it is for. The service never calls <code>bind()</code> or <code>listen()</code> at all.",
          "That ordering is the whole point. With <code>sshd.socket</code> enabled and <code>sshd.service</code> stopped, the machine is still reachable on port 22: the kernel has a queue with a full backlog, packets are accepted by the kernel into that queue, and sshd has not yet existed. When the first connection arrives, systemd starts sshd, which inherits the queue and immediately processes what was buffered. No window exists in which a connection would be refused. On a 2&nbsp;GB VPS that also means an idle machine is not running a memory-resident sshd or nginx at all.",
          "There are real subtleties. <code>Accept=no</code> (the default) means systemd itself performs the <code>accept()</code> and hands each <em>connected</em> socket to a fresh instance of the service — a one-instance-per-connection model, which is how systemd's Nspawn and most small daemons work. <code>Accept=yes</code> means systemd hands over the <em>listening</em> socket and lets the service accept for itself, which is what you want for anything with its own master/worker model. <code>Service=</code> overrides which unit gets started; <code>MaxConnections=</code> bounds how many instances systemd will run concurrently, and hitting it means new connections are refused rather than queued — that limit is how you get an SSH denial of service against yourself if you set it wrong.",
          "The practical consequences: <code>systemctl status sshd</code> showing <em>inactive</em> is not evidence that SSH is down, and <code>systemctl restart sshd</code> when a socket unit is enabled restarts the listener rather than the daemon. On Debian and Ubuntu both <code>ssh.service</code> and the <code>ssh.socket</code> / <code>sshd.socket</code> unit names exist, and it is worth checking which one you actually have enabled before reasoning about restart behaviour."
        ]
      },
      {
        type: "diagram",
        h: "Socket activation, step by step",
        caption: "With the socket unit enabled, systemd owns the port from boot onward. The service is instantiated on first contact and inherits the listening file descriptor, so there is no window in which a connection could be refused — which is precisely the race that a plain <code>After=network.target</code> ordering cannot eliminate, because \"the service has started\" and \"the port is being listened on\" are two different moments.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="Socket activation sequence diagram showing systemd holding the listening socket and passing the file descriptor to the service">
  <!-- timeline -->
  <line class="ln dash" x1="150" y1="80" x2="150" y2="480"/>
  <line class="ln dash" x1="420" y1="80" x2="420" y2="480"/>
  <line class="ln dash" x1="700" y1="80" x2="700" y2="480"/>

  <rect class="box-ok" x="60" y="20" width="180" height="52" rx="9"/>
  <text class="t-ok" x="150" y="42" font-size="14" text-anchor="middle">sshd.socket</text>
  <text class="t-xs" x="150" y="60" text-anchor="middle">systemd owns the port</text>

  <rect class="box-p" x="330" y="20" width="180" height="52" rx="9"/>
  <text class="t-bad" x="420" y="42" font-size="14" text-anchor="middle">sshd.service</text>
  <text class="t-xs" x="420" y="60" text-anchor="middle">not running yet</text>

  <rect class="box-a" x="610" y="20" width="180" height="52" rx="9"/>
  <text class="t-accent" x="700" y="42" font-size="14" text-anchor="middle">client</text>
  <text class="t-xs" x="700" y="60" text-anchor="middle">ssh user@host</text>

  <text class="t-xs" x="150" y="18">boot</text>

  <!-- step 1 -->
  <path class="ln-ok" d="M150,100 L150,140" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="170" y="126" font-size="13.5">1. systemd socket(), bind() to :22, listen() — the port is already open</text>
  <text class="t-xs" x="170" y="144">nothing is accepting yet; the kernel queues the backlog</text>

  <!-- step 2 -->
  <path class="ln-a" d="M700,180 L428,180" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="440" y="174" font-size="13.5">2. SYN arrives → kernel accepts it into the socket's backlog</text>

  <path class="ln-p" d="M420,220 L428,220" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-sm" x="440" y="224" font-size="13.5">3. systemd sees the socket is readable and starts sshd.service</text>

  <path class="ln-ok" d="M420,220 L158,220" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="170" y="238" font-size="13.5">4. the listening socket is passed in as fd 3, with the address/port in the environment</text>
  <text class="t-xs" x="170" y="256">sshd never calls bind() or listen() — it adopts an existing descriptor</text>

  <path class="ln-a" d="M420,280 L692,280" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="440" y="274" font-size="13.5">5. sshd accepts and completes the handshake; the backlog entry is served</text>

  <path class="ln-b" d="M420,320 L428,320" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <text class="t-sm" x="440" y="324" font-size="13.5">6. connection closes → the instance exits</text>

  <path class="ln-w" d="M420,320 L158,320" marker-end="url(#lm-arrow-warn)" stroke-dasharray="4 4"/>
  <text class="t-sm" x="170" y="338" font-size="13.5">7. systemd keeps the socket open — you are still reachable with zero sshd processes</text>

  <!-- unit file -->
  <rect class="box" x="30" y="366" width="500" height="212" rx="10"/>
  <text x="46" y="392" font-size="15">/etc/systemd/system/sshd.socket.d/override.conf or the stock unit</text>
  <text class="t-sm" x="46" y="418">[Unit]</text>
  <text class="t-sm" x="46" y="438">Description=OpenBSD Secure Shell server socket</text>
  <text class="t-sm" x="46" y="458">Requires=network.target sshd-keygen.target</text>
  <text class="t-sm" x="46" y="478">[Socket]</text>
  <text class="t-sm" x="46" y="498">ListenStream=22</text>
  <text class="t-sm" x="46" y="518">Accept=no                       # systemd accept()s, one service instance per connection</text>
  <text class="t-sm" x="46" y="538">[Install]</text>
  <text class="t-sm" x="46" y="558">WantedBy=sockets.target           # and DISABLE sshd.service, or they fight over the port</text>

  <rect class="box-b" x="560" y="366" width="510" height="212" rx="10"/>
  <text class="t-bad" x="576" y="392" font-size="15">what this changes operationally</text>
  <text class="t-sm" x="576" y="418">systemctl status sshd → inactive, while SSH is fully working</text>
  <text class="t-sm" x="576" y="442">ss -ltnp for :22 shows systemd, not sshd — and that is the honest answer</text>
  <text class="t-sm" x="576" y="466">restarting sshd.service does nothing until the next connection</text>
  <text class="t-sm" x="576" y="490">a config change needs: systemctl restart sshd.socket  (not "reload sshd")</text>
  <text class="t-xs" x="576" y="516">MaxConnections= in [Socket] caps concurrent instances. Set it too low and you refuse</text>
  <text class="t-xs" x="576" y="534">your own legitimate logins — which, on a Tailscale-only box, is how you lock yourself</text>
  <text class="t-xs" x="576" y="550">out of a machine you can only reach over that same link. Check it before enabling.</text>
  <text class="t-xs" x="576" y="570">systemd 255+ adds .socket units for nginx too; 1.14-era nginx units are Type=forking, not activated.</text>
</svg>`
      },
      {
        type: "diagram",
        h: "Reload, restart, and what each one costs",
        caption: "The same user-visible action — \"apply the new config\" — has three different costs depending on the daemon. nginx is genuinely zero-downtime. sshd re-execs its listener and leaves running sessions completely alone. named re-reads zones while queries already in flight finish against the tree they started with. cron has no reload at all, so \"reload\" is a stop and a start, and a job in the middle of running is killed.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Comparison of reload and restart semantics across nginx, sshd, named and cron">
  <text class="t-title" x="30" y="34">what actually happens to a live connection</text>

  <!-- nginx -->
  <rect class="box-a" x="30" y="50" width="250" height="44" rx="8"/>
  <text class="t-accent" x="46" y="78" font-size="15">nginx</text>

  <path class="ln-ok" d="M280,72 L360,72" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="360" y="50" width="250" height="44" rx="8"/>
  <text class="t-ok" x="376" y="68" font-size="14">reload = SIGHUP to master</text>
  <text class="t-xs" x="376" y="86">new workers start, old ones drain</text>

  <path class="ln-ok" d="M610,72 L690,72" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="690" y="50" width="380" height="44" rx="8"/>
  <text class="t-ok" x="706" y="68" font-size="14">0 dropped connections. The listening socket is never closed.</text>
  <text class="t-xs" x="706" y="86">bounded by worker_shutdown_timeout — after that, old workers are killed mid-request</text>

  <path class="ln-w" d="M280,94 L360,120" marker-end="url(#lm-arrow-warn)"/>
  <rect class="box-w" x="360" y="118" width="250" height="44" rx="8"/>
  <text class="t-warn" x="376" y="136" font-size="14">restart = SIGQUIT + SIGTERM</text>
  <text class="t-xs" x="376" y="154">graceful: in-flight requests finish</text>

  <path class="ln-b" d="M610,140 L690,140" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="690" y="118" width="380" height="44" rx="8"/>
  <text class="t-bad" x="706" y="136" font-size="14">the port closes and reopens — a refused-connection window</text>
  <text class="t-xs" x="706" y="154">also re-reads TLS session cache and loses all upstream keepalive connections</text>

  <!-- sshd -->
  <rect class="box-a" x="30" y="186" width="250" height="44" rx="8"/>
  <text class="t-accent" x="46" y="214" font-size="15">sshd</text>

  <path class="ln-ok" d="M280,208 L360,208" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="360" y="186" width="250" height="44" rx="8"/>
  <text class="t-ok" x="376" y="204" font-size="14">reload = SIGHUP, re-exec</text>
  <text class="t-xs" x="376" y="222">the listener is re-executed with new config</text>

  <path class="ln-ok" d="M610,208 L690,208" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="690" y="186" width="380" height="44" rx="8"/>
  <text class="t-ok" x="706" y="204" font-size="14">existing sessions are children and are NOT signalled</text>
  <text class="t-xs" x="706" y="222">so this is genuinely safe — which is what makes editing sshd_config on a locked-down host viable</text>

  <path class="ln-b" d="M280,230 L360,254" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="360" y="252" width="250" height="44" rx="8"/>
  <text class="t-bad" x="376" y="270" font-size="14">restart</text>
  <text class="t-xs" x="376" y="288">kills every session in flight</text>

  <path class="ln-b" d="M610,274 L690,274" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="690" y="252" width="380" height="44" rx="8"/>
  <text class="t-bad" x="706" y="270" font-size="14">all of your own open sessions die. Never restart sshd while you are connected to it.</text>
  <text class="t-xs" x="706" y="288">and with sshd.socket enabled, "restart sshd" restarts the socket unit — see the socket activation figure</text>

  <!-- named -->
  <rect class="box-a" x="30" y="322" width="250" height="44" rx="8"/>
  <text class="t-accent" x="46" y="350" font-size="15">named</text>

  <path class="ln-ok" d="M280,344 L360,344" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="360" y="322" width="250" height="44" rx="8"/>
  <text class="t-ok" x="376" y="340" font-size="14">rndc reload</text>
  <text class="t-xs" x="376" y="358">re-reads zones whose serial is newer</text>

  <path class="ln-ok" d="M610,344 L690,344" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="690" y="322" width="380" height="44" rx="8"/>
  <text class="t-ok" x="706" y="340" font-size="14">no client impact at all — queries are answered from memory either way</text>
  <text class="t-xs" x="706" y="358">an in-flight query finishes against the tree it started with. This is the safest reload of the three.</text>

  <path class="ln-b" d="M280,366 L360,390" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="360" y="388" width="250" height="44" rx="8"/>
  <text class="t-bad" x="376" y="406" font-size="14">restart</text>
  <text class="t-xs" x="376" y="424">brief REFUSED window</text>

  <path class="ln-b" d="M610,410 L690,410" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="690" y="388" width="380" height="44" rx="8"/>
  <text class="t-bad" x="706" y="406" font-size="14">every recursive resolver in the world retries, and some give up</text>
  <text class="t-xs" x="706" y="424">serves SERVFAIL to real users for the length of the gap. Reload, do not restart.</text>

  <!-- cron -->
  <rect class="box-a" x="30" y="458" width="250" height="44" rx="8"/>
  <text class="t-accent" x="46" y="486" font-size="15">cron</text>

  <path class="ln-w" d="M280,480 L360,480" marker-end="url(#lm-arrow-warn)"/>
  <rect class="box-w" x="360" y="458" width="250" height="44" rx="8"/>
  <text class="t-warn" x="376" y="476" font-size="14">"reload" is a restart</text>
  <text class="t-xs" x="376" y="494">there is no reload signal at all</text>

  <path class="ln-b" d="M610,480 L690,480" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="690" y="458" width="380" height="44" rx="8"/>
  <text class="t-bad" x="706" y="476" font-size="14">a cron job that is mid-run is killed. Your deploy script dies halfway through.</text>
  <text class="t-xs" x="706" y="494">This is the argument for systemd timers on a box where anything actually runs on a schedule.</text>

  <rect class="box" x="30" y="516" width="1040" height="34" rx="8"/>
  <text class="t-sm" x="46" y="538">The general rule: reload when the daemon can re-read configuration in place; restart only when the change cannot be applied live (a changed listening port, a changed user, a new binary on disk).</text>
</svg>`
      },
      {
        type: "prose",
        h: "Logging: three destinations and only one of them rotates",
        p: [
          "systemd captures the standard output and standard error of every service it starts and puts it in the journal. A daemon that writes to <code>/var/log/whatever.log</code> instead is doing something old-fashioned — usually because it daemonises with its own log rotation, or because its configuration file says so. On this box nginx does both: its unit has <code>StandardError=journal</code> for start-up failures, and <code>access_log</code>/<code>error_log</code> in its config send request-level detail to files under <code>/var/log/nginx/</code>. That split is deliberate: the journal is the right place for lifecycle events and it is queryable by unit, while high-volume per-request logging belongs in a file that logrotate owns.",
          "The journal is binary, indexed and size-bounded, and <strong>it rate-limits</strong> when a service floods it. The defaults are <code>RateLimitIntervalSec=30s</code> and <code>RateLimitBurst=10000</code> per service, so a program that writes 10,000 lines in a second gets everything up to the burst and then has messages dropped — with a single <code>Suppressed N messages from …</code> line to tell you. It is a denial-of-service protection against a log-flooding process filling the disk, and it is the reason a chatty daemon can make its own logs vanish.",
          "Where the journal lives depends on one setting. <code>Storage=auto</code> — the default — writes to disk only if <code>/var/log/journal/</code> exists, which on Ubuntu it does after <code>systemd-journald</code> is enabled for persistent storage; otherwise logs are in RAM and <strong>they are gone on reboot</strong>. <code>Storage=persistent</code> forces disk. <code>Storage=volatile</code> forces RAM, which is the right choice for a machine where logs are shipped elsewhere and local disk space is precious. Either way <code>SystemMaxUse=</code> (default 10% of the filesystem, capped at 4&nbsp;GB) bounds the total, and <code>journalctl --vacuum-size=200M</code> is the manual version of what vacuuming does automatically.",
          "On a 19&nbsp;GB disk the numbers matter more than usual: journal at 10% is about 1.9&nbsp;GB before the cap kicks in, nginx logs are unbounded until logrotate runs, and a debug-level <code>error_log</code> is a genuinely effective way to fill a small filesystem. <code>lsblk</code> is the wrong tool for that question; <code>journalctl --disk-usage</code> and <code>du -sh /var/log/*</code> are the right ones."
        ]
      },
      {
        type: "diagram",
        h: "Where each byte of a log line ends up",
        caption: "Three independent destinations with three different lifecycles. The journal is bounded and rate-limited and disappears on reboot if it was never made persistent. Files under <code>/var/log</code> are unbounded until logrotate touches them. Forwarding to a remote collector is a fourth path, and the only one that survives a destroyed disk — which on a 19&nbsp;GB VPS that also holds your site is the one worth having.",
        svg: `
<svg viewBox="0 0 1100 580" role="img" aria-label="Log destinations: journald with rate limiting and disk usage, plain log files with logrotate, and remote forwarding">
  <rect class="box-a" x="30" y="24" width="260" height="60" rx="9"/>
  <text class="t-accent" x="46" y="48" font-size="15">a service writes</text>
  <text class="t-sm" x="46" y="70">stdout / stderr (nginx, sshd, named -g)</text>

  <path class="ln-a" d="M290,44 L420,44" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M290,64 L420,240" marker-end="url(#lm-arrow-accent)"/>

  <!-- journal -->
  <rect class="box-p" x="420" y="24" width="300" height="120" rx="10"/>
  <text class="t-bad" x="436" y="48" font-size="15">journald</text>
  <text class="t-sm" x="436" y="70">/var/log/journal/&lt;machine-id&gt;/</text>
  <text class="t-sm" x="436" y="88">binary, indexed, queryable per unit</text>
  <text class="t-xs" x="436" y="108">RateLimitIntervalSec=30s</text>
  <text class="t-xs" x="436" y="124">RateLimitBurst=10000 → "Suppressed N messages"</text>
  <text class="t-xs" x="436" y="140">SystemMaxUse=10% of fs, capped 4G</text>

  <path class="ln-b" d="M720,84 L820,84" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="820" y="24" width="250" height="120" rx="10"/>
  <text class="t-bad" x="836" y="48" font-size="15">lost on reboot</text>
  <text class="t-xs" x="836" y="70">if /var/log/journal does not</text>
  <text class="t-xs" x="836" y="86">exist, Storage=auto keeps</text>
  <text class="t-xs" x="836" y="102">everything in RAM only</text>
  <text class="t-xs" x="836" y="124">check: journalctl --disk-usage</text>
  <text class="t-xs" x="836" y="140">and ls -d /var/log/journal</text>

  <!-- files -->
  <rect class="box-ok" x="420" y="240" width="300" height="112" rx="10"/>
  <text class="t-ok" x="436" y="264" font-size="15">plain files</text>
  <text class="t-sm" x="436" y="286">/var/log/nginx/access.log</text>
  <text class="t-sm" x="436" y="304">/var/log/nginx/error.log</text>
  <text class="t-sm" x="436" y="322">/var/log/syslog (named's default destination)</text>
  <text class="t-xs" x="436" y="344">unbounded until logrotate runs</text>

  <path class="ln-ok" d="M720,296 L820,296" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-w" x="820" y="240" width="250" height="112" rx="10"/>
  <text class="t-warn" x="836" y="264" font-size="15">logrotate</text>
  <text class="t-sm" x="836" y="288">postrotate → reopen (nginx USR1)</text>
  <text class="t-sm" x="836" y="306">copytruncate → copy, then truncate</text>
  <text class="t-xs" x="836" y="330">the gap between the two matters —</text>
  <text class="t-xs" x="836" y="346">see the section below</text>

  <!-- shipping -->
  <rect class="box" x="30" y="400" width="1040" height="160" rx="10"/>
  <text x="46" y="426" font-size="15">the fourth path: getting logs off the machine</text>
  <text class="t-sm" x="46" y="452">On a 2 GB / 19 GB VPS with four static sites, the local filesystem is the least reliable place for the only copy of anything.</text>
  <text class="t-sm" x="46" y="476">Forward with systemd itself — no extra daemon, no syslog on 18.04:</text>
  <text class="t-sm" x="46" y="500">  [Unit]  After=network-online.target</text>
  <text class="t-sm" x="46" y="522">  StandardOutput=journal+forward   or   journal:Syslog.ident=nginx</text>
  <text class="t-sm" x="46" y="542">That requires a compatible receiver; a syslog daemon that only reads /var/log will not see forwarded output.</text>
  <text class="t-xs" x="46" y="566">Journal stays authoritative locally either way — forwarding is a copy, not a move. Verify with journalctl -u nginx after a restart.</text>
  <text class="t-xs" x="46" y="580">The narrow exception on this box: nginx access logs for 4 static sites are low volume, so local files plus logrotate is genuinely fine.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Hardening: what systemd can and cannot lock away",
        p: [
          "Every sandboxing directive in a systemd unit works by moving the service out of the way of things it does not need — a mount namespace that makes a path read-only or invisible, a capability bounding set that removes privileges from the process, a seccomp filter that refuses system calls. None of them are magic; all of them are <em>restrictions</em>, and every restriction has a daemon that legitimately needed the thing you just removed.",
          "The one warning that matters more than the whole table: <strong><code>ProtectSystem=strict</code> makes the entire filesystem read-only except <code>/dev</code>, <code>/proc</code> and <code>/sys</code></strong>. Any daemon that writes a PID file, a cache, a temporary file outside <code>PrivateTmp</code>, or a log outside a journal will fail at startup with <code>EROFS</code> or <code>Read-only file system</code> — and for a Type=forking daemon, the failure is silent at systemd level because the process dies during its own initialisation. That is why hardened units almost always pair it with explicit write allowances: <code>ReadWritePaths=</code> for the few directories the service genuinely owns, and <code>RuntimeDirectory=</code> to have systemd create and clean up a writable <code>/run/&lt;name&gt;</code> owned by the right user, so the service never has to write into <code>/run</code> broadly.",
          "The rest are cheaper to get wrong and easier to notice. <code>ProtectHome=yes</code> hides <code>/home</code>, <code>/root</code> and <code>/run/user</code> — which breaks any daemon that reads files out of a user's home, including a surprising number of things configured via an absolute path under <code>/home/ubuntu/</code>. <code>PrivateTmp=yes</code> gives the service its own empty <code>/tmp</code>, so it cannot read another process's temporary files; it breaks daemons that pass temporary paths between components outside the unit. <code>NoNewPrivileges=yes</code> is the cheapest control there is and has almost no legitimate downside — the process cannot gain privileges through setuid binaries or file capabilities, ever. <code>RestrictAddressFamilies=</code> listing <code>AF_INET AF_INET6 AF_UNIX</code> blocks socket creation for every other family, which genuinely removes a class of exploitation primitive and almost never breaks a daemon.",
          "And do the arithmetic on memory before you set it. <code>MemoryMax=</code> maps to <code>memory.limit_in_bytes</code> on cgroups v1 and <code>memory.max</code> on v2; when the limit is hit the kernel OOM-kills something <em>inside the cgroup</em>, and on v1 that choice is not as carefully scoped as on v2, which is a real argument for knowing which cgroup version you are on before you start capping services."
        ]
      },
      {
        type: "diagram",
        h: "What a hardened unit actually gets you",
        caption: "The sandbox is built out of ordinary kernel mechanisms — mount namespaces, capabilities, seccomp — each one subtracted from what the process can reach. The service does not notice any of it, which is exactly why a wrong directive produces a startup failure rather than a warning. Every <code>Protect*</code> line is a namespace restriction; every <code>CapabilityBoundingSet</code> line is a capability removal; <code>SystemCallFilter</code> is seccomp.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="Diagram of systemd sandboxing directives mapped to namespaces, capabilities, seccomp and cgroup limits">
  <!-- baseline -->
  <rect class="box" x="30" y="24" width="1040" height="96" rx="10"/>
  <text x="46" y="48" font-size="15">without any hardening, the service can see everything</text>
  <text class="t-sm" x="46" y="72">whole filesystem  ·  all network families  ·  all syscalls  ·  all capabilities including CAP_SYS_ADMIN</text>
  <text class="t-xs" x="46" y="94">An RCE in that process is, from its point of view, full root on the machine. Every directive below removes one piece of that.</text>
  <text class="t-xs" x="46" y="110">A systemd sandbox cannot contain a kernel bug, and it does not replace patching — it limits what a compromised daemon can reach with the privileges it already had.</text>

  <text class="t-title" x="30" y="152">mount namespaces — what the filesystem looks like from inside</text>

  <rect class="box-v" x="30" y="164" width="255" height="120" rx="9"/>
  <text class="t-violet" x="46" y="188" font-size="14.5">ProtectSystem=strict</text>
  <text class="t-sm" x="46" y="210">/ read-only except</text>
  <text class="t-sm" x="46" y="228">/dev /proc /sys</text>
  <text class="t-xs" x="46" y="250">breaks: PID files in /run,</text>
  <text class="t-xs" x="46" y="268">caches, any file log</text>
  <text class="t-xs" x="46" y="284">fix: ReadWritePaths=</text>

  <rect class="box-v" x="295" y="164" width="255" height="120" rx="9"/>
  <text class="t-violet" x="311" y="188" font-size="14.5">ProtectSystem=full</text>
  <text class="t-sm" x="311" y="210">/usr and /boot read-only</text>
  <text class="t-sm" x="311" y="228">/etc still writable</text>
  <text class="t-xs" x="311" y="250">usually the right setting</text>
  <text class="t-xs" x="311" y="268">for a service that must</text>
  <text class="t-xs" x="311" y="284">read /etc/… config</text>

  <rect class="box-v" x="560" y="164" width="255" height="120" rx="9"/>
  <text class="t-violet" x="576" y="188" font-size="14.5">ProtectHome=yes</text>
  <text class="t-sm" x="576" y="210">/home /root /run/user</text>
  <text class="t-sm" x="576" y="228">appear empty</text>
  <text class="t-xs" x="576" y="250">breaks: anything with an</text>
  <text class="t-xs" x="576" y="268">absolute path under a</text>
  <text class="t-xs" x="576" y="284">user home — very common</text>

  <rect class="box-v" x="825" y="164" width="245" height="120" rx="9"/>
  <text class="t-violet" x="841" y="188" font-size="14.5">PrivateTmp=yes</text>
  <text class="t-sm" x="841" y="210">private /tmp mount</text>
  <text class="t-sm" x="841" y="228">namespace</text>
  <text class="t-xs" x="841" y="250">breaks: temp paths passed</text>
  <text class="t-xs" x="841" y="268">between processes in and</text>
  <text class="t-xs" x="841" y="284">out of the unit</text>

  <text class="t-title" x="30" y="322">privileges, syscalls and resources</text>

  <rect class="box-b" x="30" y="334" width="255" height="120" rx="9"/>
  <text class="t-bad" x="46" y="358" font-size="14.5">CapabilityBoundingSet=</text>
  <text class="t-sm" x="46" y="380">drops every capability not</text>
  <text class="t-sm" x="46" y="398">listed, permanently</text>
  <text class="t-xs" x="46" y="420">CAP_SETUID CAP_SETGID</text>
  <text class="t-xs" x="46" y="438">CAP_NET_BIND_SERVICE</text>
  <text class="t-xs" x="46" y="456">= a plausible nginx set</text>

  <rect class="box-b" x="295" y="334" width="255" height="120" rx="9"/>
  <text class="t-bad" x="311" y="358" font-size="14.5">NoNewPrivileges=yes</text>
  <text class="t-sm" x="311" y="380">cannot gain privilege via</text>
  <text class="t-sm" x="311" y="398">setuid or file caps</text>
  <text class="t-xs" x="311" y="420">free, and almost never</text>
  <text class="t-xs" x="311" y="438">breaks anything — the</text>
  <text class="t-xs" x="311" y="456">best ratio on the page</text>

  <rect class="box-a" x="560" y="334" width="255" height="120" rx="9"/>
  <text class="t-accent" x="576" y="358" font-size="14.5">SystemCallFilter=</text>
  <text class="t-sm" x="576" y="380">seccomp-bpf allowlist</text>
  <text class="t-sm" x="576" y="398">or ~denylist</text>
  <text class="t-xs" x="576" y="420">~@privileged, ~@resources,</text>
  <text class="t-xs" x="576" y="438">~@obsolete are groups that</text>
  <text class="t-xs" x="576" y="456">must be retested per daemon</text>

  <rect class="box-a" x="825" y="334" width="245" height="120" rx="9"/>
  <text class="t-accent" x="841" y="358" font-size="14.5">MemoryMax= / TasksMax=</text>
  <text class="t-sm" x="841" y="380">cgroup limits</text>
  <text class="t-sm" x="841" y="398">v1: memory.limit_in_bytes</text>
  <text class="t-sm" x="841" y="416">v2: memory.max</text>
  <text class="t-xs" x="841" y="438">TasksMax protects against</text>
  <text class="t-xs" x="841" y="456">fork bombs</text>

  <rect class="box-w" x="30" y="472" width="1040" height="108" rx="10"/>
  <text class="t-warn" x="46" y="496" font-size="15">verify what you actually got, instead of trusting the unit file</text>
  <text class="t-sm" x="46" y="522">systemd-analyze security nginx.service        # a scored 0-10 exposure report, per directive</text>
  <text class="t-sm" x="46" y="544">systemctl show nginx -p NoNewPrivileges -p ProtectSystem -p MemoryMax -p TasksMax</text>
  <text class="t-xs" x="46" y="566">systemd-analyze security exists on systemd 237 but scores against the upstream default profile, not against your risk model. It is a checklist, not a verdict.</text>
  <text class="t-xs" x="46" y="578">The ground truth is what the process sees: read /proc/&lt;pid&gt;/status for CapEff and Seccomp, and nsenter into the mount namespace to see the filesystem it actually has.</text>
</svg>`
      },
      {
        type: "table",
        cols: ["Directive", "What it actually does", "What it breaks", "Verdict on this box"],
        rows: [
          ["<code>NoNewPrivileges=yes</code>", "sets PR_SET_NO_NEW_PRIVS: the process can never gain privilege through a setuid binary or file capability", "software installed with <code>setcap</code> and later invoked by the unit", "<strong>Always.</strong> The best ratio of protection to risk on the page"],
          ["<code>ProtectSystem=full</code>", "makes <code>/usr</code> and <code>/boot</code> read-only in a private mount namespace", "a daemon that writes a cache or a generated file under <code>/usr</code> or <code>/opt</code>", "Safe for nginx, sshd and named — all of them write under <code>/var</code>, <code>/run</code> or <code>/etc</code>"],
          ["<code>ProtectSystem=strict</code>", "the whole filesystem read-only except <code>/dev</code>, <code>/proc</code>, <code>/sys</code>", "<strong>any</strong> daemon writing a PID file, cache or file log outside <code>ReadWritePaths</code> — fails with <code>EROFS</code> and no useful message", "Only with <code>ReadWritePaths=</code> listing every writable directory. <code>nginx -t</code> will not catch it; the process just will not start"],
          ["<code>ProtectHome=yes</code>", "makes <code>/home</code>, <code>/root</code> and <code>/run/user</code> appear empty", "absolute paths pointing into any user's home — a common accident in hand-written configs", "Free here. Worth keeping, because a compromise of a web daemon should not be able to read <code>/root/.ssh</code>"],
          ["<code>PrivateTmp=yes</code>", "gives the unit its own empty <code>/tmp</code> mount namespace", "temporary paths passed between a process inside the unit and one outside it", "Safe for all three services; nginx proxies in particular should not need <code>/tmp</code>"],
          ["<code>PrivateDevices=yes</code>", "hides almost all of <code>/dev</code> except a minimal set", "anything needing <code>/dev/shm</code> size control or specific devices — and many daemons use <code>/dev/urandom</code> fine", "Optional; it breaks more than people expect, so test before enabling"],
          ["<code>CapabilityBoundingSet=</code>", "permanently removes every capability not listed from the process and its children", "the <em>complement</em> is the trap: dropping <code>CAP_NET_BIND_SERVICE</code> breaks ports below 1024, dropping <code>CAP_DAC_OVERRIDE</code> breaks any file not owned by the service user", "nginx needs <code>CAP_NET_BIND_SERVICE</code> on 80/443; named needs none at all. Verify with <code>grep Cap /proc/&lt;pid&gt;/status</code>"],
          ["<code>SystemCallFilter=</code>", "seccomp-bpf allowlist (<code>SystemCallFilter=@system-service</code>) or denylist (<code>SystemCallFilter=~@privileged</code>)", "a daemon using a syscall you did not think of — the failure is <code>EPERM</code> at an arbitrary moment, often deep into startup", "Start with the denylist form. The curated groups are good, but they are upstream's idea of a generic service, not yours"],
          ["<code>SystemCallArchitectures=native</code>", "seccomp rejects system calls for foreign ABIs, which blocks the 32-bit compat entry points on x86-64", "a 32-bit helper the service execs — check before applying", "Cheap and worth it on x86-64. Note that on 18.04 without the seccomp BPF JIT, these filters have a measurable startup cost"],
          ["<code>RestrictAddressFamilies=</code>", "blocks <code>socket()</code> for every address family not listed", "an unexpected family: <code>AF_NETLINK</code> for netlink tools, <code>AF_PACKET</code> for <code>tcpdump</code>, <code>AF_UNIX</code> for almost every daemon's IPC", "Set it to <code>AF_INET AF_INET6 AF_UNIX</code> and be aware you are opting out of netlink entirely — which some libraries use without being obvious about it"],
          ["<code>MemoryMax=</code>", "cgroup limit. v1: <code>memory.limit_in_bytes</code>; v2: <code>memory.max</code>", "at the limit, the kernel OOM-kills something in the cgroup. On v1 the choice of victim is less precisely scoped than on v2", "256M for nginx on a 2 GB box is generous. Always watch <code>systemctl show nginx -p MemoryCurrent</code> first"],
          ["<code>TasksMax=</code>", "cgroup limit on the number of tasks — the fork-bomb control", "services that legitimately spawn many threads; 64 is fine for nginx and sshd, tight for anything with a thread pool", "Set it. It is the only defence that works against a process that is trying to exhaust the PID table"],
          ["<code>RestrictRealtime</code>, <code>LockPersonality</code>, <code>RestrictSUIDSGID</code>", "deny the privileged realtime syscalls, forbid changing the execution domain, and forbid creating setuid/setgid files", "almost nothing on a server. <code>RestrictSUIDSGID</code> is occasionally needed by package managers, which are not inside the unit", "All three, unconditionally"],
          ["<code>SystemCallFilter</code> on a Type=forking daemon", "note: the filter applies to the master and is inherited by every worker", "the classic silent failure: the master starts, forks workers, and a worker dies on the first syscall it was not allowed", "Verify with <code>journalctl -u nginx</code> and by making a real request, not by checking the unit is active"]
        ]
      },
      {
        type: "code",
        lang: "conf",
        what: "A hardened service unit, with the reasoning in the comments",
        code:
`# /etc/systemd/system/nginx.service.d/override.conf
[Service]
# --- filesystem ---
ProtectSystem=full          # /usr and /boot read-only; /etc stays readable and writable
ProtectHome=yes             # no /home, /root, /run/user — nginx serves /var/www, so this is free
PrivateTmp=yes              # own /tmp; harmless for nginx, useful against local info leaks
ReadWritePaths=/var/log/nginx /var/cache/nginx /run
ReadOnlyPaths=/etc/nginx    # the config should never change itself

# --- privileges ---
User=www-data
Group=www-data
NoNewPrivileges=yes         # cannot gain privilege through any setuid path. Always worth it.
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_CHOWN CAP_SETUID CAP_SETGID
AmbientCapabilities=CAP_NET_BIND_SERVICE   # needed for <1024, and ONLY that one
# on 1.14 the unit also needs CAP_DAC_OVERRIDE or a correctly-owned log dir;
# check "journalctl -u nginx" after applying, the failure is silent otherwise

# --- syscalls and address families ---
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
RestrictRealtime=yes
LockPersonality=yes

# --- resources (cgroups v1 on this box, v2 names shown in the comment) ---
MemoryMax=256M              # v2: memory.max. cgroups v1 shows this as MemoryLimitInBytes=
TasksMax=64                 # workers + epoll + threads; 64 is generous for a static site server
LimitNOFILE=65535           # must be >= nginx worker_rlimit_nofile, or nginx logs "open() failed"

# --- restart behaviour, which is where the real outages live ---
Restart=on-failure
RestartSec=2s
TimeoutStopSec=110s         # > worker_shutdown_timeout, or a graceful stop gets SIGKILLed
StartLimitIntervalSec=30s   # [Unit] section on systemd 229+, not [Service]
StartLimitBurst=5
KillSignal=SIGQUIT          # graceful: let in-flight requests finish

[Install]
WantedBy=multi-user.target

# systemctl daemon-reload && systemctl restart nginx && systemctl status nginx
# journalctl -u nginx -n 50 --no-pager
# a sandbox directive that is too strict does not warn — it makes the process die
# during startup, and the unit just says "status=1/FAILURE". Test with a copy.`
      },
      {
        type: "prose",
        h: "nginx: the model, and the arithmetic behind the number you quote",
        p: [
          "nginx is a master process and a pool of identical workers, and that design is why it scales: each worker has its own <code>epoll</code> set and handles connections without ever locking with another worker, because a connection belongs to exactly one worker for its entire life. The master does not serve anything. It reads configuration, forks, reaps, and on <code>SIGHUP</code> it spawns a fresh set and lets the old set drain.",
          "The sizing is arithmetic people quote incorrectly all the time. <code>worker_processes auto</code> means one worker per core; on this two-vCPU VPS that is 2. <code>worker_connections 1024</code> is the number of <em>simultaneous connections that worker can hold</em>, and — this is the part that gets missed — <strong>that includes connections to upstream backends</strong>, not just connections from clients. So a reverse proxy serving 600 client requests, each of which holds a connection to a backend, is using 1200 connections, and <code>worker_processes × worker_connections</code> is the ceiling, not the target. For a purely static site there is no upstream, so the honest number is simply processes × connections.",
          "There is an old piece of folklore about the accept mutex, and it is worth killing: <code>accept_mutex</code> has defaulted to <code>off</code> since 1.11.3, and with epoll it is unnecessary. Pinning workers to specific CPUs with <code>worker_cpu_affinity</code> is occasionally useful for cache locality on very busy boxes, but on a VPS with two vCPUs and four static sites it is cargo cult. What <em>is</em> worth tuning is <code>worker_rlimit_nofile</code> — and it is strictly a ceiling, not a grant: nginx sets the worker's <code>RLIMIT_NOFILE</code> to that value at startup, but it cannot raise it above the hard limit it inherited, which is why a <code>LimitNOFILE</code> that is too low in the unit produces <code>open() failed (24: Too many open files)</code> in the error log no matter what nginx is told."
        ]
      },
      {
        type: "diagram",
        h: "Anatomy of a real server block",
        caption: "A server block for a static site on this box, with every part that matters annotated: which directive wins where, what <code>try_files</code> actually does, and the two settings that make a reload safe. The distinction to internalise is <b>root</b> (the path is appended to the location prefix) versus <b>alias</b> (the prefix is replaced) — the same URI produces two different files depending on which you used and whether a trailing slash is present.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="Annotated nginx server block configuration showing server, location, try_files, TLS and logging directives">
  <!-- http block -->
  <rect class="box" x="30" y="24" width="1040" height="560" rx="12"/>
  <text class="t-title" x="50" y="50">/etc/nginx/sites-available/example — a real server block</text>

  <!-- server block -->
  <rect class="box-a" x="56" y="66" width="700" height="502" rx="10"/>
  <text class="t-accent" x="72" y="90" font-size="15">server {</text>
  <text class="t-sm" x="72" y="116">listen 443 ssl http2;</text>
  <text class="t-sm" x="72" y="138">listen [::]:443 ssl http2;          # comment out if the box has no IPv6</text>
  <text class="t-sm" x="72" y="160">server_name example.ro www.example.ro;</text>
  <text class="t-sm" x="72" y="182">root /var/www/html/example.ro;</text>

  <line class="ln dash" x1="72" y1="196" x2="740" y2="196" stroke-dasharray="4 4"/>
  <text class="t-accent" x="72" y="220" font-size="15">ssl_certificate     /etc/letsencrypt/live/example.ro/fullchain.pem;</text>
  <text class="t-sm" x="72" y="242">ssl_certificate_key /etc/letsencrypt/live/example.ro/privkey.pem;</text>
  <text class="t-sm" x="72" y="264">ssl_protocols       TLSv1.2 TLSv1.3;</text>
  <text class="t-sm" x="72" y="286">ssl_prefer_server_ciphers off;      # clients pick; forward secrecy is the point</text>
  <text class="t-sm" x="72" y="308">ssl_session_cache   shared:SSL:10m;</text>

  <line class="ln dash" x1="72" y1="322" x2="740" y2="322" stroke-dasharray="4 4"/>

  <text class="t-accent" x="72" y="346" font-size="15">add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;</text>
  <text class="t-sm" x="72" y="368">add_header X-Content-Type-Options    "nosniff" always;</text>
  <text class="t-sm" x="72" y="390">add_header Referrer-Policy           "strict-origin-when-cross-origin" always;</text>

  <line class="ln dash" x1="72" y1="404" x2="740" y2="404" stroke-dasharray="4 4"/>

  <text class="t-accent" x="72" y="428" font-size="15">location = / {                      # EXACT match: beats every prefix and every regex</text>
  <text class="t-sm" x="72" y="450">    try_files /index.html =404;</text>
  <text class="t-sm" x="72" y="472">}                                    # =404, not a redirect to /</text>

  <text class="t-accent" x="72" y="500" font-size="15">location /assets/ {                  # longest prefix match</text>
  <text class="t-sm" x="72" y="522">    expires 30d;</text>
  <text class="t-sm" x="72" y="544">    add_header Cache-Control "public, immutable";</text>
  <text class="t-sm" x="72" y="566">    try_files $uri =404;             # 404 here, not a silent fallback to index.html</text>

  <text class="t-accent" x="72" y="594" font-size="15">location / {                          # the catch-all — everything not matched above</text>
  <text class="t-sm" x="72" y="614">    try_files $uri $uri/ /index.html;</text>

  <!-- right column annotations -->
  <rect class="box-w" x="780" y="66" width="290" height="152" rx="9"/>
  <text class="t-warn" x="796" y="90" font-size="14.5">location matching order</text>
  <text class="t-sm" x="796" y="112">1. exact  = /index.html</text>
  <text class="t-sm" x="796" y="132">2. longest prefix, if ^~ → done</text>
  <text class="t-sm" x="796" y="152">3. regex, in file order, first wins</text>
  <text class="t-sm" x="796" y="172">4. otherwise the longest prefix</text>
  <text class="t-xs" x="796" y="194">location /assets/ is evaluated BEFORE</text>
  <text class="t-xs" x="796" y="208">the regexes, even if a regex is</text>
  <text class="t-xs" x="796" y="214">declared first in the file</text>

  <rect class="box-p" x="780" y="232" width="290" height="180" rx="9"/>
  <text class="t-bad" x="796" y="256" font-size="14.5">root vs alias</text>
  <text class="t-sm" x="796" y="278">root /var/www/html/x;</text>
  <text class="t-xs" x="796" y="296">uri /i/logo.png → file</text>
  <text class="t-xs" x="796" y="310">/var/www/html/x/i/logo.png</text>
  <text class="t-sm" x="796" y="334">alias /var/www/data/i/;</text>
  <text class="t-xs" x="796" y="352">same uri → /var/www/data/i/logo.png</text>
  <text class="t-xs" x="796" y="376">the prefix is REPLACED, not appended.</text>
  <text class="t-xs" x="796" y="392">A missing trailing slash on either the</text>
  <text class="t-xs" x="796" y="408">location or the alias is a silent 404.</text>

  <rect class="box-ok" x="780" y="426" width="290" height="174" rx="9"/>
  <text class="t-ok" x="796" y="418" font-size="14.5">try_files, precisely</text>
  <text class="t-sm" x="796" y="440">$uri      file exists? serve it</text>
  <text class="t-sm" x="796" y="460">$uri/     is it a directory?</text>
  <text class="t-sm" x="796" y="480">/index.html  the LAST argument is</text>
  <text class="t-xs" x="796" y="498">an internal redirect, not a file: it</text>
  <text class="t-xs" x="796" y="514">re-runs location matching, which is</text>
  <text class="t-xs" x="796" y="528">why an SPA loop can happen</text>
  <text class="t-xs" x="796" y="550">=404 ends the request honestly</text>

  <rect class="box" x="56" y="586" width="700" height="44" rx="9"/>
  <text class="t-sm" x="72" y="606">access_log /var/log/nginx/example.access.log example;   # custom log_format, see below</text>
  <text class="t-sm" x="72" y="624">error_log  /var/log/nginx/example.error.log warn;</text>
</svg>`
      },
      {
        type: "code",
        lang: "nginx",
        what: "The http block, the log format, and the reverse-proxy rules that bite",
        code:
`# /etc/nginx/nginx.conf — the four things that actually belong in the http block
user www-data;
worker_processes auto;            # = nproc; on a 2 vCPU VPS, 2
worker_rlimit_nofile 65535;       # a CEILING. The unit's LimitNOFILE must be >= this,
                                   # or nginx logs: open() failed (24: Too many open files)
worker_shutdown_timeout 30s;      # how long old workers may drain during a reload.
                                   # Must be < TimeoutStopSec in the unit. In 1.14 this
                                   # directive exists (added in 1.11.11); before it, a
                                   # reload with a hung connection hangs the shutdown.

events {
    worker_connections 1024;      # per worker, and it COUNTS upstream connections too
    multi_accept on;              # accept as many as possible per epoll wakeup
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;             # zero-copy: serve from page cache without a user->kernel copy
    tcp_nopush    on;             # send headers in one packet (sendfile interaction)
    keepalive_timeout 65;         # keep-alive idle window; 65 is nginx's default
    server_tokens off;            # do not advertise the version in error pages and headers

    log_format example '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" '
                       'rt=$request_time urt=$upstream_response_time '
                       'cs=$upstream_cache_status';
    access_log /var/log/nginx/access.log example;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 512;          # never bother compressing a 404 page

    # --- the reverse-proxy rules people get wrong ---
    # proxy_pass WITH a URI (…/api/) : the matched location prefix is REPLACED by the URI
    # proxy_pass WITHOUT a URI      : the original request URI is passed through unchanged
    # proxy_pass with a $variable   : requires a resolver directive, or nginx fails at
    #                                startup with "no resolver defined to resolve …"

    # the Host header decides which vhost the backend sees, and therefore routing
    proxy_set_header Host              $host;        # $host = client's Host, normalised
    # proxy_set_header Host            $proxy_host;  # the DEFAULT: the upstream's own name
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;   # appends, does not replace
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Connection "";    # REQUIRED for upstream keepalive; without it nginx
                                      # sends Connection: close and gets no reuse
    proxy_connect_timeout 5s;
    proxy_read_timeout    60s;        # per read, not per request — long-poll needs raising

    # proxy_pass http://backend;      # upstream block below
}

upstream backend {
    server 10.0.0.10:8080 max_fails=3 fail_timeout=30s;
    keepalive 32;                    # idle upstream connections per worker, needs the
                                    # Connection "" header above to actually be used
}

# --- TLS renewal, the thing that silently breaks sites ---
# certbot renew runs from a systemd timer twice a day and reloads nginx via its deploy hook.
# The renew deploy hook is:
#   [Unit]  After=network.target
#   [Service] ExecStart=/bin/systemctl reload nginx
# Verify it exists rather than assuming:  systemctl list-timers | grep certbot
# and confirm the chain file is fullchain.pem, never cert.pem + chain.pem concatenated
# by hand — the order matters: leaf first, then intermediates, and no root.`
      },
      {
        type: "table",
        cols: ["Directive pair", "With <code>root</code>", "With <code>alias</code>", "The trap"],
        rows: [
          ["<code>location /i/</code> + <code>/data/w3</code>", "URI <code>/i/a.png</code> → <code>/data/w3/i/a.png</code>", "n/a", "—"],
          ["<code>location /i/</code> + <code>alias /data/w3/i/</code>", "n/a", "URI <code>/i/a.png</code> → <code>/data/w3/i/a.png</code>", "the trailing slash on both the location and the alias must match, or every request 404s with no error in the log"],
          ["<code>location /i</code> (no slash) + <code>alias /data/w3/i/</code>", "n/a", "URI <code>/i/a.png</code> → <code>/data/w3/i/a.png</code> — accidental correctness", "works by accident; change the alias and it silently breaks"],
          ["<code>location /i</code> + <code>alias /data/w3/i</code> (no slash)", "n/a", "URI <code>/i/a.png</code> → <code>/data/w3/i/a.png</code>", "the one that works with or without the trailing slash — deliberately"],
          ["<code>proxy_pass http://b/api/</code>", "n/a", "URI <code>/api/users</code> → <code>http://b/api/users</code>", "with a URI the location prefix is replaced; <code>/x/api/</code> → <code>http://b/api/</code>"],
          ["<code>proxy_pass http://b</code>", "n/a", "URI <code>/api/users</code> → <code>http://b/api/users</code>", "without a URI the original request is passed unchanged — including any location-level rewrite"]
        ]
      },
      {
        type: "prose",
        h: "BIND: the one daemon you configure once and then should not touch",
        p: [
          "Chapter 10 covers the protocol and the zone file format. Operationally, an authoritative-only BIND is close to the ideal systemd service: it forks into the background, writes <code>/run/named/named.pid</code>, answers from memory in microseconds, and has no connections to keep alive. What it does have is a long list of small operational rules that are all of the \"you will only notice when it matters\" variety.",
          "The first is that <strong>BIND on Debian and Ubuntu does not log to journald by default</strong> — it logs through <code>syslog</code>, which on 18.04 means <code>/var/log/syslog</code>. <code>journalctl -u named</code> will show you systemd's view of the process lifecycle and nothing else. If you want named's own logging — and the <code>security</code> category in particular, which records refused updates and zone transfers — either run it with <code>-g</code> to force it to stderr, or write an explicit <code>logging</code> block in <code>named.conf.options</code> pointing at a file under <code>/var/log</code>. The security category is the one that matters: it is where you find out that someone tried to update your zone, or that a secondary's transfer was refused.",
          "The second is <code>rndc</code>. The control channel listens on TCP 953 with a shared key from <code>/etc/bind/rndc.key</code>, and Debian's default <code>controls</code> block allows only localhost — which is correct, and which is why <code>rndc status</code> from another machine fails with a connection refusal that looks like a firewall problem. <code>rndc status</code> is the command that answers \"is my serial what I think it is, and when did a secondary last check\", and it is the first thing to run in any DNS incident.",
          "The third is views. Split-horizon is genuinely useful — internal clients see private addresses, the internet sees public ones — but a view is a second, parallel copy of the zone tree with its own file and its own serial, and a client that matches no view gets REFUSED for everything. Views also interact badly with secondaries and with DNSSEC: each view needs its own signing, and the zone's serial has to be bumped in both files or your two answers drift apart silently. On a single-purpose nameserver, the honest advice is not to use views unless you have a specific reason and a second zone file to maintain."
        ],
        noteKind: "fact",
        noteTitle: "Running a real secondaries provider, honestly",
        note: "A secondaries provider is not free DNS. It needs your primary on a <em>static</em> public IP — if the address changes, the provider's secondary stops and you have a stale zone until you fix it. It needs <code>allow-transfer</code> to include their source range, or every AXFR is refused and the provider falls back to <code>AXFR-IPv4</code> polling which also needs it. It needs <code>also-notify</code> so it learns about a change immediately instead of waiting out the SOA refresh. And it gives you somewhere to check: their dashboard shows the last successful check and the serial they hold, which is the fastest way to distinguish \"my primary is broken\" from \"my primary is fine and the secondaries are stale\". On this box that provider is what makes the name survive a VPS migration at all."
      },
      {
        type: "diagram",
        h: "BIND in service: the query path and the secondaries loop",
        caption: "The left half is a single query: resolved in your clients' networks asks your server, the in-memory zone tree answers, and the request is logged. The right half is the transfer loop that keeps the secondaries provider current — which is driven by the SOA serial and the refresh timer, not by anything your clients do. Almost every \"my DNS change is not live\" incident lives entirely in the right half.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="BIND query answering path and the secondary zone transfer loop driven by SOA serial">
  <!-- query path -->
  <text class="t-title" x="30" y="32">a query, from anywhere in the world</text>

  <rect class="box-a" x="30" y="48" width="200" height="60" rx="9"/>
  <text class="t-accent" x="46" y="72" font-size="14.5">recursive resolver</text>
  <text class="t-sm" x="46" y="92">1.1.1.1, 9.9.9.9</text>

  <path class="ln-a" d="M230,78 L300,78" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="300" y="48" width="230" height="60" rx="9"/>
  <text class="t-bad" x="316" y="72" font-size="14.5">your named (public :53)</text>
  <text class="t-sm" x="316" y="92">AA=1, RA=0, recursion no</text>

  <path class="ln-ok" d="M530,78 L600,78" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-ok" x="600" y="48" width="220" height="60" rx="9"/>
  <text class="t-ok" x="616" y="72" font-size="14.5">in-memory zone</text>
  <text class="t-sm" x="616" y="92">loaded from disk, resident</text>

  <path class="ln-w" d="M830,78 L890,78" marker-end="url(#lm-arrow-warn)"/>
  <rect class="box-w" x="890" y="48" width="180" height="60" rx="9"/>
  <text class="t-warn" x="906" y="72" font-size="14.5">answer</text>
  <text class="t-xs" x="906" y="92">with TTL, logged</text>

  <rect class="box-b" x="30" y="128" width="1040" height="98" rx="9"/>
  <text class="t-bad" x="46" y="152" font-size="15">what is NOT in this path</text>
  <text class="t-sm" x="46" y="176">no recursion (recursion no) — so asking it about google.com returns REFUSED, not an answer</text>
  <text class="t-sm" x="46" y="196">no cache for other people's zones — the zone is in memory because it LOADED it from disk, not because it cached an answer</text>
  <text class="t-xs" x="46" y="218">Which is why the server is fast: it is answering from RAM, and a “slow authoritative server” is usually a slow disk or a rate-limited drop.</text>

  <line class="ln" x1="30" y1="248" x2="1070" y2="248" stroke-dasharray="6 6"/>

  <!-- secondaries loop -->
  <text class="t-title" x="30" y="278">the transfer loop — nothing to do with your clients</text>

  <rect class="box-a" x="30" y="294" width="240" height="110" rx="9"/>
  <text class="t-accent" x="46" y="318" font-size="15">primary (this VPS)</text>
  <text class="t-sm" x="46" y="340">db.alexandrugris.ro</text>
  <text class="t-sm" x="46" y="360">serial 2026101102</text>
  <text class="t-xs" x="46" y="382">editors change this field</text>
  <text class="t-xs" x="46" y="396">and nothing else about the file</text>

  <rect class="box-p" x="380" y="294" width="240" height="110" rx="9"/>
  <text class="t-bad" x="396" y="318" font-size="15">secondaries provider</text>
  <text class="t-sm" x="396" y="340">holds a copy at</text>
  <text class="t-sm" x="396" y="360">198.51.100.53</text>
  <text class="t-xs" x="396" y="382">serves it to the world</text>
  <text class="t-xs" x="396" y="396">if the primary dies</text>

  <rect class="box-ok" x="730" y="294" width="340" height="110" rx="9"/>
  <text class="t-ok" x="746" y="318" font-size="15">allow-transfer</text>
  <text class="t-sm" x="746" y="340">must include their source range</text>
  <text class="t-sm" x="746" y="360">or every AXFR is refused</text>
  <text class="t-xs" x="746" y="382">default, with no rule in your zone:</text>
  <text class="t-xs" x="746" y="396">allow-transfer { *; } — your whole zone, world-readable</text>

  <path class="ln-a" d="M270,336 L378,336" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="276" y="330" font-size="12.5">AXFR</text>
  <path class="ln-a" d="M620,336 L728,336" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="628" y="330" font-size="12.5">serves</text>
  <path class="ln-v" d="M620,380 L272,380" marker-end="url(#lm-arrow-warn)" stroke-dasharray="5 4"/>
  <text class="t-sm" x="286" y="398" font-size="12.5">SOA refresh (28800s) or notify</text>

  <rect class="box-w" x="30" y="424" width="1040" height="96" rx="9"/>
  <text class="t-warn" x="46" y="448" font-size="15">the loop that keeps this honest — or does not</text>
  <text class="t-sm" x="46" y="472">rndc reload → named re-reads the file → serial newer? → load → also-notify the secondaries → they re-check within seconds.</text>
  <text class="t-sm" x="46" y="494">Without also-notify: the secondaries wait out SOA refresh. With 28800 that is up to 8 hours of a perfectly successful reload serving old records.</text>
  <text class="t-xs" x="46" y="512">The check that tells you which side is broken:  dig @198.51.100.53 alexandrugris.ro SOA +short   and compare the serial with  rndc status.</text>

  <rect class="box" x="30" y="536" width="1040" height="64" rx="9"/>
  <text x="46" y="560" font-size="15">the operational checklist</text>
  <text class="t-xs" x="46" y="582">named-checkconf -z &amp;&amp; rndc reload &amp;&amp; rndc status   ·   named-checkzone before every edit   ·   security category in the log for transfer refusals   ·   AppArmor profile /etc/apparmor.d/usr.sbin.named governs what the daemon may touch</text>
</svg>`
      },
      {
        type: "prose",
        h: "sshd: the configuration you think you wrote is not the configuration",
        p: [
          "<code>sshd -T</code> prints the <strong>effective</strong> configuration — every keyword after defaults, includes and <code>Match</code> evaluation have been resolved — for the user you name. <code>sshd -T -C user=alice,addr=203.0.113.5,host=x,laddr=10.0.0.4,lport=22</code> evaluates the match blocks for a hypothetical connection, which is the only reliable way to know what a given user will actually get. The file in <code>/etc/ssh/sshd_config</code> is a set of defaults layered under that; a commented line is not an inactive setting, it is a setting whose value is whatever the binary was compiled with.",
          "That distinction is where the security-relevant surprises live. On OpenSSH 7.6 — which is what Ubuntu 18.04 ships — <code>MaxAuthTries</code> defaults to 6 (it was 3 before 7.6), <code>MaxStartups</code> is <code>10:30:100</code>, and <code>PermitRootLogin</code> compiles to <code>prohibit-password</code>, a change made in OpenSSH 7.0 that Ubuntu's <code>sshd_config</code> leaves commented out. The trap everyone walks into is that <code>PasswordAuthentication no</code> alone does <strong>not</strong> disable password authentication: with <code>UsePAM yes</code>, the <code>keyboard-interactive</code> method is still offered and PAM will happily authenticate a password through it. Both keywords must be off, and <code>sshd -T | grep -i -E 'password|kbdinteractive'</code> is the only way to be certain on the version in front of you — the keyword was renamed on the way through OpenSSH's history and its default has moved.",
          "The structural rule that catches everyone: <strong>for most keywords the first obtained value wins</strong>, and <code>Match</code> blocks are evaluated after the global section. A <code>Match User deploy</code> block containing <code>AllowTcpForwarding no</code> works, because <code>AllowTcpForwarding</code> was never set globally. A <code>Match</code> block containing <code>PasswordAuthentication no</code> does nothing if the global section already set it to <code>no</code> earlier — the global value is the first obtained value and wins. Accumulating keywords like <code>AllowUsers</code>, <code>AllowGroups</code> and <code>AuthorizedKeysFile</code> behave differently and add up rather than override. If a setting appears not to apply, check for an earlier occurrence of the same keyword before assuming it is broken.",
          "And the last piece of sshd policy is not in sshd at all. <code>AllowUsers</code> and <code>DenyUsers</code> are enforced at connection time and are cheap; a firewall rule is enforced before the daemon sees a byte; and binding the daemon to a specific address means there is no socket to connect to at all. This box uses the last one as the primary control — sshd bound to the Tailscale address, a ufw rule allowing 22/tcp only from <code>100.64.0.0/10</code> and the LAN — because a daemon that is not listening on the public address cannot be attacked on it, regardless of what any configuration file says. <code>ClientAliveInterval</code> is the other setting worth having on: 300 with <code>ClientAliveCountMax 2</code> means dead sessions are reaped in about ten minutes instead of living until the TCP stack gives up, which keeps <code>ss</code> readable and closes the gap where an abandoned session stays authenticated."
        ]
      },
      {
        type: "diagram",
        h: "sshd: from SYN to a shell, and where policy actually bites",
        caption: "Every connection passes through four gates, and only one of them is in your configuration file. The binding address and the firewall happen before sshd exists in the process; the authentication method list is where PAM's keyboard-interactive override lives; and the <code>Match</code> evaluation at the end is the only place per-user policy applies. A brute-force attempt on a Tailscale-only host never reaches the second box on this diagram at all.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="sshd connection decision chain: listening address, firewall, authentication methods, per-user Match policy and session">
  <!-- gates -->
  <rect class="box-b" x="30" y="24" width="200" height="86" rx="9"/>
  <text class="t-bad" x="46" y="48" font-size="14.5">1. is it listening?</text>
  <text class="t-sm" x="46" y="70">ListenAddress=</text>
  <text class="t-xs" x="46" y="90">bound to the Tailscale</text>
  <text class="t-xs" x="46" y="104">address only</text>

  <path class="ln-b" d="M230,67 L268,67" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-w" x="268" y="24" width="200" height="86" rx="9"/>
  <text class="t-warn" x="284" y="48" font-size="14.5">2. does the firewall allow it?</text>
  <text class="t-sm" x="284" y="70">ufw: 22 from</text>
  <text class="t-xs" x="284" y="90">100.64.0.0/10 + LAN</text>
  <text class="t-xs" x="284" y="104">DROP elsewhere, not REJECT</text>

  <path class="ln-w" d="M468,67 L506,67" marker-end="url(#lm-arrow-warn)"/>

  <rect class="box-a" x="506" y="24" width="230" height="86" rx="9"/>
  <text class="t-accent" x="522" y="48" font-size="14.5">3. MaxStartups</text>
  <text class="t-sm" x="522" y="70">10:30:100 — unauthenticated</text>
  <text class="t-xs" x="522" y="90">connections: 10 normal, 30</text>
  <text class="t-xs" x="522" y="104">start randomly dropping, 100 refuse</text>

  <path class="ln-a" d="M736,67 L774,67" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="774" y="24" width="296" height="86" rx="9"/>
  <text class="t-bad" x="790" y="48" font-size="14.5">4. which auth methods are offered?</text>
  <text class="t-sm" x="790" y="70">pubkey, then keyboard-interactive via PAM</text>
  <text class="t-xs" x="790" y="90">PasswordAuthentication no does NOT remove keyboard-interactive. Both must be no.</text>

  <path class="ln-a" d="M920,110 L920,150" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="700" y="150" width="370" height="104" rx="9"/>
  <text class="t-accent" x="716" y="174" font-size="15">Match evaluation — the end of the file</text>
  <text class="t-sm" x="716" y="196">Match User deploy   →  AllowTcpForwarding no</text>
  <text class="t-sm" x="716" y="216">Match Address 10.0.0.0/8  →  PermitRootLogin no</text>
  <text class="t-xs" x="716" y="238">first obtained value wins, so a Match block cannot override a keyword</text>
  <text class="t-xs" x="716" y="252">already set globally. AllowUsers/AllowGroups accumulate instead.</text>

  <path class="ln-a" d="M700,202 L400,202" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="240" y="150" width="160" height="104" rx="9"/>
  <text class="t-ok" x="256" y="174" font-size="14.5">session</text>
  <text class="t-sm" x="256" y="196">fork per connection</text>
  <text class="t-xs" x="256" y="218">shell, or -N for</text>
  <text class="t-xs" x="256" y="236">tunnels only</text>

  <!-- never reaches -->
  <rect class="box-b" x="30" y="150" width="180" height="104" rx="9"/>
  <text class="t-bad" x="46" y="174" font-size="14.5">not reached</text>
  <text class="t-sm" x="46" y="196">a public scanner</text>
  <text class="t-xs" x="46" y="218">sees no listening</text>
  <text class="t-xs" x="46" y="236">socket on 0.0.0.0:22</text>

  <path class="ln-b" d="M210,202 L238,202" stroke-dasharray="4 4"/>

  <line class="ln" x1="30" y1="286" x2="1070" y2="286" stroke-dasharray="6 6"/>

  <!-- sshd -T -->
  <rect class="box" x="30" y="302" width="510" height="200" rx="10"/>
  <text x="46" y="328" font-size="15">the commands that tell you the truth</text>
  <text class="t-sm" x="46" y="354">sshd -t                       # syntax check, exits non-zero</text>
  <text class="t-sm" x="46" y="376">sshd -T                       # every effective setting, no user context</text>
  <text class="t-sm" x="46" y="398">sshd -T -C user=deploy,addr=10.0.0.4,laddr=10.0.0.4,lport=22,host=x</text>
  <text class="t-xs" x="46" y="418">…evaluates the Match blocks for that hypothetical connection</text>
  <text class="t-sm" x="46" y="442">sshd -T | grep -iE "password|kbdinteractive|rootlogin|maxauthtries"</text>
  <text class="t-sm" x="46" y="464">ss -ltnp | grep :22          # shows what is actually bound, and by whom</text>
  <text class="t-xs" x="46" y="488">A typo in sshd_config that breaks authentication leaves an existing session</text>
  <text class="t-xs" x="46" y="498">intact — that is what makes it safe to edit a Tailscale-only host at all.</text>

  <rect class="box-v" x="560" y="302" width="510" height="200" rx="10"/>
  <text class="t-violet" x="576" y="328" font-size="15">key types, and the rotation that is actually current</text>
  <text class="t-sm" x="576" y="354">ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519      # the default and the right answer</text>
  <text class="t-sm" x="576" y="376">ssh-keygen -t rsa -b 4096 -f …                  # only for clients that cannot do ed25519</text>
  <text class="t-sm" x="576" y="398">ssh-keygen -t ecdsa                            # valid, but ed25519 is preferable</text>
  <text class="t-xs" x="576" y="422">HostKeyAlgorithms and PubkeyAcceptedAlgorithms default sensibly on 7.6, but a distractor</text>
  <text class="t-xs" x="576" y="438">still running ssh-rsa (SHA-1) will fail against a modern default. That failure looks like</text>
  <text class="t-xs" x="576" y="454">a key problem and is a client configuration problem.</text>
  <text class="t-xs" x="576" y="478">Host key rotation: ssh-keygen -A regenerates all of them; distribute the new fingerprints out</text>
  <text class="t-xs" x="576" y="494">of band before restarting sshd, or every client you own will refuse to connect.</text>
</svg>`
      },
      {
        type: "code",
        lang: "conf",
        what: "The sshd policy this box actually runs, with the reasoning",
        code:
`# /etc/ssh/sshd_config — key-only, no password, no forwarding unless asked
Port 22
AddressFamily inet                       # no IPv6 listener on a box with no IPv6
ListenAddress 100.101.102.103             # THE control: bound to the Tailscale address.
                                           # Nothing listens on the public address at all,
                                           # so a public port scan reaches nothing.
                                           # Pair with a ufw rule — defence in depth, not either/or.
PermitRootLogin no                        # policy, enforced here — a policy choice, not a mechanism
AllowUsers alexandru deploy                # allow-list beats deny-list; evaluated before auth
PasswordAuthentication no
KbdInteractiveAuthentication no            # REQUIRED as well: PAM keyboard-interactive otherwise
                                           # offers passwords even with PasswordAuthentication no
                                           # (UsePAM yes is still correct and still wanted)
PubkeyAuthentication yes
AuthenticationMethods publickey           # belt and braces: refuse to even negotiate the others
MaxAuthTries 3                            # default 6 on 7.6; 3 is right for a key-only box
MaxSessions 10
LoginGraceTime 30                         # default 120; key-only auth needs no longer
AllowTcpForwarding no                     # no tunnels at all by default
AllowAgentForwarding no
PermitTunnel none                         # no /dev/net/tun from ssh
X11Forwarding no
PermitUserEnvironment no

ClientAliveInterval 300                   # default 0 = disabled. With 300 + CountMax 2, a dead
ClientAliveCountMax 2                     # session dies in ~10 min instead of lingering in CLOSE_WAIT

# ---- policy per user, at the END of the file, where Match is allowed ----
Match User deploy
    AllowTcpForwarding local               # deploy can forward a port to ITS OWN localhost
    PermitOpen 127.0.0.1:5432 127.0.0.1:6379

Match Address 192.168.1.0/24
    PasswordAuthentication yes             # LAN-only convenience; still bounded by ufw
                                          # remember: first obtained value wins, and the
                                          # global above already said no — this line is inert
                                          # unless the global setting is REMOVED, not "no".

# ---- what to actually check ----
# sshd -t                                   # syntax
# sshd -T | grep -iE 'password|kbdinter|rootlogin|maxauth|allowtcp'
# sshd -T -C user=deploy,addr=10.0.0.4,laddr=10.0.0.4,lport=22,host=x
# sshd -T | grep listenaddress             # confirms the binding, which ss -ltnp also shows
# systemctl reload sshd                     # SIGHUP: existing sessions survive
# journalctl -u ssh -n 50 --no-pager        # "Accepted publickey for … from … port … ssh2"
#                                            # "Failed password for …" — should be zero

# If you lock yourself out on a Tailscale-only host: a failed reload does NOT kill
# existing sessions, and sshd keeps its listener open on a syntax error — but a
# firewall mistake does. Keep a second session open while you test, always.`
      },
      {
        type: "prose",
        h: "The scheduling, rotation and ban machinery around them",
        p: [
          "Three small systems sit beside every service and are usually the ones left on defaults. <strong>Scheduling</strong>: cron is still the right answer for <em>wall-clock</em> schedules (\"02:00 on the first of the month\") and systemd timers for everything else. A timer gets <code>Persistent=true</code> — it runs a missed job at next boot, which cron silently does not — <code>RandomizedDelaySec</code> so ten hosts with the same timer do not stampede the same remote at 03:00, <code>AccuracySec</code> to let systemd coalesce wakeups on a battery-powered box, and systemd's own dependency and failure handling. On a single-user VPS the practical difference is that <code>systemctl list-timers</code> shows you everything that is scheduled, which cron cannot.",
          "<strong>Rotation</strong>: <code>copytruncate</code> copies the file then truncates the original, which is fast and safe from a dangling-handle perspective but loses everything written in the gap — and, for a daemon holding the file open in append mode, keeps writing into the truncated original, so the rotated copy is missing the tail of that period. <code>postrotate</code> instead sends a signal that makes the daemon reopen the file — <code>systemctl reload nginx</code>, or <code>kill -USR1 $(cat /run/nginx.pid)</code> — which loses nothing. <strong>nginx needs postrotate</strong>; a file it holds open in append mode will keep writing to the unrotated inode. <strong>journald needs neither</strong>: it manages its own rotation by size, and the only thing to do is set <code>SystemMaxUse</code> and run the vacuum.",
          "<strong>Banning</strong>: fail2ban watches the journal or a log file for a pattern, counts it over a window, and calls <code>iptables</code> or <code>nftables</code> to add a rule. On this box sshd is Tailscale-only, so fail2ban is close to redundant — but \"close to\" is not \"no\", and the configuration detail that matters is <code>ignoreip</code>: set it to the Tailscale CGNAT range and your own administrative connections, or a fat-fingered key will ban you from the machine you reach over a single link. On a machine with a public sshd it is a genuine second layer, with the honest caveat that it is trivially evaded by an attacker with more than a handful of source addresses, and that it does nothing against a slow, patient, single-IP brute force beyond adding a delay."
        ],
        noteKind: "warn",
        noteTitle: "Ubuntu 18.04 in 2026 is the actual operational risk here",
        note: "Standard support ended in April 2023. What keeps this machine safe is <strong>Ubuntu Pro / ESM</strong> (the <code>ubuntu-advantage-tools</code> client, <code>pro status</code> to verify), which delivers security patches for the installed packages and a newer kernel — <code>4.15.0-260</code> is on the box and not yet booted. The follow-up is a reboot, and the follow-up to that is that rebooting a host whose only remote access is over Tailscale carries real risk if the new kernel breaks <code>wireguard</code> or the tun driver. So: confirm <code>pro status</code>, confirm <code>unattended-upgrades</code> is running for non-kernel packages, and schedule the kernel reboot deliberately with a console-capable fallback — <code>/etc/apt/apt.conf.d/50unattended-upgrades</code> and <code>/var/log/unattended-upgrades/</code> are the files that tell you what has been applied."
      },
      {
        type: "code",
        lang: "bash",
        what: "The machinery around the services: timers, rotation, journald, bans, and unattended upgrades",
        code:
`# ---------- systemd timers instead of cron ----------
# /etc/systemd/system/backup.timer
[Unit]
Description=nightly backup

[Timer]
OnCalendar=*-*-* 03:17:00          # a wall-clock schedule — this is what cron is actually good at
RandomizedDelaySec=15m            # so ten hosts with the same timer do not hit one remote together
Persistent=true                  # run a missed job at next boot. cron does NOT do this.
Unit=backup.service

[Install]
WantedBy=timers.target

# systemctl daemon-reload && systemctl enable --now backup.timer
systemctl list-timers --all        # the command cron has no equivalent of
systemctl start backup.service     # run it now without disturbing the schedule
# AccuracySec=1m lets systemd coalesce wakeups on a laptop; on a VPS it costs nothing

# ---------- logrotate ----------
# /etc/logrotate.d/nginx  — Debian's default, and the right shape
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /run/nginx.pid ]; then
            kill -USR1 "$(cat /run/nginx.pid)"   # nginx reopens its log files
        fi
    endscript
}
# POSTROTATE, NOT COPYTRUNCATE. copytruncate is cheaper but loses whatever was written
# between the copy and the truncate — and a process holding the file open in append mode
# keeps writing to the truncated inode, so the .1 file is missing that period entirely.
# Same rule for any daemon that opens its logfiles once: signal it, do not truncate.
#
# journald needs neither. It rotates by size itself; the only knob is SystemMaxUse.

# ---------- journald ----------
# /etc/systemd/journald.conf
#   Storage=persistent            # keep across reboots; "auto" only persists if /var/log/journal exists
#   SystemMaxUse=500M              # default: 10% of the filesystem, capped at 4G. On a 19 GB disk that is ~1.9 GB.
#   RateLimitIntervalSec=30s       # defaults; burst 10000 per service
journalctl --disk-usage
journalctl --vacuum-size=300M
journalctl -u nginx --since "-1h" -p err --no-pager
journalctl -u nginx -f
# if you see "Suppressed 8421 messages from …" you are hitting the rate limiter, and the
# fix is to make the daemon log less — not to raise the burst until the disk fills

# ---------- fail2ban ----------
# /etc/fail2ban/jail.local
# [DEFAULT]
#   ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10 10.0.0.0/24
#            ^ the tailnet range and your own address. On a Tailscale-only host, banning
#            yourself locks you out of the only path in. Set this before enabling a jail.
#   bantime = 1h
#   findtime = 10m
#   maxretry = 5
# [sshd]
#   enabled = true
#   backend = systemd            # read the journal, not /var/log/auth.log
#   port = 22
fail2ban-client status sshd
fail2ban-client set sshd unbanip 100.101.104.5

# ---------- unattended-upgrades on 18.04 ----------
pro status                                   # Ubuntu Pro / ESM — this is what keeps 18.04 patched
apt-config dump | grep -i unattended
tail -40 /var/log/unattended-upgrades/unattended-upgrades.log
systemctl list-timers | grep apt             # apt-daily.timer + apt-daily-upgrade.timer
grep -r "Unattended-Upgrade::Allowed-Origins" /etc/apt/apt.conf.d/50unattended-upgrades
unattended-upgrade --dry-run --debug
# NOTE: unattended-upgrades applies package patches. A NEW KERNEL still needs a reboot,
# and unattended-upgrades deliberately does not reboot a machine for you. On a host whose
# only remote access is over Tailscale, that reboot is a planned-maintenance event, not a
# maintenance-window surprise: confirm the new kernel is installed, then reboot deliberately
# with a console-capable fallback available.`
      },
      {
        type: "callout",
        kind: "boss",
        title: "mental model to keep",
        text: "A service is three things that can disagree: a <strong>unit</strong> (how it is started, stopped, limited and restarted), a <strong>config</strong> (what it believes it should do), and the <strong>supervision contract</strong> between them (which process systemd is actually watching). When they disagree, <code>systemctl status</code> tells you what systemd believes, the daemon's own logs tell you what it believes, and <code>ss</code> tells you what the kernel can actually see. Run all three before you change anything — and prefer the daemon's own test command (<code>nginx -t</code>, <code>sshd -t</code>, <code>named-checkconf -z</code>) over restarting into a broken configuration to find out."
      }
    ],
    takeaways: [
      "systemd tracks one main PID but treats the whole cgroup as the unit. Killing a worker is harmless; killing the master is an outage; and the restart counter lives at cgroup level.",
      "Reload and restart are different guarantees. A reload never drops a connection; a restart closes and reopens the listening socket, and anything that connects in the gap is refused.",
      "Socket activation means systemd owns the port before the service exists, so <code>systemctl status sshd</code> reading inactive is not evidence that SSH is down — and <code>MaxConnections=</code> set too low will refuse your own logins.",
      "<code>ProtectSystem=strict</code> makes the whole filesystem read-only and will silently kill any daemon that writes a PID file or cache. Pair it with <code>ReadWritePaths=</code> and <code>RuntimeDirectory=</code>, and verify with <code>systemd-analyze security</code> and <code>/proc/&lt;pid&gt;/status</code>.",
      "nginx's <code>worker_connections</code> counts upstream connections too, so a reverse proxy's real ceiling is roughly half of processes × connections. <code>worker_rlimit_nofile</code> is a ceiling, not a grant — <code>LimitNOFILE</code> in the unit must be at least as large.",
      "In nginx, <code>alias</code> replaces the location prefix and <code>root</code> appends to it. The trailing-slash mismatch between <code>location</code> and <code>alias</code> is the single most common silent 404 in a hand-written config.",
      "BIND on Debian and Ubuntu logs to syslog, not journald, unless you run it with <code>-g</code>. The <code>security</code> category is where refused transfers and update attempts appear.",
      "Secondaries only learn about a change when the SOA serial changes and either <code>also-notify</code> fires or the refresh timer expires. That is the whole loop, and a stale secondary is not a bug on their side.",
      "<code>PasswordAuthentication no</code> does not stop password authentication when <code>UsePAM yes</code> — <code>keyboard-interactive</code> must also be off. And <code>sshd -T</code>, not the config file, is the effective configuration.",
      "The strongest sshd control is not a config keyword: it is not binding the daemon to the public address at all. On a Tailscale-only host that is two independent layers, and neither one can be undone by a package install."
    ],
    glossary: {
      "unit": "The systemd file describing a service: how to start it, what to restart it on, what limits and namespaces it runs under.",
      "Type=forking": "The unit expects the service to daemonise and write a PID file; systemd waits for that file rather than tracking a child it spawned.",
      "PIDFile=": "Where the daemonised master writes its PID. systemd trusts this number completely, which is why a stale file can make it track the wrong process.",
      "cgroup": "The kernel resource and lifecycle boundary systemd applies to a unit. On cgroups v1 the controllers are separate trees; on v2 there is one unified hierarchy.",
      "Reload": "Asking a running process to re-read configuration without losing state or dropping connections. Not every service can do it.",
      "socket activation": "systemd creates, binds and listens on the socket, then passes the descriptor to the service when a connection arrives. No refused-connection window.",
      "ListenStream=": "The [Socket] directive that turns a unit into a socket unit: a port (or path) systemd opens at boot.",
      "ProtectSystem=": "Mount-namespace hardening: full makes /usr and /boot read-only, strict makes everything read-only except /dev, /proc and /sys.",
      "SystemCallFilter=": "A seccomp-bpf allowlist or denylist of system calls. Namespaces such as @system-service are curated groups, but must be tested per daemon.",
      "worker_connections": "Simultaneous connections one nginx worker can hold — including connections to upstream backends, which is routinely forgotten.",
      "root vs alias": "root appends the location prefix to the file path; alias replaces it. The trailing slash on both must agree or every request 404s silently.",
      "Match block": "A conditional section in sshd_config, valid only at the end of the file. For most keywords the first obtained value wins, so it cannot override a global setting.",
      "rndc": "BIND's remote control daemon: authenticated on TCP 953 with a key from /etc/bind/rndc.key, used for reload, status and zone transfers.",
      "serial": "The SOA field that gates every reload and every zone transfer. Bump it or nothing changes, no matter how many reloads you perform.",
      "fail2ban": "A log-watching ban list: counts failed authentications over a time window and adds firewall rules. Must be told to ignore your own address range.",
      "unattended-upgrades": "The Debian/Ubuntu package that applies security updates on a timer. /var/log/unattended-upgrades/ is the record of what it actually did."
    }
  });
})();