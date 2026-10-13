/* ch02 — Kernel: the machine underneath */
(function () {
  LX.push({
    id: "kernel",
    title: "The kernel: the machine underneath",
    tagline: "One privileged program that owns the CPU, the memory and the devices. Everything else is a guest.",
    sections: [
      {
        type: "prose",
        h: "What the kernel actually is",
        p: [
          "Linux is not a program manager that happens to also run programs. It is a <strong>resource controller with a syscall API in front of it</strong>. The kernel owns exactly three things — CPU time, physical memory, and the devices — and its entire job is to decide who gets what, when. Everything else you recognise as “Linux” (packages, services, containers, shells, the filesystem tree) is user-space software talking to that controller through one narrow door.",
          "So there are two halves to every machine, and the line between them is the most important line in this entire document. Above it, a process can only do what its <em>credentials</em> allow: read files it has permission for, allocate memory it has <em>room</em> for, bind ports it is allowed to bind. Below it, there are no permissions — there is one entity with the ability to touch any page of RAM, any device register, any other process's address space. That is why “root” is not a user account, it is the <strong>absence of a user account</strong>.",
          "The kernel itself is a single address space. It is not itself protected from the processes it runs — it is <em>trusted</em>, not sandboxed. A kernel bug is not contained by anything. That asymmetry (tiny trusted core, enormous untrusted surface on top) is the reason for namespaces, capabilities, seccomp and containers: they add back containment <em>above</em> the kernel, because the kernel will never provide it."
        ]
      },
      {
        type: "diagram",
        h: "The one picture that matters",
        caption: "User space asks; the kernel disposes. Only two things cross the line downwards: a <b>trap</b> (a syscall the process asked for) and an <b>interrupt</b> (something the hardware decided on its own). Nothing ever crosses downwards by accident — which is precisely what kernel-level protections enforce."
          ,
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="User space above, kernel space below, hardware at the bottom, connected by syscalls and interrupts">
  <!-- USER SPACE -->
  <rect class="box" x="30" y="30" width="1040" height="170" rx="12"/>
  <text class="t-title" x="50" y="58">USER SPACE</text>
  <text class="t-xs" x="50" y="76">unprivileged — everything here is a victim of kernel decisions</text>

  <rect class="box-a" x="52" y="92" width="215" height="86" rx="10"/>
  <text class="t-accent" x="70" y="118" font-size="15">your programs</text>
  <text class="t-sm" x="70" y="140">bash · nginx worker</text>
  <text class="t-sm" x="70" y="160">sshd · named · container</text>

  <rect class="box-v" x="290" y="92" width="215" height="86" rx="10"/>
  <text class="t-violet" x="308" y="118" font-size="15">libraries</text>
  <text class="t-sm" x="308" y="140">libc (glibc) — wrappers,</text>
  <text class="t-sm" x="308" y="160">malloc, printf, resolver</text>

  <rect class="box-ok" x="528" y="92" width="215" height="86" rx="10"/>
  <text class="t-ok" x="546" y="118" font-size="15">init &amp; supervision</text>
  <text class="t-sm" x="546" y="140">systemd (PID 1)</text>
  <text class="t-sm" x="546" y="146"></text>
  <text class="t-sm" x="546" y="162">start/stop/restart</text>

  <rect class="box-p" x="766" y="92" width="284" height="86" rx="10"/>
  <text class="t-bad" x="784" y="118" font-size="15">everything you installed</text>
  <text class="t-sm" x="784" y="140">a package is just a tarball of files plus</text>
  <text class="t-sm" x="784" y="160">metadata. No magic, no privilege.</text>

  <!-- boundary -->
  <line class="ln-w" x1="30" y1="228" x2="1070" y2="228" stroke-width="3" stroke-dasharray="10 8"/>
  <text class="t-warn" x="30" y="250" font-size="15">privilege boundary — ring 3 above, ring 0 below; enforced by the MMU, not by software</text>

  <!-- arrows down -->
  <path class="ln-a" d="M160,178 L160,286" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="176" y="222" font-size="14">syscall: open(), read(), mmap()</text>
  <text class="t-xs" x="176" y="242">trap → validate → do work → copy back</text>

  <path class="ln-a" d="M420,178 L420,286" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="436" y="222" font-size="14">page fault, OOM kill, signal delivery</text>
  <text class="t-xs" x="436" y="242">the kernel decides your process dies</text>

  <path class="ln-b" d="M900,178 L900,286" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="700" y="222" font-size="14">interrupt: NIC, disk, timer, keyboard</text>
  <text class="t-xs" x="700" y="242">the kernel decides to take the CPU away from you</text>

  <!-- KERNEL -->
  <rect class="box-w" x="30" y="292" width="1040" height="212" rx="12"/>
  <text class="t-warn" x="50" y="320" font-size="18">KERNEL SPACE — ring 0, one address space, no permissions</text>

  <rect class="box-a" x="52" y="336" width="196" height="70" rx="9"/>
  <text class="t-accent" x="68" y="360" font-size="14.5">scheduler</text>
  <text class="t-sm" x="68" y="380">who runs, on which core,</text>
  <text class="t-sm" x="68" y="397">fair vs. cgroup weights</text>

  <rect class="box-a" x="262" y="336" width="196" height="70" rx="9"/>
  <text class="t-accent" x="278" y="360" font-size="14.5">memory manager</text>
  <text class="t-sm" x="278" y="380">page tables, mmap,</text>
  <text class="t-sm" x="278" y="397">COW, swap, OOM killer</text>

  <rect class="box-v" x="472" y="336" width="196" height="70" rx="9"/>
  <text class="t-violet" x="488" y="360" font-size="14.5">VFS + filesystems</text>
  <text class="t-sm" x="488" y="380">open/read/write stat,</text>
  <text class="t-sm" x="488" y="397">ext4 · xfs · btrfs · overlay</text>

  <rect class="box-v" x="682" y="336" width="196" height="70" rx="9"/>
  <text class="t-violet" x="698" y="360" font-size="14.5">network stack</text>
  <text class="t-sm" x="698" y="380">sockets, TCP state, routes,</text>
  <text class="t-sm" x="698" y="397">netfilter, conntrack</text>

  <rect class="box-b" x="892" y="336" width="158" height="70" rx="9"/>
  <text class="t-bad" x="908" y="360" font-size="14.5">drivers</text>
  <text class="t-sm" x="908" y="380">nvme · virtio ·</text>
  <text class="t-sm" x="908" y="397">e1000 · i915 …</text>

  <rect class="box" x="52" y="418" width="998" height="70" rx="9"/>
  <text class="t-dim" x="68" y="442" font-size="14.5">the rest of the core: signals · IPC (pipes, futex, shm) · namespaces · cgroups · security (LSM, capabilities) · timers · kexec · eBPF probes</text>
  <text class="t-xs" x="68" y="466">loaded from /boot/vmlinuz as one image; modules (lsmod) are compiled chunks that can be inserted at runtime — each one is new kernel attack surface</text>

  <!-- HARDWARE -->
  <rect class="box" x="30" y="548" width="1040" height="86" rx="12"/>
  <text class="t-title" x="50" y="576">HARDWARE</text>
  <text class="t-sm" x="50" y="600">CPU cores + MMU (virtual memory) · RAM · disk/NVMe · NIC · timers · serial console · GPU</text>
  <text class="t-xs" x="50" y="620">the MMU is the actual enforcer: if the kernel never maps a page, no user process can ever name it, whatever its uid claims</text>
</svg>`
      },
      {
        type: "prose",
        h: "The syscall: the only sanctioned door",
        p: [
          "A process cannot touch anything — not a file, not another process's memory, not its own device — without asking. The ask is a <strong>syscall</strong>, and on x86-64 it is unusually literal: the process loads argument registers, executes the <code>syscall</code> instruction, and the CPU itself switches privilege level, saves the register set on the kernel stack, and jumps to a fixed entry point. That is a <em>trap</em> — not an interrupt — because the hardware knows it was requested.",
          "The dispatcher then does the part that is easy to forget and expensive to get wrong: <strong>validate everything</strong>. Pointers are checked against the user's address space limits. Lengths are checked against the destination buffer. The task's credentials are checked against the target inode's permission bits <em>and</em> against capabilities, LSM policy and cgroup limits. Only then does the actual work happen, and only then are results copied back — because the kernel runs with the process's address space active, and letting it dereference a wild pointer would be a hole straight into ring 0.",
          "This is precisely why strace output looks like a conversation: every line is one of those validated crossings. When a program misbehaves, the fastest truth is usually in the <code>ENOENT</code>/<code>EACCES</code>/<code>ECONNREFUSED</code> pattern of its syscalls, long before you start reading source."
        ],
        noteTitle: "Syscall numbers are stable ABI, not implementation detail",
        note: "On x86-64 they have been frozen since 2013: <code>read</code>=0, <code>write</code>=1, <code>open</code>=2 (superseded by <code>openat</code>=257), <code>mmap</code>=9, <code>clone</code>=56, <code>execve</code>=59, <code>epoll_wait</code>=232. That stability is why a binary built on one machine runs on another with the same architecture. It is also why seccomp profiles can be written as <em>deny-this-one-number</em> rules and still work years later.",
        noteKind: "fact"
      },
      {
        type: "diagram",
        h: "Anatomy of one open()",
        caption: "The full path of <b>openat(AT_FDCWD, &quot;/etc/nginx/nginx.conf&quot;, O_RDONLY)</b>. Nine crossings of the boundary, two of them inside libc. When this path is slow, the kernel rows are almost never the problem — the slow rows are the <code>lookup</code>/<code>read</code> lines, which are your filesystem or your disk.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Sequence diagram of a syscall from user program through libc into the kernel">
  <!-- lifelines -->
  <line class="ln dash" x1="120" y1="66" x2="120" y2="440"/>
  <line class="ln dash" x1="330" y1="66" x2="330" y2="440"/>
  <line class="ln dash" x1="560" y1="66" x2="560" y2="440"/>
  <line class="ln dash" x1="820" y1="66" x2="820" y2="440"/>

  <rect class="box-a" x="40" y="20" width="160" height="46" rx="9"/>
  <text class="t-accent" x="58" y="42" font-size="14.5">process</text>
  <text class="t-xs" x="58" y="59">nginx worker</text>
  <rect class="box-v" x="250" y="20" width="160" height="46" rx="9"/>
  <text class="t-violet" x="268" y="42" font-size="14.5">libc</text>
  <text class="t-xs" x="268" y="59">openat() wrapper</text>
  <rect class="box-w" x="470" y="20" width="180" height="46" rx="9"/>
  <text class="t-warn" x="488" y="42" font-size="14.5">syscall entry</text>
  <text class="t-xs" x="488" y="59">entry_SYSCALL_64</text>
  <rect class="box-ok" x="740" y="20" width="160" height="46" rx="9"/>
  <text class="t-ok" x="758" y="42" font-size="14.5">subsystems</text>
  <text class="t-xs" x="758" y="59">VFS → fs → disk</text>

  <!-- steps -->
  <g>
  <path class="ln-a" d="M120,100 L320,100" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="128" y="94">1. fill rdi/rsi/rdx/rax=257</text>

  <path class="ln-a" d="M330,140 L550,140" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="338" y="134">2. SYSCALL — CPU drops to ring 0, saves pt_regs on kernel stack</text>

  <path class="ln-w" d="M560,182 L810,182" marker-end="url(#lm-arrow-warn)"/>
  <text class="t-sm" x="568" y="176">3. validate: path ptr in user range · creds · LSM · cgroup → do_sys_openat()</text>

  <path class="ln-ok" d="M820,224 L570,224" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="586" y="218">4. VFS: name lookup → inode → permission check → file struct</text>

  <path class="ln-ok" d="M820,266 L570,266" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="586" y="260">5. ext4: walk dentries, read inode from block device, may hit disk</text>

  <path class="ln-ok" d="M820,308 L570,308" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="586" y="302">6. return fd + struct file — stored in the process fd table</text>

  <path class="ln-a" d="M560,350 L340,350" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="368" y="344">7. copy fd back to user, SYSRET → ring 3</text>

  <path class="ln-a" d="M330,392 L130,392" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="138" y="386">8. libc returns the fd number, or -1 + errno (ENOENT / EACCES / …)</text>
  </g>

  <line class="ln-b" x1="30" y1="424" x2="1070" y2="424" stroke-dasharray="4 6"/>
  <text class="t-bad" x="30" y="446" font-size="14">strace -f -T -e trace=%file nginx -t  →  every line above, with real timings and the real error number</text>
</svg>`
      },
      {
        type: "prose",
        h: "Interrupts, preemption, and why a hung disk freezes everything",
        p: [
          "There is a second way into the kernel, and it does not ask permission. A device raises an interrupt; the CPU finishes the current instruction, saves state, and enters the kernel. Network packets, disk completions, and — crucially — the <strong>timer interrupt</strong> all work this way. The timer is what makes preemptive multitasking possible at all: on every tick (or on a kernel's configured equivalent), the scheduler runs and may take the CPU away from whatever was running.",
          'That yields the two most confusing states you will ever see in <code>top</code>/<code>ps</code>. <span class="tcol-warn"><code>R</code></span> = running or runnable. <span class="tcol-bad"><code>D</code></span> = uninterruptible sleep, meaning “waiting on I/O, cannot be killed, cannot be woken”. A process stuck in <code>D</code> on a dead NFS mount or a wedged disk is why <em>load average climbs and nothing responds</em>. You cannot send SIGKILL to a <code>D</code> process; it is not listening. That is the single most useful thing to know about Linux process states, and it is the difference between “restart the box” and “find the dead mount”.',
          "A related asymmetry: an <strong>interrupt handler must be fast</strong> and must not sleep. Real work is deferred — the NIC handler queues to a softirq/NAPI and returns. When you see CPU burn inside a driver name rather than a process name, this is why: interrupt time is accounted to <code>irq/</code> and <code>softirq/</code> pseudo-processes in <code>top</code>'s CPU breakdown, which is a hint about which subsystem is misbehaving."
        ],
        noteTitle: "A practical rule",
        note: "High load average with low CPU usage = <b>blocked on I/O</b> (state <code>D</code>). High load with high CPU = a runaway process or an interrupt storm. Always run <code>ps -eo state,pid,comm | awk '$1 ~ /D/'</code> before restarting anything — the answer is usually a stuck mount, and a reboot hides the cause instead of fixing it.",
        noteKind: "warn"
      },
      {
        type: "diagram",
        h: "Memory is a lie the kernel tells politely",
        caption: "Every process gets a private, identical-looking address space. Pages are mapped on demand and shared copy-on-write with the parent after <code>fork()</code>. Nothing is “really” resident until it is touched — which is exactly why a process with a 12&nbsp;GB virtual size and a 40&nbsp;MB RSS is not using 12&nbsp;GB.",
        svg: `
<svg viewBox="0 0 1100 520" role="img" aria-label="Virtual address space layout and page table mapping to physical memory">
  <!-- address space -->
  <text class="t-title" x="30" y="34">one process's virtual address space</text>
  <text class="t-xs" x="30" y="52">x86-64 layout — identical for every process; the difference is what the page tables point at</text>

  <rect class="box-a" x="30" y="66" width="250" height="60" rx="9"/>
  <text class="t-accent" x="46" y="90" font-size="14.5">user stack</text>
  <text class="t-sm" x="46" y="110">8 MB default, grows down</text>

  <rect class="box" x="30" y="132" width="250" height="52" rx="9"/>
  <text x="46" y="156" font-size="14.5">mmap region</text>
  <text class="t-xs" x="46" y="174">shared libs, thread stacks, large files, malloc arenas</text>

  <rect class="box-ok" x="30" y="190" width="250" height="52" rx="9"/>
  <text class="t-ok" x="46" y="214" font-size="14.5">heap (brk)</text>
  <text class="t-xs" x="46" y="232">malloc's main arena — old, small, slow to grow</text>

  <rect class="box-v" x="30" y="248" width="250" height="52" rx="9"/>
  <text class="t-violet" x="46" y="272" font-size="14.5">data / bss</text>
  <text class="t-xs" x="46" y="290">global variables — zero-filled on exec</text>

  <rect class="box" x="30" y="306" width="250" height="52" rx="9"/>
  <text x="46" y="330" font-size="14.5">text (code)</text>
  <text class="t-xs" x="46" y="348">read-only, executable, shared between identical processes</text>

  <rect class="box-b" x="30" y="364" width="250" height="120" rx="9"/>
  <text class="t-bad" x="46" y="388" font-size="14.5">kernel space</text>
  <text class="t-xs" x="46" y="408">not mapped in user page tables at all;</text>
  <text class="t-xs" x="46" y="426">a user pointer to it causes a page fault,</text>
  <text class="t-xs" x="46" y="444">not a segfault you can catch.</text>
  <text class="t-xs" x="46" y="468">This is why a null-pointer deref kills you instantly</text>

  <!-- page tables -->
  <rect class="box-p" x="360" y="66" width="270" height="418" rx="10"/>
  <text class="t-bad" x="378" y="92" font-size="15">page tables (kernel-owned)</text>
  <text class="t-sm" x="378" y="112">CR3 → PGD → PUD → PMD → PTE</text>
  <text class="t-xs" x="378" y="132">walked on every access that misses the TLB</text>
  <text class="t-sm" x="378" y="164">vaddr 0x0000…</text><line class="ln" x1="378" y1="176" x2="608" y2="176"/>
  <text class="t-sm" x="378" y="200">vaddr 0x4000… (text)</text><line class="ln" x1="378" y1="212" x2="608" y2="212"/>
  <text class="t-sm" x="378" y="236">vaddr 0x7fff… (stack)</text><line class="ln" x1="378" y1="248" x2="608" y2="248"/>
  <text class="t-xs" x="378" y="274">each line is a permission triple</text>
  <text class="t-xs" x="378" y="292">r / w / x  +  user / supervisor</text>
  <text class="t-xs" x="378" y="310">set up by mmap(), brk(), execve()</text>
  <text class="t-xs" x="378" y="332">changing them is the ONLY way to</text>
  <text class="t-xs" x="378" y="350">grant access — chmod on a file</text>
  <text class="t-xs" x="378" y="368">changes which file you may open,</text>
  <text class="t-xs" x="378" y="386">not which pages exist.</text>
  <text class="t-xs" x="378" y="420">copy-on-write flag (RO) is what</text>
  <text class="t-xs" x="378" y="438">fork() sets on every writable page</text>
  <text class="t-xs" x="378" y="456">until somebody writes → fault → copy</text>

  <!-- physical -->
  <rect class="box-ok" x="760" y="66" width="300" height="418" rx="10"/>
  <text class="t-ok" x="778" y="92" font-size="15">physical RAM (real)</text>
  <text class="t-xs" x="778" y="112">pages numbered 0..n, assigned on demand</text>
  <rect class="box" x="778" y="132" width="264" height="56" rx="8"/>
  <text class="t-sm" x="792" y="156">nginx code pages</text>
  <text class="t-xs" x="792" y="174">shared with 400 other workers</text>
  <rect class="box" x="778" y="198" width="264" height="56" rx="8"/>
  <text class="t-sm" x="792" y="222">nginx private heap</text>
  <text class="t-xs" x="792" y="240">400 copies, one per worker</text>
  <rect class="box" x="778" y="264" width="264" height="56" rx="8"/>
  <text class="t-sm" x="792" y="288">buffers + page cache</text>
  <text class="t-xs" x="792" y="306">file contents you already read</text>
  <rect class="box" x="778" y="330" width="264" height="56" rx="8"/>
  <text class="t-sm" x="792" y="354">swap / zram</text>
  <text class="t-xs" x="792" y="372">cold pages evicted to disk</text>
  <text class="t-xs" x="778" y="410">page cache is the reason “free” memory</text>
  <text class="t-xs" x="778" y="428">is a lie: used-but-cached RAM is</text>
  <text class="t-xs" x="778" y="446">good, not a problem.</text>

  <!-- arrows -->
  <path class="ln-a" d="M280,331 L356,331" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M630,212 L756,154" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M630,236 L756,226" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M630,248 L756,296" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="636" y="128">maps to</text>
</svg>`
      },
      {
        type: "diagram",
        h: "Where the code lives",
        caption: "The source tree is the map of the machine's responsibilities. When a subsystem misbehaves, <code>dmesg</code> names one of these directories. <b>kernel/</b> is the core (scheduler, mm, signals, cgroups, locking), <b>fs/</b> every filesystem, <b>net/</b> the stack, <b>drivers/</b> the hardware, <b>block/</b> the storage request queue underneath them, <b>arch/</b> the architecture-specific parts.",
        svg: `
<svg viewBox="0 0 1100 340" role="img" aria-label="Linux kernel source tree">
  <rect class="box-w" x="30" y="30" width="160" height="52" rx="9"/>
  <text class="t-warn" x="46" y="62" font-size="15">linux/</text>
  <text class="t-xs" x="46" y="77" class="t-xs">the tree</text>

  <g>
  <rect class="box-a" x="240" y="16" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="43" font-size="14">kernel/</text>
  <rect class="box-a" x="240" y="68" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="95" font-size="14">mm/</text>
  <rect class="box-a" x="240" y="120" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="147" font-size="14">fs/</text>
  <rect class="box-a" x="240" y="172" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="199" font-size="14">net/</text>
  <rect class="box-a" x="240" y="224" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="251" font-size="14">drivers/</text>
  <rect class="box-a" x="240" y="276" width="180" height="44" rx="8"/>
  <text class="t-accent" x="256" y="303" font-size="14">arch/</text>
  </g>

  <g>
  <text class="t-sm" x="436" y="43">scheduler, cgroups, signals, time, locking</text>
  <text class="t-sm" x="436" y="95">virtual memory, page allocator, OOM</text>
  <text class="t-sm" x="436" y="147">ext4 · xfs · btrfs · overlayfs · nfs · procfs</text>
  <text class="t-sm" x="436" y="199">ipv4/6 · tcp · netfilter · bridge · tun</text>
  <text class="t-sm" x="436" y="251">by far the largest directory — all the hardware</text>
  <text class="t-sm" x="436" y="303">x86, arm, riscv — where the syscall entry lives</text>
  <text class="t-xs" x="436" y="24">~35M lines, ~70% of it drivers</text>
  </g>

  <rect class="box-v" x="700" y="16" width="370" height="44" rx="8"/>
  <text class="t-violet" x="716" y="43" font-size="14">block/  — request queue between fs and driver</text>
  <rect class="box-v" x="700" y="68" width="370" height="44" rx="8"/>
  <text class="t-violet" x="716" y="95" font-size="14">security/ — LSM hooks, capabilities, integrity</text>
  <rect class="box-v" x="700" y="120" width="370" height="44" rx="8"/>
  <text class="t-violet" x="716" y="147" font-size="14">ipc/ · security/ · trace/ · samples/ · tools/</text>
  <rect class="box-p" x="700" y="172" width="370" height="148" rx="10"/>
  <text class="t-bad" x="716" y="198" font-size="14.5">the layer you should distrust</text>
  <text class="t-sm" x="716" y="222">Drivers and filesystems parse data written by</text>
  <text class="t-sm" x="716" y="240">untrusted parties: packets, USB descriptors,</text>
  <text class="t-sm" x="716" y="258">fuse replies, image headers, overlay upper dirs.</text>
  <text class="t-sm" x="716" y="286">Almost every kernel CVE you will ever read</text>
  <text class="t-sm" x="716" y="304">is a missing bounds check in exactly one</text>
  <text class="t-xs" x="716" y="330">of these. Keep firmware and kernels current.</text>
</svg>`
      },
      {
        type: "kv",
        h: "The kernel's control surfaces",
        items: [
          { k: "/proc", v: "A virtual <em>filesystem</em> in the VFS, synthesised by the kernel on read — not stored on disk. Process state, memory maps, hardware, module info. Reading <code>/proc/cpuinfo</code> costs a walk of kernel data structures, not a disk read." },
          { k: "/sys", v: "sysfs — the kernel's device and driver model. Every device, bus, class and driver appears as a directory tree with tunables in it. The place to check what a driver believes it found." },
          { k: "sysctl", v: "Kernel tunables with runtime handles (<code>fs.file-max</code>, <code>net.ipv4.ip_forward</code>, <code>vm.swappiness</code>, <code>net.core.somaxconn</code>). Persist them in <code>/etc/sysctl.d/*.conf</code>, not in <code>sysctl.conf</code> sprawl. Many exist only while the module is loaded." },
          { k: "lsmod / modprobe", v: "Kernel modules. Loaded on demand by <code>modprobe</code> from <code>modprobe.d</code> aliases. <strong>virtio</strong> on cloud VMs, <strong>overlay</strong> for containers, <strong>wireguard</strong> for VPN — all modules. A missing module looks like a mysterious failure, not a missing feature: <code>dmesg | grep -i 'Unknown symbol'</code>." },
          { k: "dmesg / journalctl -k", v: "The kernel ring buffer: hardware probe, driver messages, OOM kills, segfaults, blocked-request warnings. On a 2&nbsp;GB VPS this is the first place to look when a service will not start." },
          { k: "/proc/cmdline, /proc/version", v: "Kernel command line (root=, console=, net.ifnames=, mitigations=) and build identity. On a VPS, <code>cat /proc/cmdline</code> is often the fastest way to see which virtio devices and mitigations the hypervisor chose." },
          { k: "certs / firmware", v: "<code>/lib/firmware</code> + Secure Boot state. A “no suitable firmware found” message is a firmware problem, not a kernel one." }
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "The five kernel-level tools that answer most questions, in order of bluntness",
        code:
`# who is running, and in what state — the D state hunt
ps -eo pid,ppid,stat,etimes,rss,comm --sort=-rss | head -20
ps -eo state,pid,ppid,wchan:24,comm | awk '$1 ~ /^D/'

# what is the kernel complaining about (last 3 days, errors only)
journalctl -k --since "-3d" -p err --no-pager | tail -50
dmesg -T | grep -iE "oom|segfault|I/O error|blocked for more than|Unknown symbol"

# which files does this process hold — the lsof equivalent that always exists
ls -l /proc/1234/fd | head            # symlink target per descriptor
cat /proc/1234/status                 # threads, VmRSS, capabilities (CapEff), seccomp mode
cat /proc/1234/maps                   # every mapping: heap, libs, stacks, file-backed

# syscall-level truth, with real error numbers
strace -f -tt -T -e trace=openat,read,write,connect nginx -t   # then look for EACCES / ENOENT

# scheduling and memory pressure
cat /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io   # PSI: some avg10/60/300
grep -E "^(ctxt|processes|procs_running|procs_blocked)" /proc/stat
cat /sys/fs/cgroup/systemd.slice/memory.events 2>/dev/null        # oom / high counter`
      },
      {
        type: "prose",
        h: "The box this map was written against",
        p: [
          "Rather than describe a hypothetical server, several chapters use the one from your own estate: Ubuntu 18.04.6 LTS, kernel 4.15.0-213, systemd 237, cgroups <strong>v1</strong>, iptables 1.6 (legacy backend), systemd-resolved on 127.0.0.53, nginx 1.14, BIND 9.11.3, ufw 0.36, 2&nbsp;GB RAM. That is a genuinely old stack — and every one of those numbers changes on a modern box, so each chapter flags the delta.",
          "The single most consequential difference is <strong>cgroups v1 → v2</strong>. On 18.04 the resource controllers are separate directory trees (<code>/sys/fs/cgroup/memory</code>, <code>…/cpu</code>, <code>…/pids</code>) and systemd's own accounting is approximate. On cgroup v2 there is one unified hierarchy with <code>memory.max</code>, <code>cpu.max</code>, <code>pids.max</code> and real <code>memory.events</code> counters — which is the basis for every honest container memory limit and for Kubernetes' eviction story. The concepts are identical; the plumbing is not. Where a command differs between the two, both are shown."
        ],
        noteTitle: "Why this matters for you specifically",
        note: "That 4.15 kernel with Ubuntu Pro/ESM attached gets patched packages until 2028, and a newer kernel (4.15.0-260) is already installed but not booted. The safe maintenance move is a deliberate reboot onto the patched kernel — but only from a console-capable path, because your SSH is Tailscale-only. Nothing else on this box needs to change for it to be correct; the ESM packages are doing the work.",
        noteKind: "boss"
      },
      {
        type: "callout",
        kind: "warn",
        title: "mental model to keep",
        text: "The kernel grants; user space requests. Whenever something on your machine misbehaves, the first question is always <em>which of the two halves is it?</em> A process that returns <code>ENOENT</code> is a user-space program asking the wrong question. A machine that will not respond to <code>kill -9</code> is the kernel saying <code>D</code> state, and no amount of user-space cleverness will fix it."
      }
    ],
    takeaways: [
      "Two halves, one door. <strong>syscall</strong> = you asked; <strong>interrupt</strong> = hardware decided. Nothing else crosses into ring 0.",
      "The kernel validates every pointer, length and permission before it acts — that is why <code>errno</code> from a syscall is the fastest truth in any debugging session.",
      "The MMU is the real enforcer. Access to a page exists only because the kernel mapped it; file permissions are a policy decision on top, not a memory guarantee.",
      "<strong>D state is not “busy” — it is “unkillable”.</strong> High load with idle CPU means blocked I/O, and rebooting hides the real cause.",
      "Kernel CVE surface is overwhelmingly drivers and filesystems parsing untrusted data. Updating the kernel and firmware is a security control, not a chore.",
      "Virtual size, resident size and shared pages are three different numbers; the page cache makes “free” memory a rough concept. Learn to read <code>/proc</code> directly instead of guessing from <code>free</code>."
    ],
    glossary: {
      "syscall": "A controlled request from user space into the kernel. The only sanctioned way to touch the machine.",
      "trap": "A synchronous CPU mode switch caused by the running code itself (syscall, page fault, illegal instruction).",
      "interrupt": "An asynchronous CPU mode switch caused by hardware (timer, NIC, disk) — the process did not ask.",
      "ring 0 / ring 3": "CPU privilege levels. Ring 3 is user space; ring 0 is the kernel. Enforced in hardware by the MMU.",
      "MMU": "Memory Management Unit. Translates virtual addresses to physical pages and enforces page permissions.",
      "page table": "The kernel data structure mapping virtual addresses to physical pages plus r/w/x permissions. Reached via CR3.",
      "TLB": "Translation Lookaside Buffer — CPU cache of recent address translations. A stale TLB entry is a class of kernel bug.",
      "copy-on-write": "fork() marks every writable page read-only and shares it; the first write triggers a fault and a private copy.",
      "RSS": "Resident Set Size — pages actually in RAM right now. Shared pages count in every sharer's RSS.",
      "D state": "Uninterruptible sleep. The task is waiting on I/O and cannot be killed or woken by signals.",
      "PSI (Pressure Stall Information)": "/proc/pressure/{cpu,memory,io} — how much time tasks spent stalled waiting for each resource.",
      "OOM killer": "The kernel's choice of a victim when memory is exhausted. Logs to dmesg; cgroup v2 makes it cgroup-scoped.",
      "LSM": "Linux Security Module hook framework. AppArmor and SELinux plug mandatory access control into the same kernel paths."
    }
  });
})();