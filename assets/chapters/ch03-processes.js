/* ch03 — Processes: the unit of everything */
(function () {
  LX.push({
    id: "processes",
    title: "Processes, threads, and the process tree",
    tagline: "A process is a kernel object that owns some memory, some file descriptors and a slot in a scheduler queue. Everything on Linux is a file or a process.",
    sections: [
      {
        type: "prose",
        h: "What a process actually is",
        p: [
          "A process is not a program. A program is a file on disk — inert text. A process is what the kernel creates when something <em>executes</em> that file: a <code>task_struct</code> in kernel memory holding a PID, a parent pointer, credentials, a set of open file descriptors, a signal mask, an address space reference, a cgroup membership, and a pointer to the scheduler's run queue.",
          "Because the kernel stores that structure, <strong>/proc is a filesystem view of the kernel's own data structures</strong>. There is no database behind <code>/proc</code>; reading <code>/proc/1234/status</code> runs code that formats live kernel fields. That is why it is always exactly current, why it costs nothing to “write”, and why <code>ls /proc</code> on an idle machine shows only a handful of processes but a busy one shows thousands.",
          "Two consequences follow immediately. First, <em>every running thing is a process</em>, including things you do not think of as programs: kernel threads (<code>kworker</code>, <code>ksoftirqd</code>), the initramfs shell, an <code>nginx</code> worker's master, a container's PID 1. Second, <em>process identity is not a security boundary in the kernel sense</em> — it is a resource-accounting boundary. If you want isolation you need more (chapter 04)."
        ]
      },
      {
        type: "diagram",
        h: "A real process tree: your Ubuntu server",
        caption: "One <code>systemd</code> at the root, everything else below it. Follow three things: the <b>master/worker</b> shape (nginx forks workers, and so does <code>sshd</code>), the <b>session</b> shape (a login hangs off <code>systemd --user</code>, not off sshd), and the fact that a process whose parent dies is <b>reparented to PID 1</b> rather than becoming a zombie.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Process tree of an Ubuntu server rooted at systemd">
  <!-- systemd -->
  <rect class="box-ok" x="440" y="24" width="220" height="52" rx="10"/>
  <text class="t-ok" x="550" y="46" text-anchor="middle" font-size="15">systemd (PID 1)</text>
  <text class="t-xs" x="550" y="64" text-anchor="middle">reaps orphans · the root of every tree</text>

  <path class="ln" d="M490,76 L170,120" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M540,76 L400,120" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M580,76 L700,120" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M620,76 M620,90 L950,90 L950,120" marker-end="url(#lm-arrow)"/>

  <!-- nginx -->
  <rect class="box-v" x="60" y="120" width="230" height="72" rx="10"/>
  <text class="t-violet" x="76" y="144" font-size="14.5">nginx: master process</text>
  <text class="t-xs" x="76" y="164">PPID 1 · holds :80/:443 sockets</text>
  <text class="t-xs" x="76" y="180">re-reads config on reload</text>

  <path class="ln" d="M110,192 L110,224" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M175,192 L175,224" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M240,192 L240,224" marker-end="url(#lm-arrow)"/>

  <rect class="box" x="60" y="224" width="100" height="46" rx="8"/>
  <text class="t-sm" x="110" y="246" text-anchor="middle">worker 0</text>
  <text class="t-xs" x="110" y="262" text-anchor="middle">nginx</text>
  <rect class="box" x="170" y="224" width="100" height="46" rx="8"/>
  <text class="t-sm" x="220" y="246" text-anchor="middle">worker 1</text>
  <text class="t-xs" x="220" y="262" text-anchor="middle">nginx</text>
  <rect class="box" x="60" y="280" width="210" height="42" rx="8"/>
  <text class="t-xs" x="76" y="305">cache manager · cache loader</text>

  <!-- named -->
  <rect class="box-w" x="320" y="120" width="230" height="72" rx="10"/>
  <text class="t-warn" x="336" y="144" font-size="14.5">named (BIND)</text>
  <text class="t-xs" x="336" y="164">PPID 1 · authoritative only</text>
  <text class="t-xs" x="336" y="180">no recursion, no cache, udp/tcp :53</text>

  <!-- sshd -->
  <rect class="box-a" x="620" y="120" width="230" height="72" rx="10"/>
  <text class="t-accent" x="636" y="144" font-size="14.5">sshd: listener</text>
  <text class="t-xs" x="636" y="164">PPID 1 · socket-activated</text>
  <text class="t-xs" x="636" y="180">forks a child per connection</text>

  <path class="ln" d="M735,192 L735,236" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="620" y="236" width="230" height="50" rx="8"/>
  <text class="t-sm" x="636" y="258">sshd: user@host [priv]</text>
  <text class="t-xs" x="636" y="276">handles the crypto, then forks again</text>
  <path class="ln" d="M735,286 L735,312" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="620" y="312" width="230" height="50" rx="8"/>
  <text class="t-sm" x="636" y="334">sshd: alexgris@pts/0</text>
  <text class="t-xs" x="636" y="352">opens a PAM session → logind</text>

  <!-- user manager -->
  <rect class="box-v" x="900" y="120" width="190" height="72" rx="10"/>
  <text class="t-violet" x="916" y="144" font-size="14.5">systemd --user</text>
  <text class="t-xs" x="916" y="164">per-user manager, lives in</text>
  <text class="t-xs" x="916" y="180">user@1000.service</text>

  <path class="ln dash" d="M850,161 L900,161" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="856" y="206">loginctl links them</text>

  <!-- login shell chain -->
  <rect class="box-p" x="620" y="392" width="230" height="50" rx="8"/>
  <text class="t-sm" x="636" y="414">bash (session-3.scope)</text>
  <text class="t-xs" x="636" y="432">your shell · the thing you type at</text>
  <path class="ln" d="M735,362 L735,392" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M620,417 L500,417" marker-end="url(#lm-arrow)"/>
  <rect class="box" x="360" y="392" width="140" height="50" rx="8"/>
  <text class="t-sm" x="376" y="414">htop</text>
  <text class="t-xs" x="376" y="432">child of the shell</text>
  <path class="ln" d="M360,417 L300,417" marker-end="url(#lm-arrow)"/>
  <rect class="box" x="170" y="392" width="130" height="50" rx="8"/>
  <text class="t-sm" x="186" y="414">sleep 9999</text>
  <text class="t-xs" x="186" y="432">grandchild</text>

  <!-- reparenting -->
  <rect class="box-b" x="60" y="392" width="90" height="50" rx="8"/>
  <text class="t-xs" x="76" y="414">orphaned</text>
  <text class="t-xs" x="76" y="432">→ PPID 1</text>
  <path class="ln-b" d="M105,392 L105,352 L500,352 L500,368" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <text class="t-bad" x="250" y="346" font-size="13">if a parent dies, the child is reparented to PID 1 and keeps running — that is what systemd “reaps”</text>

  <!-- kernel threads + facts -->
  <rect class="box" x="60" y="470" width="480" height="126" rx="10"/>
  <text class="t-dim" x="76" y="494" font-size="14.5">kernel threads — same table, no user address space</text>
  <text class="t-xs" x="76" y="516">kworker/0:1        executes deferred work (syscalls, I/O completion)</text>
  <text class="t-xs" x="76" y="534">ksoftirqd/N       runs deferred network interrupt work</text>
  <text class="t-xs" x="76" y="552">kthreadd          creates every other kernel thread</text>
  <text class="t-xs" x="76" y="570">migration/N       moves tasks between cores</text>
  <text class="t-xs" x="76" y="588">kswapd0           writes cold pages out to swap</text>

  <rect class="box-a" x="620" y="470" width="470" height="126" rx="10"/>
  <text class="t-accent" x="636" y="494" font-size="14.5">four numbers, four different questions</text>
  <text class="t-xs" x="636" y="518">PID    — who is this?        unique, never reused while live</text>
  <text class="t-xs" x="636" y="536">PPID   — who started it?    becomes 1 after reparenting</text>
  <text class="t-xs" x="636" y="554">PGID   — which job?          shell job control, terminal signals</text>
  <text class="t-xs" x="636" y="572">SID    — which session?      login session; pkill -sid, loginctl</text>
  <text class="t-xs" x="636" y="590">A process in the foreground of a TTY is in its own process group — that is why Ctrl-C works on one job and not another.</text>

  <text class="t-xs" x="30" y="616">Read any of this yourself: pstree -sp 1 · ps -eo pid,ppid,pgid,sid,tty,stat,comm --forest · systemd-cgls · loginctl session-status 3</text>
</svg>`
      },
      {
        type: "prose",
        h: "fork + exec: why two steps",
        p: [
          "Unix created processes with <code>fork()</code>, which copies the parent's entire address space, then <code>exec()</code>, which throws that copy away and replaces it with a new program. That split is not historical accident — it is what makes shells possible.",
          "Between the two calls, the <em>child is a copy of the parent</em>. It has the same file descriptors, the same signal dispositions (handlers reset to default, masks inherited), the same working directory, the same credentials, the same open files and their <em>current offset</em>. That single window is the whole basis of shell redirection, of <code>daemon</code> double-forking to detach from a terminal, and of why <code>exec 3&gt;file</code> in one shell affects every command that shell runs.",
          "<strong>The copy is cheap</strong> — not a real copy, but copy-on-write mappings of everything, as established in chapter 02. The cost of fork is proportional to the page tables, not to the data.",
          "Modern programs rarely call <code>fork()</code> directly: glibc provides <code>posix_spawn()</code> (avoids the async-signal-safety trap after fork in a threaded program) and Linux's <code>clone()</code> creates both processes <em>and</em> threads with the same call. When you see <code>vfork()</code> in a strace, that is the kernel refusing to copy a table it does not need to copy."
        ]
      },
      {
        type: "diagram",
        h: "Threads are processes with the same address space",
        caption: "Threads share everything except the stack and a few per-thread registers. The consequence you will actually feel: one thread blocking in a <code>read()</code> does not stop the others, but one thread <em>segfaulting</em> takes the whole process, and one thread exhausting memory or file descriptors hurts everyone — which is exactly why <code>ulimit -u</code> (tasks) and <code>ulimit -n</code> (fds) are per-process, not per-thread.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Threads sharing an address space, file descriptor table and cgroup">
  <rect class="box-a" x="30" y="30" width="1040" height="46" rx="9"/>
  <text class="t-accent" x="48" y="58" font-size="15">one process — one address space, one fd table, one cgroup, one set of credentials</text>

  <text class="t-title" x="30" y="104">threads (tasks)</text>

  <g>
  <rect class="box" x="30" y="118" width="300" height="150" rx="9"/>
  <text class="t-sm" x="48" y="142">TID 8801 — main thread</text>
  <text class="t-xs" x="48" y="164">stack 8 MB (grows down)</text>
  <text class="t-xs" x="48" y="182">registers, TLS</text>
  <text class="t-xs" x="48" y="200">errno, signal mask</text>
  <text class="t-xs" x="48" y="218">running: epoll_wait()</text>
  <text class="t-xs" x="48" y="240">runs the event loop —</text>
  <text class="t-xs" x="48" y="256">accept(), then dispatch</text>
  </g>

  <g>
  <rect class="box" x="380" y="118" width="300" height="150" rx="9"/>
  <text class="t-sm" x="398" y="142">TID 8802 — worker</text>
  <text class="t-xs" x="398" y="164">stack 8 MB</text>
  <text class="t-xs" x="398" y="182">shares TLS via shared</text>
  <text class="t-xs" x="398" y="200">pointer, not automatically</text>
  <text class="t-xs" x="398" y="218">state: writing a response</text>
  <text class="t-xs" x="398" y="240">nginx style: N workers,</text>
  <text class="t-xs" x="398" y="256">1 CPU each, no locks needed</text>
  </g>

  <g>
  <rect class="box" x="730" y="118" width="340" height="150" rx="9"/>
  <text class="t-sm" x="748" y="142">TID 8803 — timer</text>
  <text class="t-xs" x="748" y="164">stack 8 MB</text>
  <text class="t-xs" x="748" y="182">state: sleeping in</text>
  <text class="t-xs" x="748" y="200">epoll_wait(timeout)</text>
  <text class="t-xs" x="748" y="218">nginx style alternative:</text>
  <text class="t-xs" x="748" y="240">one thread, many</text>
  <text class="t-xs" x="748" y="256">connections, all non-blocking</text>
  </g>

  <path class="ln-a" d="M180,268 L180,300" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M530,268 L530,300" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M900,268 L900,300" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="30" y="300" width="320" height="60" rx="9"/>
  <text class="t-sm" x="48" y="324">shared fd table</text>
  <text class="t-xs" x="48" y="344">fd 0,1,2 + the listening socket — one close() by any thread affects all</text>

  <rect class="box-v" x="380" y="300" width="320" height="60" rx="9"/>
  <text class="t-sm" x="398" y="324">shared address space</text>
  <text class="t-xs" x="398" y="344">heap, globals, mappings — a segfault in one kills all</text>

  <rect class="box-v" x="730" y="300" width="340" height="60" rx="9"/>
  <text class="t-sm" x="748" y="324">shared cgroup + limits</text>
  <text class="t-xs" x="748" y="344">pids.max counts threads; memory.max is for the whole process</text>

  <rect class="box-w" x="30" y="384" width="1040" height="70" rx="9"/>
  <text class="t-warn" x="48" y="408" font-size="14.5">why this matters operationally</text>
  <text class="t-sm" x="48" y="430">A “process” in top with 8 threads is really 8 scheduler entries and 8 stacks — which is why <tspan font-weight="700">task count</tspan> and <tspan font-weight="700">process count</tspan> are different limits, why ps -eLf exists, and why a container that forks too many threads hits pids.max while its memory looks fine.</text>
  <text class="t-sm" x="48" y="448">Also why kill &lt;pid&gt; without a signal name sends SIGTERM to every thread — the kernel delivers it to one thread and the whole process gets it.</text>
</svg>`
      },
      {
        type: "prose",
        h: "States: the single most useful column in ps",
        p: [
          "The <code>STAT</code> column in <code>ps</code> is a small alphabet that tells you what the kernel is actually doing with a task, and it is the fastest triage signal on a machine. It is worth knowing all of it rather than scanning for the one you have seen before."
        ],
        noteTitle: "S is not one thing",
        note: "<code>S</code> is interruptible sleep and covers at least three very different situations: waiting for a timer, waiting on a socket, and waiting for a page fault to complete on disk. <code>D</code> is uninterruptible sleep, which is what a blocked device read looks like. Both read as “sleeping”, and only one of them can be killed — which is why a machine full of <code>D</code> needs a filesystem investigation, not a <code>kill -9</code>.",
        noteKind: "warn"
      },
      {
        type: "table",
        cols: ["State", "Meaning", "What it tells you", "Can you kill it?"],
        rows: [
          ["<code>R</code> (R, R+)", "Running or runnable — on a CPU or waiting for one", "Busy. High R count across all cores means real CPU saturation, not just load", "yes"],
          ["<code>S</code> (S, S+)", "Interruptible sleep", "Normal. Waiting on a timer, a socket, a child, or a page-in. The default state of a healthy process", "yes, immediately"],
          ["<code>D</code>", "Uninterruptible sleep", "Blocked on I/O. Can indicate a hung disk, an unreachable NFS mount, or a saturated device queue. <strong>Never transient</strong> — if a D task is old, the I/O is not coming back", "<b>no.</b> SIGKILL is queued and ignored until the I/O returns"],
          ["<code>Z</code>", "Zombie: exited, parent has not reaped it", "A bookkeeping leak, not a live process. It holds a PID slot and nothing else. Means the parent is broken or is not calling wait()", "already dead"],
          ["<code>T</code> (T, t)", "Stopped by job control or by a debugger", "Ctrl-Z, or a SIGSTOP someone sent deliberately — e.g. <code>kill -STOP</code> for an unattended upgrade or a live migration", "yes — SIGCONT resumes"],
          ["<code>W</code>", "Paging (old kernels, now folded into D)", "Historic. You will not see it on a modern kernel", "n/a"],
          ["<code>I</code>", "Idle kernel thread", "A kernel thread with nothing to do. Seeing a handful of <code>I</code> is normal and correct", "no, and do not try"],
          ["<span class='tcol-warn'>X/t</span>", "Dead / tracing stop", "<code>t</code> means a tracer (strace, gdb) is attached — the process is stopped by ptrace and will appear frozen. This is not a hang", "yes — detach the tracer"],
          ["<code>K</code>", "Waking (transient)", "Cosmetic; you will catch it only under heavy load", "yes"]
        ]
      },
      {
        type: "diagram",
        h: "Signals: how a kill becomes an action",
        caption: "A signal is a queued number in the target's pending set, not an event. The kernel decides at delivery time what to do with it based on the target's <b>disposition</b> (default, ignore, or a handler), its <b>mask</b>, and whether a handler exists. That three-way check is why <code>kill -9</code> is unkillable by the receiver and why some programs ignore signals you think are working.",
        svg: `
<svg viewBox="0 0 1100 540" role="img" aria-label="Signal delivery path and default actions">
  <rect class="box-a" x="30" y="34" width="300" height="60" rx="9"/>
  <text class="t-sm" x="48" y="58">sender</text>
  <text class="t-xs" x="48" y="78">kill(2), Ctrl-C (tty), the OOM killer, a segfault</text>

  <path class="ln-a" d="M330,64 L430,64" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="332" y="56">number</text>

  <rect class="box-w" x="430" y="34" width="280" height="60" rx="9"/>
  <text class="t-sm" x="448" y="58">kernel: pending bitmask</text>
  <text class="t-xs" x="448" y="78">queued per-task; coalesces duplicates</text>

  <path class="ln-a" d="M710,64 L810,64" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="810" y="34" width="260" height="60" rx="9"/>
  <text class="t-sm" x="828" y="58">target task wakes</text>
  <text class="t-xs" x="828" y="78">on its own turn on the CPU</text>

  <path class="ln-v" d="M940,94 L940,132" marker-end="url(#lm-arrow)"/>

  <rect class="box" x="700" y="132" width="370" height="60" rx="9"/>
  <text class="t-sm" x="718" y="156">three checks, in this order</text>
  <text class="t-xs" x="718" y="176">1. blocked by the signal mask?  → stay queued   2. handler installed?  3. disposition</text>

  <path class="ln-v" d="M700,162 L640,162 L640,222" marker-end="url(#lm-arrow)"/>
  <path class="ln-v" d="M700,162 L470,162 L470,222" marker-end="url(#lm-arrow)"/>
  <path class="ln-v" d="M700,162 L250,162 L250,222" marker-end="url(#lm-arrow)"/>

  <rect class="box-ok" x="760" y="222" width="310" height="88" rx="9"/>
  <text class="t-ok" x="778" y="246" font-size="14.5">handler runs (async signal)</text>
  <text class="t-xs" x="778" y="268">The program decides: reap, reload,</text>
  <text class="t-xs" x="778" y="286">close, exit. <tspan font-weight="700">This is why SIGTERM lets</tspan></text>
  <text class="t-xs" x="778" y="302"><tspan font-weight="700">nginx finish in-flight requests.</tspan></text>

  <rect class="box-w" x="510" y="222" width="220" height="88" rx="9"/>
  <text class="t-warn" x="528" y="246" font-size="14.5">disposition = ignore</text>
  <text class="t-xs" x="528" y="268">No handler, SIG_IGN set</text>
  <text class="t-xs" x="528" y="286">or blocked by mask. The</text>
  <text class="t-xs" x="528" y="302">signal is discarded.</text>

  <rect class="box-b" x="90" y="222" width="330" height="88" rx="9"/>
  <text class="t-bad" x="108" y="246" font-size="14.5">default action</text>
  <text class="t-xs" x="108" y="268">terminate · core dump · stop</text>
  <text class="t-xs" x="108" y="286">SIGKILL and SIGSTOP have no</text>
  <text class="t-xs" x="108" y="302">handler — the kernel acts itself</text>

  <rect class="box-a" x="30" y="352" width="520" height="164" rx="9"/>
  <text class="t-accent" x="48" y="376" font-size="14.5">the ones you will actually use</text>
  <text class="t-xs" x="48" y="400">SIGTERM  15  polite stop. systemd sends it, then SIGKILL after TimeoutStopSec.</text>
  <text class="t-xs" x="48" y="418">SIGKILL  9  unblockable. Cannot be caught, blocked or ignored. D-state tasks ignore it too.</text>
  <text class="t-xs" x="48" y="436">SIGHUP   1  historically “reload config”; sshd uses it to re-exec. A daemon that ignores it will not reload.</text>
  <text class="t-xs" x="48" y="454">SIGINT   2  Ctrl-C in a foreground process group.</text>
  <text class="t-xs" x="48" y="472">SIGCHLD  17  “a child died” — what a shell uses to collect zombies, and what PID 1 must handle.</text>
  <text class="t-xs" x="48" y="490">SIGSTOP 19  freeze. SIGCONT 18 resume. Both are uncatchable, by design.</text>
  <text class="t-xs" x="48" y="508">SIGWINCH 28 window resized — the terminal emulator telling a full-screen program to redraw.</text>

  <rect class="box-p" x="580" y="352" width="490" height="164" rx="9"/>
  <text class="t-bad" x="598" y="376" font-size="14.5">the trap: a process that ignores SIGTERM</text>
  <text class="t-sm" x="598" y="400">systemctl stop nginx → SIGTERM → workers finish their current requests. Good.</text>
  <text class="t-sm" x="598" y="420">But a process stuck in a blocking read(), or one that called signal(SIGTERM, SIG_IGN), will sit there until</text>
  <text class="t-sm" x="598" y="438">TimeoutStopSec expires and systemd escalates to SIGKILL — losing in-flight work and skipping your ExecStop script.</text>
  <text class="t-sm" x="598" y="460">If you need graceful shutdown to work, set TimeoutStopSec= generously and make sure the daemon's own</text>
  <text class="t-sm" x="598" y="478">shutdown path actually closes listeners. nginx: worker_shutdown_timeout controls the in-flight window.</text>
  <text class="t-xs" x="598" y="504">Diagnose a stuck stop with: systemctl show &lt;unit&gt; -p TimeoutStopUSec -p KillMode  ·  ps -eo pid,stat,wchan</text>
</svg>`
      },
      {
        type: "prose",
        h: "Scheduling, and what “load average” is measuring",
        p: [
          "Linux runs a preemptive, per-CPU run queue. Each CPU has a queue of runnable tasks, sorted by a virtual runtime counter that grows when a task runs and shrinks when it is scheduled in — the Completely Fair Scheduler. The task with the smallest counter wins. It is not round-robin and not proportional-share in the naive sense; it is a fairness heuristic that gets surprisingly close to “everyone gets what they need”.",
          "Three knobs modify it. <strong>Nice values</strong> (−20 … 19) shift the starting weight — mostly irrelevant without SCHED_FIFO/RR or cgroup shares. <strong>SCHED_FIFO and SCHED_RR</strong> are real-time priorities: a FIFO task <em>preempts everything</em> until it blocks or yields, which on a general-purpose server is almost always a mistake. <strong>cgroup weights</strong> (<code>cpu.weight</code>, or <code>cpu.shares</code> on v1) are the modern lever, and they are what actually enforces “this pod gets half a core”.",
          "Load average deserves a correction, because it is routinely misread. It is <strong>the exponentially-weighted count of runnable and uninterruptibly-sleeping tasks</strong> over 1, 5 and 15 minutes — not CPU utilisation and not a queue length. Load 4 on a 2-core box is oversubscribed; load 4 on a 32-core box is idle. And because <code>D</code> counts, <strong>load can climb while the CPU is completely idle</strong> — which is the fingerprint of blocked I/O, not of a runaway process. On your 2 GB server, a load of 3 with 5% CPU means something is stuck on disk, not that something is busy."
        ]
      },
      {
        type: "diagram",
        h: "One core, four tasks, over 100 milliseconds",
        caption: "Each vertical slice is a scheduling quantum. Note the two green slices for the cgroup-limited task at the bottom: it is runnable and ready, but its cgroup weight only earns it part of the CPU. That is how a container limit is enforced — not by stopping the task, but by scheduling it less.",
        svg: `
<svg viewBox="0 0 1100 420" role="img" aria-label="Timeline of four tasks sharing one core, with cgroup weight affecting fairness">
  <text class="t-title" x="30" y="30">a single CPU core</text>
  <text class="t-xs" x="30" y="48">time →  (10 slices of ~10 ms)</text>

  <!-- rows -->
  <text class="t-sm" x="30" y="92" text-anchor="end">PID 8801</text>
  <text class="t-sm" x="30" y="142" text-anchor="end">PID 8802</text>
  <text class="t-sm" x="30" y="192" text-anchor="end">PID 8803</text>
  <text class="t-sm" x="30" y="242" text-anchor="end">PID 9100</text>
  <text class="t-xs" x="30" y="292" text-anchor="end">nginx master</text>

  <line class="ln dash" x1="140" y1="60" x2="140" y2="330"/>
  <line class="ln dash" x1="230" y1="60" x2="230" y2="330"/>
  <line class="ln dash" x1="320" y1="60" x2="320" y2="330"/>
  <line class="ln dash" x1="410" y1="60" x2="410" y2="330"/>
  <line class="ln dash" x1="500" y1="60" x2="500" y2="330"/>
  <line class="ln dash" x1="590" y1="60" x2="590" y2="330"/>
  <line class="ln dash" x1="680" y1="60" x2="680" y2="330"/>
  <line class="ln dash" x1="770" y1="60" x2="770" y2="330"/>
  <line class="ln dash" x1="860" y1="60" x2="860" y2="330"/>
  <line class="ln dash" x1="950" y1="60" x2="950" y2="330"/>

  <!-- slices -->
  <rect class="box-a" x="140" y="72" width="90" height="26" rx="5"/>
  <rect class="box-a" x="320" y="72" width="90" height="26" rx="5"/>
  <rect class="box-a" x="500" y="72" width="90" height="26" rx="5"/>
  <rect class="box-a" x="680" y="72" width="90" height="26" rx="5"/>
  <rect class="box-a" x="860" y="72" width="90" height="26" rx="5"/>

  <rect class="box-v" x="230" y="122" width="90" height="26" rx="5"/>
  <rect class="box-v" x="410" y="122" width="90" height="26" rx="5"/>
  <rect class="box-v" x="590" y="122" width="90" height="26" rx="5"/>
  <rect class="box-v" x="770" y="122" width="90" height="26" rx="5"/>
  <rect class="box-v" x="950" y="122" width="90" height="26" rx="5"/>

  <rect class="box-ok" x="320" y="172" width="90" height="26" rx="5"/>
  <rect class="box-ok" x="590" y="172" width="90" height="26" rx="5"/>
  <rect class="box-ok" x="860" y="172" width="90" height="26" rx="5"/>

  <rect class="box-w" x="140" y="222" width="90" height="26" rx="5"/>
  <rect class="box-w" x="500" y="222" width="90" height="26" rx="5"/>
  <rect class="box-w" x="770" y="222" width="90" height="26" rx="5"/>

  <rect class="box" x="950" y="272" width="8" height="26" rx="3"/>

  <!-- annotations -->
  <path class="ln-a" d="M395,98 L395,116" marker-end="url(#lm-arrow-accent)" stroke-dasharray="3 3"/>
  <text class="t-xs" x="180" y="330">time slices expire on a timer interrupt, not when the task “finishes”</text>
  <path class="ln-b" d="M630,235 L630,268" marker-end="url(#lm-arrow-bad)" stroke-dasharray="3 3"/>
  <text class="t-bad" x="646" y="262" font-size="13">cpu.weight=10 → fewer slices for the same wall-clock</text>

  <rect class="box-a" x="30" y="350" width="510" height="56" rx="9"/>
  <text class="t-xs" x="48" y="372">Run queue, not a queue of programs: a task that blocks in read() leaves the queue immediately, which is why</text>
  <text class="t-xs" x="48" y="392">one nginx worker can hold thousands of idle keep-alive connections without threads.</text>

  <rect class="box-b" x="565" y="350" width="505" height="56" rx="9"/>
  <text class="t-xs" x="583" y="372">Preemption points: timer tick, a task blocking, a task waking, an interrupt, an explicit yield. There is no</text>
  <text class="t-xs" x="583" y="392">timeslice “guarantee” — a task can wait arbitrarily long on a loaded machine, which is what SCHED_FIFO abuses.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "The process toolkit: what to run, and what the answer means",
        code:
`# the process table, sorted by what is hurting you
ps -eo pid,ppid,user,stat,etimes,%cpu,%mem,rss,comm --sort=-%cpu | head -20
ps -eo pid,stat,wchan:32,comm | awk '$2 ~ /^D/'      # <-- the D-state hunt, do this first on a "frozen" box

# the tree, and the cgroup tree systemd maintains
pstree -asp 1
systemd-cgls --no-pager                                   # cgroup hierarchy = what systemd considers a unit
systemctl status nginx --no-pager                        # master + workers + recent log lines, one screen

# everything about one process, from the kernel itself
cat /proc/1234/status      # threads, state, Uid/Gid, CapEff, Seccomp, VmRSS
cat /proc/1234/stat       # raw kernel counters; field 3 is the state letter
cat /proc/1234/cmdline | tr '\\0' ' '; echo              # argv, NUL separated: survives spaces and injection
cat /proc/1234/exe -> /usr/sbin/nginx                    # the real binary, even if PATH would lie
cat /proc/1234/cwd -> /var/www/html                      # where it thinks it is
ls -l /proc/1234/fd                                       # every open file, socket, device — as symlinks
cat /proc/1234/limits                                     # the actual rlimits this process runs under
cat /proc/1234/maps | head                               # memory map: heap, libs, stacks

# who has that file, port, or deleted space
lsof -p 1234
lsof -i :443 -sTCP:LISTEN
lsof +L1                       # deleted files still held open -> invisible in df, still on disk
fuser -v /var/www/html/index.html

# signals
kill -TERM 1234 ; kill -0 1234                           # -0 tests existence without sending anything
kill -STOP $(pgrep -f 'worker') ; kill -CONT $(pgrep -f 'worker')
pkill -u alexgris -f 'python.*train'                     # kill by user AND cmdline, not by name alone
killall -u alexgris                                       # by process name

# zombies and orphans
ps -eo pid,ppid,stat,comm | awk '$3 ~ /^Z/'              # zombies: find the PARENT, that is the bug
cat /proc/sys/kernel/pid_max                              # PID ceiling; wrapping is a real (if rare) outage

# pressure, not just utilisation
cat /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io
vmstat 1 5                                                 # r (runnable) vs b (blocked) is the load story`
      },
      {
        type: "callout",
        kind: "danger",
        title: "Three ways to be certain about what a process really is",
        text: "<b>1.</b> <code>readlink /proc/PID/exe</code> — defeats a process that lies about its argv, a deleted binary after an upgrade, or a shell wrapper you forgot about. <b>2.</b> <code>cat /proc/PID/cmdline | tr '\\0' ' '</code> — argv is NUL-separated, which is why <code>ps aux | grep my-app</code> is dangerous: it also matches the grep itself, and it cannot be used to kill reliably when arguments contain spaces or semicolons. <b>3.</b> <code>cat /proc/PID/maps</code> — shows what is really mapped, which is how you catch a process running an old library after an in-place upgrade, or a binary started from a deleted path."
      },
      {
        type: "prose",
        h: "Zombies, orphans, and PID 1",
        p: [
          "When a process exits it cannot disappear until its parent calls <code>wait()</code> to collect the exit status. Until then it is a <strong>zombie</strong>: a slot in the process table with the exit code in it, costing a PID and nothing else. If you see thousands of zombies, you do not have a zombie problem — you have a <em>parent</em> problem.",
          "Normally the parent is a shell that waits for its jobs. But a program that forks and exits without waiting — or dies before reaping — orphans its children, and the kernel reparents them to PID 1. That is where the folklore comes from, and it is the one case where folklore is right: <strong>PID 1 must be a competent reaper or the system leaks PIDs.</strong> systemd is written to reap everything, aggressively, which is exactly why “container with no init” used to produce a PID leak that filled the namespace's table.",
          "This is the direct cause of a familiar container bug: a container whose PID 1 is an application that ignores SIGCHLD. Every child it spawns becomes a zombie when it exits, until the container hits its PID limit and the service appears to hang for no visible reason. Two standard fixes: run an init that reaps (<code>tini</code>, <code>dumb-init</code>, <code>--init</code> in Docker, or containerd's built-in init), or make PID 1 the shell that the platform injects. Chapter 13 comes back to this."
        ]
      }
    ],
    takeaways: [
      "A process is a <code>task_struct</code>: PID, credentials, fds, address space, cgroup. <strong>/proc is a live view of that structure</strong>, not a cached file.",
      "Read <code>ps -eo stat</code> before anything else. <strong>D means blocked on I/O and cannot be killed</strong>; S is normal; Z points at the parent, not the zombie.",
      "fork+exec is two steps on purpose: between them the child is a copy of the parent with its fds, which is how redirection, daemonising and shell job control work.",
      "Threads share the address space, so one thread's segfault kills all of them — and <code>pids.max</code> counts threads while <code>memory.max</code> covers the whole process.",
      "Load average counts runnable <em>and</em> uninterruptible-sleeping tasks. <strong>High load with idle CPU is blocked I/O</strong>, not a busy machine.",
      "Signals are queued numbers, resolved at delivery against mask and disposition. That is why SIGKILL works and why a program can ignore SIGTERM.",
      "Zombies are the parent's bug, and PID 1 is what collects orphans — which is why a container needs a real init."
    ],
    glossary: {
      "task_struct": "The kernel structure behind a process: state, scheduling info, credentials, memory map, fds, cgroup membership.",
      "PPID": "Parent process ID. Becomes 1 when the parent dies and the kernel reparents the orphan to init.",
      "PGID": "Process group ID — a job-control group. Ctrl-C in a shell signals the whole foreground group.",
      "SID": "Session ID — a login session boundary. loginctl and pkill -sid operate on these.",
      "reparenting": "When a parent dies, its children are attached to PID 1 so they keep running and can still be reaped.",
      "zombie": "An exited process whose exit status has not been collected by its parent. Holds a PID slot, no memory.",
      "copy-on-write": "fork shares the parent's memory read-only until a write faults it into a private copy, making fork cheap.",
      "posix_spawn": "The modern glibc replacement for fork+exec that avoids calling non-async-signal-safe code between the two.",
      "CFS": "Completely Fair Scheduler — the per-CPU run-queue scheduler, ordering tasks by virtual runtime so long waits shrink.",
      "nice value": "-20 (most favoured) to 19 (least). Weight in the scheduler; irrelevant for real-time tasks.",
      "SCHED_FIFO": "Real-time scheduling class. A FIFO task preempts everything until it blocks — dangerous on a shared server.",
      "RLIMIT_NOFILE": "The per-process open-file limit. Distinct from fs.file-max, which is the system-wide ceiling.",
      "reaping": "A parent calling wait() to collect a child's exit status. PID 1's most important job.",
      "ptrace": "The syscall that lets a tracer control another process. Attaching with strace/gdb stops the target (state t)."
    }
  });
})();