/* ch06 — systemd: the supervisor */
(function () {
  LX.push({
    id: "systemd",
    title: "systemd: the supervisor everything else answers to",
    tagline: "PID 1 mounts things, starts things, watches things, and writes down what happened. It also happens to be the machine's cgroup manager — which is why it can kill a whole service in one operation.",
    sections: [
      {
        type: "prose",
        h: "What PID 1 is actually for",
        p: [
          "Before systemd, PID 1 was <code>init</code>: a program that forked and waited, executing a shell script of start commands. It did not know what a dependency was, could not restart a failed service, could not see that a process had become a zombie, and had no way to record that anything had happened. That is why old systems had <code>rc.local</code>, <code>update-rc.d</code>, <code>start-stop-daemon</code>, <code>daemon</code>, <code>chkconfig</code>, <code>service</code>, <code>insserv</code> and a small collection of shell scripts that nobody fully understood.",
          "systemd replaced all of that with one idea: <strong>describe the units, declare the graph, then reconcile it forever.</strong> It does four jobs, and knowing the four jobs makes the rest of its behaviour predictable.",
          "One caution before going further: almost everything people find strange about systemd is a consequence of <em>state machines with timers</em>, not of some exotic feature. A unit is always in exactly one state, every transition has a timeout, and the same three questions — what state, how long have you been there, and what did the last attempt log — answer most of its behaviour."
        ]
      },
      {
        type: "cards",
        items: [
          { title: "Mount", tag: "FS", tone: "warn", text: "Turns <code>/etc/fstab</code> into <code>*.mount</code> units, assembles early/late mounts, fsck's filesystems, remounts root rw, and sets up the API filesystems. This is why a bad fstab entry can stop boot entirely — and why <code>systemd-fsck</code> sometimes runs before your service." },
          { title: "Spawn", tag: "LIFECYCLE", tone: "ok", text: "Resolves the dependency graph, starts units in parallel where the graph allows, tracks every state transition, and enforces start/stop timeouts. Two units with no ordering between them start <em>concurrently</em> — which is why an app can lose the race to its database without any <code>Requires=</code> being obviously wrong." },
          { title: "Supervise", tag: "WATCHDOG", tone: "violet", text: "Holds a <code>Restart=</code> policy, kills whole process trees through cgroups rather than by guessing PIDs, tracks exit codes, and can freeze a unit (<code>systemctl freeze</code>) for consistent on-disk snapshots or kernel upgrades." },
          { title: "Record", tag: "JOURNAL", tone: "", text: "Everything — its own messages, every process's stdout/stderr, kernel ring buffer, service logs — goes into the journal, with structured fields you can query. <code>journalctl</code> is not a log viewer here; it is the machine's primary log store." }
        ]
      },
      {
        type: "diagram",
        h: "The unit lifecycle, with the timeouts that govern it",
        caption: "A unit is always in exactly one state, and every edge can time out. <b>failed</b> is a real state, not an adjective — it means a start attempt hit <code>TimeoutStartSec</code> or the service exited with a non-zero status. The most useful diagnostic questions are therefore always: <em>what state, how long, what did it log</em>.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="systemd unit state machine">
  <rect class="box" x="60" y="240" width="130" height="52" rx="9"/>
  <text class="t-sm" x="125" y="262" text-anchor="middle">dead</text>
  <text class="t-xs" x="125" y="280" text-anchor="middle">inactive</text>

  <path class="ln-a" d="M190,252 L320,252" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="196" y="244">systemctl start</text>
  <path class="ln" d="M320,270 L190,278" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="196" y="292">stop</text>

  <rect class="box-a" x="320" y="216" width="170" height="100" rx="10"/>
  <text class="t-accent" x="405" y="242" text-anchor="middle">activating</text>
  <text class="t-sm" x="405" y="266" text-anchor="middle">(start type)</text>
  <text class="t-xs" x="405" y="288" text-anchor="middle">Type=simple → instant</text>
  <text class="t-xs" x="405" y="304" text-anchor="middle">Type=notify → waits for</text>

  <path class="ln-ok" d="M490,252 L610,252" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-xs" x="492" y="244">READY=1</text>
  <path class="ln-b" d="M405,316 L405,366" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <text class="t-xs" x="412" y="340" font-size="13">TimeoutStartSec=90s →</text>

  <rect class="box-b" x="330" y="366" width="150" height="52" rx="9"/>
  <text class="t-bad" x="405" y="388" text-anchor="middle">failed</text>
  <text class="t-xs" x="405" y="406" text-anchor="middle">exit≠0 or timeout</text>

  <rect class="box-ok" x="610" y="226" width="180" height="52" rx="10"/>
  <text class="t-ok" x="700" y="250" text-anchor="middle">active (running)</text>
  <text class="t-xs" x="700" y="268" text-anchor="middle">the only “good” state</text>

  <path class="ln" d="M700,278 L700,330" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="708" y="302">systemctl stop</text>

  <rect class="box-w" x="610" y="330" width="180" height="72" rx="10"/>
  <text class="t-warn" x="700" y="354" text-anchor="middle">deactivating</text>
  <text class="t-xs" x="700" y="374" text-anchor="middle">SIGTERM to the group,</text>
  <text class="t-xs" x="700" y="392" text-anchor="middle">then SIGKILL after</text>
  <text class="t-xs" x="700" y="398"></text>
  <text class="t-xs" x="700" y="400" font-size="1"></text>
  <path class="ln" d="M700,402 L700,406" />
  <path class="ln" d="M610,366 L500,366" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="510" y="360">TimeoutStopSec → SIGKILL</text>
  <path class="ln-b" d="M440,402 L440,366" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <path class="ln" d="M610,356 L500,356" />

  <path class="ln" d="M610,346 L480,346" marker-end="url(#lm-arrow)" stroke-dasharray="3 3"/>
  <text class="t-warn" x="500" y="340" font-size="12.5">→ still failed</text>

  <path class="ln-a" d="M790,252 L880,252" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="790" y="244" font-size="13">Restart=on-failure</text>
  <path class="ln" d="M880,252 L920,252 L920,150 L920,150" />
  <path class="ln-a" d="M880,266 L880,160 L560,160 L560,232" marker-end="url(#lm-arrow-accent)" stroke-dasharray="5 5"/>
  <text class="t-xs" x="620" y="152" font-size="13">after RestartSec=100ms → activating again. Count against StartLimitBurst (default 5/10s) → stops for good.</text>

  <!-- reload -->
  <path class="ln-v" d="M745,226 L745,190" marker-end="url(#lm-arrow)" stroke-dasharray="3 3"/>
  <text class="t-violet" x="752" y="206" font-size="12.5">reload (SIGHUP or reload.target / nginx -s reload)</text>

  <rect class="box-a" x="60" y="440" width="1000" height="106" rx="10"/>
  <text class="t-accent" x="78" y="464" font-size="15">The five questions that explain any systemd problem</text>
  <text class="t-sm" x="78" y="488">1. What state is the unit in, and since when?   systemctl status x  ·  systemctl show x -p ActiveState -p SubState -p ActiveEnterTimestamp</text>
  <text class="t-sm" x="78" y="510">2. What does the <tspan font-style="italic">effective</tspan> configuration actually say?   systemctl cat x (unit + drop-ins)  ·  systemctl show x (all properties)</text>
  <text class="t-sm" x="78" y="532">3. What did it log on <tspan font-style="italic">this boot, this attempt</tspan>?   journalctl -u x -b -n 50 — without -b you are reading last week's failure</text>
  <text class="t-xs" x="78" y="546">4. Is it enabled for the right target?   systemctl is-enabled x  ·  5. What is it actually doing right now?   systemd-cgls · ps in its cgroup</text>
</svg>`
      },
      {
        type: "prose",
        h: "Units: pick the right type, or the wrong one will surprise you",
        p: [
          "Every managed thing is a <strong>unit</strong>, identified by a name and a suffix. The suffix determines which start <em>type</em> systemd uses, which is the single most important thing to get right, because it decides what “started” means.",
          "The distinction that catches everyone: with <code>Type=simple</code> systemd considers the unit active <em>the instant after fork</em> — before <code>execve</code>, before the first line of your code runs. That is correct and fast, but it means <code>systemctl start foo</code> returning successfully says nothing about whether foo works. With <code>Type=notify</code> your program must call <code>sd_notify(READY=1)</code> itself, and systemd waits — which is the only way to make “started” mean “ready”."
        ]
      },
      {
        type: "table",
        cols: ["Unit", "Represents", "Start semantics", "Use it when"],
        rows: [
          ["<code>.service</code>", "A long-running program", "<code>Type=</code> decides: simple / exec / notify / forking / oneshot / idle", "95% of the time: daemons, scripts, anything you start with start/stop"],
          ["<code>.socket</code>", "A listening socket activated on connection", "Binds immediately; the paired <code>.service</code> starts per connection", "<code>sshd.socket</code>, database servers with connection pooling, anything where the port must answer before the daemon is warm"],
          ["<code>.target</code>", "A group of units = a stage", "Starts everything it Wants/Requires", "<code>multi-user.target</code>, <code>rescue.target</code>, your own bundles"],
          ["<code>.mount</code>", "A filesystem mountpoint", "Mounts and generates from <code>/etc/fstab</code>", "Never write one by hand — let systemd generate it from fstab"],
          ["<code>.automount</code>", "A mount that happens on first access", "Arms, then mounts on first open", "<code>/mnt/remote</code> that may be unreachable; prevents boot hangs on dead network mounts"],
          ["<code>.timer</code>", "A scheduled activation of another unit", "Fires per <code>OnCalendar=</code> or <code>OnUnitActiveSec=</code>", "Replaces cron for anything that should be a supervised unit"],
          ["<code>.path</code>", "Trigger on a file change", "Inotify watch, starts a unit on change", "“Reload nginx when this file appears”. Simpler than most cron hacks"],
          ["<code>.slice</code>", "A grouping that owns resource limits", "Not started directly; parents other units", "<code>user-1000.slice</code>, <code>system.slice</code>, <code>docker.slice</code>"],
          ["<code>.scope</code>", "Processes systemd did not start", "Adopted and watched", "Login sessions, <code>systemd-run --scope</code>, <code>docker run</code> under cgroup-driver=systemd"],
          ["<code>.swap</code>", "A swap device", "Generated from fstab", "Rarely hand-written"],
          ["<code>.device</code>", "A hardware device appearing", "Exists when udev reports it", "You mostly consume these, never write them"]
        ]
      },
      {
        type: "diagram",
        h: "systemd is the cgroup manager — this is the under-documented part",
        caption: "Every unit is a cgroup. That single fact explains why <code>systemctl restart</code> can reliably kill <em>every</em> descendant including double-forked daemons that escaped their parent, why <code>systemd-cgtop</code> shows a live tree, why <code>MemoryMax=</code> on a unit is exact rather than approximate, and why Docker with <code>cgroup-driver=systemd</code> hands container limits to the same manager. Chapter 04 covers the kernel side of this; the operational consequence is on this page.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="systemd unit to cgroup mapping and the restart sequence">
  <text class="t-title" x="30" y="28">one unit = one cgroup = one place to look</text>

  <rect class="box-ok" x="30" y="44" width="300" height="150" rx="10"/>
  <text class="t-ok" x="48" y="68" font-size="15">nginx.service</text>
  <text class="t-xs" x="48" y="90">/sys/fs/cgroup/system.slice/</text>
  <text class="t-xs" x="48" y="106">  nginx.service/</text>
  <text class="t-sm" x="48" y="132">├─ cgroup.procs        every PID here</text>
  <text class="t-sm" x="48" y="152">├─ memory.current     bytes charged</text>
  <text class="t-sm" x="48" y="172">├─ memory.max         the limit</text>
  <text class="t-sm" x="48" y="186">└─ pids.current/max   task accounting</text>

  <rect class="box-a" x="360" y="44" width="310" height="150" rx="10"/>
  <text class="t-accent" x="378" y="68" font-size="15">systemctl restart nginx</text>
  <text class="t-xs" x="378" y="92">1. SIGTERM to every task in the cgroup</text>
  <text class="t-xs" x="378" y="112">   (KillMode=control-group, the default)</text>
  <text class="t-xs" x="378" y="132">2. wait up to TimeoutStopSec (default 90 s)</text>
  <text class="t-xs" x="378" y="152">3. anything still there gets SIGKILL</text>
  <text class="t-xs" x="378" y="172">4. if the kernel knows the cgroup is empty,</text>
  <text class="t-xs" x="378" y="186">   it is emptied synchronously — no orphans</text>

  <rect class="box-b" x="700" y="44" width="370" height="150" rx="10"/>
  <text class="t-bad" x="718" y="68" font-size="15">Why this beats kill by PID</text>
  <text class="t-xs" x="718" y="92">· a daemon that double-forked and changed its</text>
  <text class="t-xs" x="718" y="108">  process group is still in the cgroup</text>
  <text class="t-xs" x="718" y="128">· one syscall catches every descendant,</text>
  <text class="t-xs" x="718" y="144">  including workers you never knew existed</text>
  <text class="t-xs" x="718" y="164">· limits are exact, because the accounting</text>
  <text class="t-xs" x="718" y="180">  happens in the same tree it manages</text>

  <path class="ln-a" d="M550,194 L550,226" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="562" y="214">observable while it runs</text>

  <rect class="box-v" x="30" y="226" width="510" height="180" rx="10"/>
  <text class="t-violet" x="48" y="252" font-size="15">the three tools that show you the truth</text>
  <text class="t-sm" x="48" y="278">systemctl status nginx</text>
  <text class="t-xs" x="66" y="296">the cgroup tree, plus the last log lines — one screen, most of the time enough</text>
  <text class="t-sm" x="48" y="322">systemctl show nginx -p MemoryCurrent -p TasksCurrent -p ExecMainStatus -p NRestarts</text>
  <text class="t-xs" x="66" y="340">effective runtime values, which is where restart loops and silent limit hits show up</text>
  <text class="t-sm" x="48" y="366">systemd-cgls --no-pager</text>
  <text class="t-xs" x="66" y="384">the whole cgroup forest — use this when you have lost track of which processes belong to what</text>

  <rect class="box-w" x="560" y="226" width="510" height="180" rx="10"/>
  <text class="t-warn" x="578" y="252" font-size="15">the change that bites: cgroups v1 → v2</text>
  <text class="t-sm" x="578" y="278">systemd 237 (Ubuntu 18.04, your box) manages v1 trees.</text>
  <text class="t-sm" x="578" y="300">On a v2 host the same unit controls the same things through one</text>
  <text class="t-sm" x="578" y="318">hierarchy, so accounting is exact rather than estimated — and a</text>
  <text class="t-sm" x="578" y="336">unit that hard-caps memory on v1 can still be killed by the</text>
  <text class="t-sm" x="578" y="354">host OOM killer, which then blames the largest process on</text>
  <text class="t-sm" x="578" y="372">the machine instead of the unit that caused it.</text>
  <text class="t-xs" x="578" y="396">Run stat -fc %T /sys/fs/cgroup/: cgroup2fs means v2, tmpfs means v1.</text>

  <text class="t-title" x="30" y="446">drop-in overrides — the correct way to change anything</text>
  <rect class="box-a" x="30" y="458" width="1040" height="146" rx="10"/>
  <text class="t-sm" x="48" y="484">systemctl edit nginx          →  writes /etc/systemd/system/nginx.service.d/override.conf (interactive, with a comment)</text>
  <text class="t-sm" x="48" y="510">systemctl edit --runtime nginx  →  same, in /run/systemd/system/ — <tspan font-weight="700">lost on reboot</tspan>, perfect for experiments</text>
  <text class="t-sm" x="48" y="536">systemctl revert nginx        →  remove all drop-ins and go back to the packaged unit</text>
  <text class="t-xs" x="48" y="562">Never edit the file in /lib/systemd/system/. It belongs to the package, it will be overwritten by the next upgrade, and</text>
  <text class="t-xs" x="48" y="582">systemctl will happily accept the change and then a dpkg upgrade will silently remove it — usually months later. This is the</text>
  <text class="t-xs" x="48" y="598">single most common cause of “my config change disappeared and I have no idea when”. systemctl cat nginx shows the merged view,</text>
  <text class="t-xs" x="48" y="600" font-size="1"></text>
  <text class="t-xs" x="48" y="598">and systemctl show nginx -p FragmentPath -p DropInPaths tells you which files are actually in play.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Dependencies, ordering, and the failure modes that follow",
        p: [
          "systemd distinguishes two questions that everyone conflates. <strong>Should this unit start?</strong> is about dependency: <code>Requires=</code>, <code>Wants=</code>, <code>Requisite=</code>, <code>BindsTo=</code>, <code>PartOf=</code>, <code>Upholds=</code>. <strong>In what order?</strong> is about ordering: <code>Before=</code> and <code>After=</code>. A unit can require another without ordering it, and — the source of an entire genre of bug — it can be ordered after something it does not depend on at all, which means it may start first anyway if the other one is not in the graph.",
          "The subtle ones are worth naming. <code>BindsTo=</code> is stronger than <code>Requires=</code>: if the bound unit goes inactive (not just fails to start), this one is stopped too — the correct choice for a mount or a network a service genuinely cannot work without. <code>PartOf=</code> propagates stop and restart <em>from</em> a unit to this one, which is how you restart a whole stack with <code>systemctl restart nginx.target</code>. <code>Upholds=</code> is the inverse of Wants: it keeps a unit running continuously while you remain active, which is how <code>systemd-logind</code> holds sessions.",
          "The generator problem is the other classic. systemd <em>generates</em> unit files from <code>/etc/fstab</code> (mount units), from udev (device units), from the sysinit targets (many <code>-.mount</code> entries), from <code>getty</code> on consoles, and from D-Bus activation requests. A unit you cannot find as a file still exists. <code>systemctl cat</code> shows generated units too; if the path is <code>/run/systemd/generator/</code>, it was made by something, not written by you."
        ],
        noteTitle: "The failure everyone hits",
        note: "A unit that is <b>Wanted</b> by a target and fails to start produces a warning and boot continues. A unit that is <b>Required</b> and fails drops the target, which lands you in emergency.target. So a target declaring <code>Requires=</code> for something fragile turns a small failure into an unbootable machine — which is exactly the wrong trade for most services. <code>WantedBy=</code> for things you want running; <code>Requires=</code> only for things the box is genuinely broken without.",
        noteKind: "warn"
      },
      {
        type: "code",
        lang: "bash",
        what: "The systemd toolkit — effective config, dependencies, and runtime state",
        code:
`# the merged unit + every drop-in, with file paths
systemctl cat nginx
systemctl show nginx -p FragmentPath -p DropInPaths -p ExecStart

# effective properties: this is where truth lives, not in the .service file
systemctl show nginx -p MemoryMax -p MemoryCurrent -p TasksMax -p TasksCurrent
systemctl show nginx -p NRestarts -p ExecMainStatus -p Result -p ActiveState
systemctl show ssh  -p MaxConnections -p Listen

# the graph, both directions
systemctl list-dependencies multi-user.target --no-pager
systemctl list-dependencies --reverse nginx          # what breaks if nginx dies
systemctl list-units --type=service --state=failed

# control
systemctl daemon-reload                    # required after editing any unit file
systemctl enable --now nginx               # link into the target AND start now
systemctl reload nginx                     # no restart: workers finish in-flight requests
systemctl try-restart nginx                # restart only if it is running
systemctl reset-failed nginx               # clear the start-limit tripwire
systemctl mask nginx / unmask nginx        # make it impossible to start, deliberately
systemctl set-property nginx MemoryMax=512M # persistent drop-in, correct way
systemctl edit nginx                       # interactive drop-in
systemctl revert nginx                     # undo all drop-ins

# transient units: no files, no package, gone on reboot
systemd-run --unit=backup --on-active=10m /usr/local/bin/dump.sh
systemd-run --scope -p MemoryMax=256M -p NoNewPrivileges=yes -- some-command
systemd-run --pty --wait --collect bash      # an interactive root shell as a proper unit

# explore the cgroup forest (v1 paths on 18.04, v2 on modern kernels)
systemd-cgls
systemd-cgtop --depth=3
systemctl show nginx -p ControlGroup         # then ls that path directly

# freeze for a consistent backup, or before a kernel upgrade
systemctl freeze nginx && tar -C /var/www -cf - . && systemctl thaw nginx

# start-up analysis
systemd-analyze blame | head -20
systemd-analyze critical-chain
systemd-analyze security sshd               # hardening score, item by item
systemd-analyze verify                      # typos and unused directives in your units`
      },
      {
        type: "prose",
        h: "journald: the log store you will actually use",
        p: [
          "journald collects stdout, stderr, the kernel ring buffer, and its own messages into a single binary, structured, indexed store. Every record carries fields — <code>_SYSTEMD_UNIT</code>, <code>_PID</code>, <code>USER</code>, <code>_BOOT_ID</code>, <code>PRIORITY</code>, <code>MESSAGE_ID</code> — which is why <code>journalctl -u nginx -p err -b -1</code> is a precise query rather than a grep over text.",
          "Three practical consequences. <strong>It is per-boot by nature</strong>, so <code>-b</code> (this boot) and <code>-b -1</code> (the previous one) are the most useful flags you will ever learn; “why did it reboot” is answered by <code>journalctl -b -1 -p warning</code>. <strong>It rate-limits</strong>, which is a feature and a surprise: a loop spewing 10 000 lines/second produces <code>Suppressed 12412 messages from …</code> in the journal, so the log you read is a summary of a storm rather than the storm. <strong>It has no integrity protection</strong> — root can edit it, and an attacker who is root owns the story.",
          "Configuration lives in <code>/etc/systemd/journald.conf</code>. On your 18.04 box it is already capped at <code>SystemMaxUse=300M</code> with <code>SystemKeepFree=1G</code>, which is correct for a 19 GB disk: an uncapped journald filled 1.8 GB there once. <code>Storage=</code> can be <code>persistent</code> (survives reboot), <code>auto</code> (only if <code>/var/log/journal</code> exists) or <code>volatile</code> (RAM only), and <code>ForwardToSyslog=</code> controls whether <code>/var/log/syslog</code> also gets a copy — turning it off is the honest answer if nothing else reads that file."
        ],
        kv: {
          h: "Journal queries worth memorising",
          items: [
            { k: "journalctl -u nginx -f", v: "Follow one unit. The single most useful command on a server." },
            { k: "journalctl -b -p err", v: "Errors from <em>this boot</em> only. Without <code>-b</code> you are reading history." },
            { k: "journalctl --since \"-2h\" --until \"-1h\"", v: "A window. Combine with <code>-u</code>, <code>_PID</code>, <code>-t</code> for a syslog facility." },
            { k: "journalctl _PID=1234", v: "Everything one process wrote, across all boots. Survives restarts, unlike <code>/proc</code>." },
            { k: "journalctl -k", v: "The kernel ring buffer — hardware probes, OOM kills, driver errors. (Same as <code>dmesg</code> but with timestamps and filtering.)" },
            { k: "journalctl -t sshd", v: "By syslog facility instead of unit." },
            { k: "journalctl _UID=1000 --user", v: "A specific user's session scope." },
            { k: "journalctl -x", v: "Add the explanatory text of known messages — often the fastest way to decode a cryptic line." },
            { k: "journalctl -o short-precise", v: "Milliseconds. The only format that shows you a race between two services." },
            { k: "journalctl --disk-usage / --vacuum-size=300M", v: "Size and cleanup. Use <code>--vacuum-time</code> to keep N days instead." },
            { k: "journalctl LIST", v: "Which boots exist. If a boot is missing, that boot did not reach <code>journald</code> — a kernel panic, or an initramfs failure." }
          ]
        }
      },
      {
        type: "prose",
        h: "Timers: replacing cron, badly, on purpose",
        p: [
          "A <code>.timer</code> activates a <code>.service</code>. The benefit over cron is not scheduling — it is supervision: the job runs as a unit, gets the same cgroup accounting, the same journal, the same timeout enforcement, the same <code>OnFailure=</code> escalation, and the same visibility into its exit code as anything else on the machine.",
          "The two schedule types behave differently and the difference causes real bugs. <code>OnCalendar=</code> is wall-clock: <code>OnCalendar=daily</code>, <code>weekly</code>, <code>*-*-01 04:00:00</code>, <code>Mon..Fri 09:00</code>. It respects the local timezone, and <strong>local time is decided by <code>/etc/localtime</code></strong> — so a machine that gets its timezone wrong runs jobs at the wrong hour, often after a DST transition. <code>Persistent=true</code> additionally runs a missed job once after boot, which is the behaviour you actually want for backups and which plain cron does not give you.",
          "<code>OnUnitActiveSec=</code> is monotonic: “15 minutes after the unit last <em>finished</em>”. It ignores the clock entirely, so it survives NTP steps and timezones, and the gap is measured from the end of the run — which is the behaviour you want for anything that must not overlap. <code>OnBootSec=</code> counts from boot.",
          "Finally, the one that makes people think systemd is broken: <code>AccuracySec=</code> defaults to one minute, so a timer set for 04:00 fires at some random instant within a minute of 04:00. systemd coalesces timers to save power, exactly as cron does on some systems. Set <code>AccuracySec=1s</code> if the exact second matters, and understand that <code>RandomizedDelaySec=</code> is a feature for load spreading, not a bug."
        ]
      },
      {
        type: "code",
        lang: "conf",
        what: "A timer, a service, an escalation path, and the user-session variant — all real, all runnable",
        code:
`# /etc/systemd/system/backup.service  — a job that is a unit, so it gets a journal and an exit code
[Unit]
Description=Nightly database dump to /var/backups
Documentation=man:systemd.service(5)

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/local/bin/pg_dump --format=custom --file=/var/backups/db.dump
# hardening that costs this job nothing
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/backups
# if this fails, someone should find out
SuccessExitStatus=0

# /etc/systemd/system/backup.timer
[Unit]
Description=Run the dump every night at 04:15 local time
[Timer]
OnCalendar=*-*-* 04:15:00
Persistent=true              # if the machine was off at 04:15, run it once after boot
AccuracySec=1s               # default is 1 minute of deliberate slop
RandomizedDelaySec=0
Unit=backup.service
[Install]
WantedBy=timers.target

# /etc/systemd/system/backup-failed@.service — OnFailure escalation
[Unit]
Description=Notify on failure of %i
OnFailure=backup-failed@%n.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/notify-ops "dump of %i failed"

# enable both, then verify rather than assume
systemctl daemon-reload
systemctl enable --now backup.timer
systemctl list-timers --all                 # NEXT / LEFT / LAST / PASSED / UNIT — the sanity check
systemd-analyze calendar "Mon..Fri 09:00"    # what will systemd actually do with that OnCalendar?
faketime --date "@$NEXT" date                # is my timezone what I think it is?

# the user-unit variant (runs with no login when lingering is on)
#   ~/.config/systemd/user/app.service  +  ~/.config/systemd/user/app.timer
#   loginctl enable-linger alexgris        # the manager survives logout AND reboot
#   systemctl --user status app.timer
#   journalctl --user -u app.service`
      },
      {
        type: "callout",
        kind: "boss",
        title: "Two systemd habits that prevent most future incidents",
        text: "<b>One:</b> never edit a file in <code>/lib/systemd/system/</code>. Use <code>systemctl edit</code> so your change is a drop-in with a header comment explaining why — it survives upgrades, and <code>systemctl revert</code> can undo it.<br><br><b>Two:</b> before you restart anything that is currently working, ask <code>systemctl show &lt;unit&gt; -p NRestarts -p ExecMainStartTimestamp</code>. A unit that has been up for months and restarts cleanly is a unit whose outage you are choosing to cause; the same unit that restarted nine times in an hour is telling you something, and <code>journalctl -u &lt;unit&gt; -b -1</code> will tell you what."
      },
      {
        type: "prose",
        h: "systemd 237 on your box versus a modern host",
        p: [
          "Your VPS runs systemd 237, which shipped with Ubuntu 18.04 and is roughly eight years old. It is still a perfectly capable supervisor, but several defaults have changed, and if you ever move these exact unit files to a newer machine the differences are worth knowing rather than discovering.",
          "cgroups are the big one: 237 manages v1 hierarchies, while systemd 245+ on a v2 host manages the unified tree. Unit files are mostly portable, but anything you wrote against <code>/sys/fs/cgroup/*/…</code> paths, or any third-party unit that pokes cgroups directly, is not.",
          "Other changes that matter in practice: <code>ProtectProc=</code>, <code>ProcSubset=</code>, <code>PrivateUsers=</code> and <code>RestrictFileSystems=</code> are newer directives that 237 will ignore — and, critically, <strong>ignored is silent</strong>. A unit hardened on a modern machine and copied to an old one is not hardened; it just looks it. <code>systemd-analyze verify</code> catches unknown directives and is worth running on any unit you have hand-written, and the habit of checking <code>systemctl show -p</code> on the property you think you set is worth more than memorising which version introduced what."
        ]
      }
    ],
    takeaways: [
      "A unit is always in exactly one state, and every transition has a timeout. <strong>State, duration, log</strong> — those three answer nearly every systemd question.",
      "<code>Type=simple</code> means active the instant after fork; <code>Type=notify</code> means active when your program says so. Choosing wrong makes “started” meaningless.",
      "<strong>Every unit is a cgroup</strong>, so <code>systemctl restart</code> kills whole process trees reliably and resource limits are exact. That is the least-known and most important systemd fact.",
      "<code>After=</code> sequences, <code>Requires=</code> creates dependency, and confusing them produces races and unexpected boot failures.",
      "Drop-ins via <code>systemctl edit</code>, never edits to <code>/lib/systemd/system/</code>. A package upgrade will otherwise delete your config with no warning.",
      "<code>journalctl -b -1</code> answers “why did it restart”, and <code>journalctl -u x -f</code> answers almost everything else. Rate limiting means a storm is summarised, not recorded.",
      "Timers fire up to <code>AccuracySec</code> (1 minute by default) late, on purpose. On an old systemd, verify that newer hardening directives are actually understood rather than silently ignored."
    ],
    glossary: {
      "unit": "A systemd-managed object: service, socket, target, mount, timer, slice, scope, path. The .service file is one kind of unit.",
      "Type=" : "Start semantics for a service: simple, exec, notify, forking, oneshot, idle. Decides what 'active' means.",
      "sd_notify": "The libc call a Type=notify service uses to report READY=1 or STATUS=... to systemd over its notify socket.",
      "activating / deactivating": "The transitional states. Being stuck in either means a timeout is coming, and the reason is in the journal.",
      "failed": "A state, not an adjective: the unit's last start failed or timed out. Reset with systemctl reset-failed.",
      "Wanted vs Required": "Required failing takes its dependents down with it (and can drop boot to emergency.target). Wanted failing only warns.",
      "BindsTo / PartOf": "BindsTo stops the unit if the bound unit goes inactive. PartOf propagates stop/restart from another unit.",
      "drop-in": "A snippet in /etc/systemd/system/<unit>.d/*.conf that overrides parts of the packaged unit. The correct way to configure anything.",
      "mask": "Symlinking a unit to /dev/null so it can never start. Deliberate, and reversible with unmask.",
      "scope": "A unit for processes systemd did not start — login sessions, systemd-run --scope, or containers under the systemd cgroup driver.",
      "slice": "A unit that groups others and carries resource limits. The hierarchy user-1000.slice / session-3.scope is how logind accounts for a login.",
      "D-Bus activation": "Starting a unit on demand when something calls its D-Bus name. Another form of socket activation, used by NetworkManager, polkitd and udisks.",
      "AccuracySec": "How far a timer may drift from its scheduled time. Default 1 minute — the reason timers look 'late'.",
      "Persistent=true": "Run a missed calendar timer once after the machine was off. The behaviour plain cron will not give you.",
      "systemd-analyze": "The diagnostic suite: blame, critical-chain, verify (syntax/unknown directives), security (hardening score).",
      "OnFailure=": "Links a unit to a handler that runs when it fails — the systemd-native replacement for a monitoring crontab."
    }
  });
})();