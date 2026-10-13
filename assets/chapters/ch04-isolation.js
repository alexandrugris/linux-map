/* ch04 — Users, permissions, and the isolation stack */
(function () {
  LX.push({
    id: "isolation",
    title: "Users, permissions, and the isolation stack",
    tagline: "Ownership stops mistakes, capabilities stop escalation, namespaces hide, cgroups bound. A container is all four at once — and that is the whole trick.",
    sections: [
      {
        type: "prose",
        h: "The model most people half-remember",
        p: [
          "Unix has a brutally simple permission model. Every file and process has an owner and a group. Every permission bit appears three times — user, group, other — and the kernel picks <strong>exactly one row</strong> to consult. There is no union, no “most permissive match”. If you are the owner, the group bits do not matter at all.",
          "What people half-remember is the exception: uid 0. <code>root</code> bypasses most of this. Not because the kernel special-cases the number 0, but because root normally <em>holds capabilities</em> — the ones that override the checks: <code>CAP_DAC_OVERRIDE</code> (ignore read/write permission bits), <code>CAP_DAC_READ_SEARCH</code> (ignore directory search permission), <code>CAP_FOWNER</code> (chmod anything), <code>CAP_CHOWN</code>, <code>CAP_KILL</code> (signal anything), and on modern kernels nothing else by default.",
          "That reframing matters because it explains the direction security has moved in the last decade. Root is no longer a magic number; it is <em>a bundle of capabilities</em>. And those capabilities can be handed out one at a time — which is how a web server gets the right to bind port 80 and nothing else, without ever being root. Chapter 15 turns this into a hardening plan; here it is just the model."
        ]
      },
      {
        type: "diagram",
        h: "The isolation stack: seven layers, each solving a different problem",
        caption: "Read bottom-up for enforcement, top-down for blast radius. A <b>VM</b> below line 6 replaces all of it with a hypervisor boundary — stronger, heavier. Everything a container does is a composition of lines 1–6, which is why \"a container is just a process\" is true and useless: the interesting part is which of these lines you turned on, and how.",
        svg: `
<svg viewBox="0 0 1100 720" role="img" aria-label="Layered isolation stack from VM hypervisor up to namespaces and cgroups">
  <text class="t-title" x="30" y="28">Layers, from the strongest boundary to the finest</text>

  <rect class="box-b" x="30" y="44" width="1040" height="66" rx="10"/>
  <text class="t-bad" x="48" y="68" font-size="15">6 · Hypervisor / VM boundary</text>
  <text class="t-sm" x="48" y="90">guest kernel is entirely untrusted; a guest kernel bug is contained by the host. Costs a guest kernel, memory, boot time, and networking magic.</text>
  <text class="t-xs" x="48" y="106">use when the code is genuinely hostile — multi-tenant untrusted workloads, or a different kernel is required</text>

  <rect class="box-w" x="30" y="122" width="1040" height="60" rx="10"/>
  <text class="t-warn" x="48" y="146" font-size="15">5 · seccomp + LSM (AppArmor / SELinux) — syscall and path policy</text>
  <text class="t-sm" x="48" y="168">“this process may only call these syscalls” and “this process may only touch these paths”. The only layers that constrain <tspan font-style="italic">what a process does</tspan> rather than what it can see or use.</text>

  <rect class="box-a" x="30" y="194" width="1040" height="60" rx="10"/>
  <text class="t-accent" x="48" y="218" font-size="15">4 · namespaces — what the process can SEE</text>
  <text class="t-sm" x="48" y="240">pid · mnt · net · uts · ipc · user · cgroup · time. Each one gives a task its own copy of a kernel global. Nothing is shared that you did not deliberately re-share.</text>

  <rect class="box-a" x="30" y="266" width="1040" height="60" rx="10"/>
  <text class="t-accent" x="48" y="290" font-size="15">3 · cgroups — what the process may CONSUME</text>
  <text class="t-sm" x="48" y="312">memory.max · cpu.max · pids.max · io.max. Enforced by the kernel at allocation time, not by cooperation. This is what makes a container limit real.</text>

  <rect class="box-v" x="30" y="338" width="1040" height="60" rx="10"/>
  <text class="t-violet" x="48" y="362" font-size="15">2 · capabilities + setuid/setgid — WHAT POWER the process has</text>
  <text class="t-sm" x="48" y="384">replaces “root or nothing”. A binary can carry capabilities on disk; a process carries them in its permitted/effective/ambient sets. Bound by the bounding set and dropped on exec.</text>

  <rect class="box-ok" x="30" y="410" width="1040" height="60" rx="10"/>
  <text class="t-ok" x="48" y="434" font-size="15">1 · users, groups, permission bits — IDENTITY</text>
  <text class="t-sm" x="48" y="456">uid/gid + rwx. Stops accidents, not attacks. It is advisory in exactly one direction: never root.</text>

  <!-- the container formula -->
  <rect class="box-a" x="30" y="496" width="640" height="200" rx="12"/>
  <text class="t-accent" x="48" y="524" font-size="16">The container formula — there is nothing else</text>
  <text class="t-sm" x="48" y="552">1.  a root filesystem</text>
  <text class="t-xs" x="66" y="570">an overlayfs mount (or a bind of a real directory) — layer 0 of everything above</text>
  <text class="t-sm" x="48" y="594">2.  a set of namespaces</text>
  <text class="t-xs" x="66" y="612">mnt (so it sees only its own /) · pid (so its PIDs start at 1) · net (so it has its own eth0) · uts (its own hostname) · ipc · mount</text>
  <text class="t-sm" x="48" y="636">3.  a cgroup</text>
  <text class="t-xs" x="66" y="654">so it cannot exhaust the host's memory, CPU, PIDs or disk IO</text>
  <text class="t-sm" x="48" y="678">4.  a credential and syscall profile</text>
  <text class="t-xs" x="66" y="696">dropped capabilities, no-new-privileges, an optional seccomp filter and AppArmor profile</text>

  <rect class="box-b" x="700" y="496" width="370" height="200" rx="12"/>
  <text class="t-bad" x="718" y="524" font-size="16">What it still does not give you</text>
  <text class="t-sm" x="718" y="550">· its own kernel — a kernel bug is still <tspan font-style="italic">your</tspan> kernel</text>
  <text class="t-sm" x="718" y="576">· a separate clock — a container can read the host time (time ns only names it)</text>
  <text class="t-sm" x="718" y="602">· a separate page cache — shared, which is a feature and a side-channel</text>
  <text class="t-sm" x="718" y="628">· a separate host resource that is not in a cgroup controller</text>
  <text class="t-sm" x="718" y="654">· security against a determined co-tenant with enough time</text>
  <text class="t-xs" x="718" y="680">For most application workloads this is irrelevant. For hostile code, it is the whole question.</text>
</svg>`
      },
      {
        type: "prose",
        h: "How a permission check actually resolves",
        p: [
          "Given a target inode and a calling task, the kernel does something less clever than people assume, and the simplicity is worth internalising because it explains most permission bugs.",
          "First: <strong>does the caller hold a matching capability?</strong> If it has <code>CAP_DAC_OVERRIDE</code> (or <code>CAP_DAC_READ_SEARCH</code> for search permission), the check is over and the answer is yes. That is why root can read <code>/etc/shadow</code> — not because of the bits, which are <code>640 root:shadow</code>, but because of the capability.",
          "Second: <strong>if not, DAC runs.</strong> If the caller's <em>effective</em> uid owns the file, use the owner bits. Otherwise, if the file's group is in the caller's supplementary groups, use the group bits. Otherwise use the other bits. The first match wins and the rest are ignored — a file with mode <code>0400</code> owned by another user is <em>unreadable</em> to you even if you are in a group that would grant read.",
          "Third: POSIX ACLs, if any are set, replace the three-row model for that inode. Then AppArmor or SELinux runs, then the LSM's own hooks, then a seccomp filter could still stop the syscall entirely. Then cgroup limits are checked at allocation time — a write can be refused by <code>ENOSPC</code> from the kernel because the cgroup is full, even on a filesystem with a terabyte free.",
          "Two consequences worth keeping. <strong>Execution is a permission</strong> — the <code>x</code> bit on a file is not “execute” for data, it is “search this directory” or “exec this binary”, and on Linux a directory's <code>x</code> bit has nothing to do with listing. <strong>Deleting a file needs no permission on the file at all</strong> — it needs <code>w</code> and <code>x</code> on the <em>directory</em>, plus the sticky bit to stop you deleting other people's files. That is why you can remove a root-owned file in a world-writable directory you have write access to, and why “the file is read-only” is not the reason you could not delete it."
        ]
      },
      {
        type: "diagram",
        h: "One permission check, in order",
        caption: "Every access to every file goes through this. The two capability short-circuits at the top are why <code>root</code> works, and why dropping <code>CAP_DAC_OVERRIDE</code> from a process makes it obey the permission bits like everybody else — the single highest-value hardening move in the whole stack.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Flowchart of the kernel permission check for a file access">
  <rect class="box-a" x="370" y="24" width="360" height="46" rx="9"/>
  <text class="t-accent" x="550" y="52" text-anchor="middle" font-size="15">nginx worker opens /etc/nginx/site.conf</text>

  <path class="ln-a" d="M550,70 L550,104" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-w" x="300" y="104" width="500" height="60" rx="9"/>
  <text class="t-sm" x="318" y="128">1 · capability short-circuit</text>
  <text class="t-xs" x="318" y="148">CAP_DAC_OVERRIDE?  then yes, immediately.  CAP_DAC_READ_SEARCH?  applies to directory search only.</text>

  <path class="ln" d="M380,164 L380,196" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M550,164 L550,196" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M720,164 L720,196" marker-end="url(#lm-arrow)"/>

  <rect class="box-v" x="240" y="196" width="280" height="60" rx="9"/>
  <text class="t-violet" x="258" y="220">a · euid == owner?</text>
  <text class="t-xs" x="258" y="240">use the u=rwx triple</text>
  <rect class="box-v" x="540" y="196" width="280" height="60" rx="9"/>
  <text class="t-violet" x="558" y="220">b · gid in supp. groups?</text>
  <text class="t-xs" x="558" y="240">use the g=rwx triple</text>
  <rect class="box-v" x="840" y="196" width="240" height="60" rx="9"/>
  <text class="t-violet" x="858" y="220">c · otherwise</text>
  <text class="t-xs" x="858" y="240">use the o=rwx triple</text>

  <path class="ln" d="M300,256 L300,296 L560,296 L560,330" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M680,256 L680,296 L560,296" />
  <path class="ln" d="M960,256 L960,296 L560,296" />
  <path class="ln" d="M240,226 L200,226 L200,296 L560,296" />

  <rect class="box-ok" x="420" y="330" width="280" height="44" rx="9"/>
  <text class="t-ok" x="560" y="358" text-anchor="middle">bit set?  → continue</text>
  <path class="ln-b" d="M420,352 L200,352" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="60" y="330" width="260" height="44" rx="9"/>
  <text class="t-bad" x="76" y="350" font-size="13.5">EACCES → “permission denied”</text>
  <text class="t-xs" x="76" y="366">errno you get back in userspace</text>

  <path class="ln-ok" d="M560,374 L560,404" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-a" x="340" y="404" width="440" height="44" rx="9"/>
  <text class="t-sm" x="358" y="424">2 · POSIX ACLs (if the inode has any)</text>
  <text class="t-xs" x="358" y="440">getfacl replaces the three rows entirely; mask entry caps the group bits</text>

  <path class="ln-a" d="M560,448 L560,472" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-w" x="340" y="472" width="440" height="60" rx="9"/>
  <text class="t-sm" x="358" y="494">3 · LSM: AppArmor / SELinux may still deny</text>
  <text class="t-xs" x="358" y="514">and 4 · cgroup quotas may still refuse the allocation (ENOSPC / ENOMEM)</text>
  <text class="t-xs" x="358" y="528">a file can be 0666 and the open still returns EACCES — look at dmesg for the LSM denial</text>
</svg>`
      },
      {
        type: "prose",
        h: "Capabilities: the end of root as a unit",
        p: [
          "The traditional way to give a program special power was the setuid bit: a binary marked <code>u+s</code> runs as its owner regardless of who launched it. <code>sudo</code>, <code>ping</code>, <code>passwd</code> are all setuid root, which is why <code>find / -perm -4000</code> is a security review you should run on any machine you did not build.",
          "Capabilities replace that with something finer. The kernel has a numbered list of capabilities (<code>CAP_NET_BIND_SERVICE</code> = 10, <code>CAP_SYS_ADMIN</code> = 21, <code>CAP_NET_RAW</code> = 13, and so on). Each process carries four sets — <strong>permitted</strong> (what it may ever gain), <strong>effective</strong> (what it uses now), <strong>inheritable</strong> (a template for exec), <strong>bounding</strong> (the ceiling that can never be regained, even by root-in-a-namespace). A file can carry capabilities too, in <code>xattr</code>, so a binary can be granted <code>CAP_NET_BIND_SERVICE</code> permanently and be run by any unprivileged user.",
          "The rule that makes this useful: <code>CAP_SYS_ADMIN</code> is not “most of root”, it is <em>all</em> of it, effectively. It grants mount, namespace creation, cgroup modification, ptrace, and more. A process with <code>CAP_SYS_ADMIN</code> can usually escape a container. Any tool that tells you to “run this with --cap-add=SYS_ADMIN” has told you to run it as root with extra steps.",
          "The real-world example: nginx wants to bind port 80, which is privileged below 1024, but has no other reason to be root. So it starts as root, binds the listening sockets in its master process, and then <code>setgid/setuid</code>s its workers to <code>www-data</code>. The master keeps the capability; the workers that actually touch the filesystem do not have it. That is the pattern to imitate — <strong>split the privilege across the lifecycle rather than giving it to the process that does the work</strong>."
        ]
      },
      {
        type: "prose",
        h: "Namespaces: one kernel, many parallel universes",
        p: [
          "A namespace is the kernel feature that turns a single global thing into a per-task copy. The mount table is global — and yet a container has its own view of <code>/</code>, because its mount table is a copy. The PID namespace is a counter — and yet a container sees PID 1 as init, because the counter is per-namespace. It is the cheapest and most elegant isolation primitive in the kernel, and it is the foundation of every container runtime.",
          "Each namespace has exactly one job, and it is important to know what each one <em>does not</em> hide, because that is where container escapes and cross-container visibility come from."
        ]
      },
      {
        type: "table",
        cols: ["Namespace", "What it virtualises", "Inside vs outside", "Gotcha"],
        rows: [
          ["<code>pid</code>", "The PID counter and <code>/proc</code>", "A container's init is PID 1. Your process is PID 1 on the host and, say, 7 in the container", "PID 1 must reap children. A PID 1 that does not is a zombie factory and a future <code>pids.max</code> outage"],
          ["<code>mnt</code>", "The mount table and root", "<code>/</code> is whatever you mounted. <code>/proc</code> shows only your processes if <code>pid</code> is also unshared", "Bind mounts and symlinks out of the tree are real paths out. A secret in <code>/var/run</code> is visible unless you masked it"],
          ["<code>net</code>", "Network interfaces, routes, ports, the ARP cache", "The container has its own <code>lo</code>, its own eth0, its own port space. <code>listen()</code> on :80 inside is free", "<strong>Not</strong> isolated: the host still routes, still filters. Two containers cannot both bind :80 in one netns"],
          ["<code>uts</code>", "Hostname and domain name", "<code>hostname</code> is your own; this is the container's “name” in logs", "Cosmetic. It does not affect DNS resolution by anything else"],
          ["<code>ipc</code>", "System V IPC: shared memory, message queues, semaphores", "Containers cannot accidentally corrupt each other's shared memory", "POSIX shm and mqueue files are <em>not</em> namespaced — they need a separate <code>IPC:</code> mount"],
          ["<code>user</code>", "UID/GID mapping to the parent namespace", "Root inside is a mapped, unprivileged UID outside. This is what makes rootless containers work", "Inside-UID 0 is not outside-root. A user-namespace container cannot chown files to real root without a mapping"],
          ["<code>cgroup</code>", "The <code>/sys/fs/cgroup</code> view", "The container sees only its own subtree as the root", "Only useful with cgroup v2; on v1 the namespace exists but the view is largely cosmetic"],
          ["<code>time</code>", "Names of the time namespaces", "Lets one process have a different monotonic clock offset — for testing", "It does <strong>not</strong> virtualise the clock. A container reads the host's real time"]
        ]
      },
      {
        type: "diagram",
        h: "What a container can and cannot see",
        caption: "The host's namespaces at the top, the container's at the bottom. Every line crossing the boundary is a deliberate re-share performed by the runtime — <code>--net=host</code>, <code>--pid=host</code>, a <code>CAP_SYS_ADMIN</code> that slipped through, or a bind mount of a host path. Runtime misconfiguration, not kernel weakness, is how containers stop being isolated.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="What a container sees versus the host">
  <rect class="box-b" x="30" y="24" width="1040" height="270" rx="12"/>
  <text class="t-bad" x="48" y="50" font-size="16">HOST</text>

  <text class="t-sm" x="48" y="80">processes</text>
  <text class="t-xs" x="140" y="80">nginx (host) · sshd · journald · containerd · kubelet · 240 nginx workers …</text>
  <text class="t-sm" x="48" y="106">/proc</text>
  <text class="t-xs" x="140" y="106">every process, every fd, every memory map on the machine</text>
  <text class="t-sm" x="48" y="132">mounts</text>
  <text class="t-xs" x="140" y="132">/ · /boot · /var/lib/containerd · /var/lib/kubelet · /sys/fs/cgroup · /run/docker/netns/…</text>
  <text class="t-sm" x="48" y="158">network</text>
  <text class="t-xs" x="140" y="158">eth0 (your public IP) · tailscale0 · docker0 · veth pairs · NAT rules · conntrack table</text>
  <text class="t-sm" x="48" y="184">hostname</text>
  <text class="t-xs" x="140" y="184">ubuntu-2gb-hel1-1</text>
  <text class="t-sm" x="48" y="210">memory / CPU / PIDs</text>
  <text class="t-xs" x="140" y="210">2 GB, 2 cores, pid_max ≈ 4 million — shared, unless a cgroup says otherwise</text>
  <text class="t-sm" x="48" y="236">devices</text>
  <text class="t-xs" x="140" y="236">/dev/null, /dev/zero, /dev/sda, /dev/net/tun — every device node the host has</text>
  <text class="t-sm" x="48" y="262">capabilities</text>
  <text class="t-xs" x="140" y="262">root's full set, if the runtime did not drop them (and this is the default in Docker — it is not)</text>

  <rect class="box-a" x="30" y="318" width="1040" height="200" rx="12"/>
  <text class="t-accent" x="48" y="344" font-size="16">CONTAINER — same kernel, different view</text>

  <text class="t-sm" x="48" y="374">processes</text>
  <text class="t-xs" x="140" y="374">1 entrypoint · its workers · PID 1 is its own init</text>
  <text class="t-sm" x="48" y="400">/proc</text>
  <text class="t-xs" x="140" y="400">only its own processes; ps aux inside shows one process tree</text>
  <text class="t-sm" x="48" y="426">mounts</text>
  <text class="t-xs" x="140" y="426">only the layers of its image + explicitly mounted volumes</text>
  <text class="t-sm" x="48" y="452">network</text>
  <text class="t-xs" x="140" y="452">eth0 on 10.244.1.7/24, lo, and nothing else — port 80 is free, your public IP is not there</text>
  <text class="t-sm" x="48" y="478">hostname</text>
  <text class="t-xs" x="140" y="478">the pod name, set by the UTS namespace</text>
  <text class="t-sm" x="48" y="502">limits</text>
  <text class="t-xs" x="140" y="502">whatever the cgroup says: 512 MiB, 1 core, 1024 PIDs — enforced by the kernel</text>

  <path class="ln-b" d="M290,294 L290,318" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="304" y="310" font-size="13">re-shared on purpose — and here is where it goes wrong</text>

  <rect class="box-w" x="30" y="538" width="1040" height="90" rx="9"/>
  <text class="t-warn" x="48" y="562" font-size="14.5">The lines that must not be crossed</text>
  <text class="t-sm" x="48" y="586">--net=host   → shares the host's interfaces and port space. Kubernetes hostNetwork: true.</text>
  <text class="t-sm" x="48" y="608">--pid=host   → shares the process table. You can see and signal every process on the machine.</text>
  <text class="t-xs" x="48" y="624">--privileged / CAP_SYS_ADMIN → can mount, create namespaces, escape. And a hostPath volume mount of / is the same thing by another route.</text>
</svg>`
      },
      {
        type: "prose",
        h: "cgroups: isolation by accounting",
        p: [
          "Namespaces hide. cgroups <strong>account</strong>. A cgroup is a directory in a virtual filesystem where the kernel tracks every task inside it and every page of memory they have allocated, every second of CPU they consumed, every block of disk IO they generated. The moment a group crosses a limit the kernel acts — throttling the task, or killing it.",
          "This is why <code>ulimit</code> is not the same thing and is not enough. <code>ulimit -v</code> limits <em>virtual</em> address space, which is a promise made by the process about its own behaviour, and modern runtimes ignore it because 64-bit address spaces make it meaningless. A cgroup limit is enforced by the kernel at the moment of allocation and cannot be lied to.",
          "<strong>cgroup v1</strong> has one hierarchy <em>per controller</em>: <code>/sys/fs/cgroup/memory/</code>, <code>/sys/fs/cgroup/cpu/</code>, <code>/sys/fs/cgroup/pids/</code>, all separate trees, each with its own notion of the process hierarchy. <strong>cgroup v2</strong> has one unified hierarchy at <code>/sys/fs/cgroup/</code>, with the controllers enabled by files in <code>cgroup.subtree_control</code>, and unified knobs: <code>memory.max</code>, <code>cpu.max</code> (a quota/period pair like <code>200000 100000</code> = 2 cores), <code>pids.max</code>, <code>io.max</code>.",
          "The difference that bites in practice is <strong>scope of the OOM killer</strong>. On v1, when a memory cgroup exceeds its limit, the kernel looks for a victim <em>within that cgroup</em> — decent. On v2 the same is true and better instrumented, with <code>memory.events</code> telling you exactly what happened. The nastier v1 behaviour is host-level OOM, which kills the largest process on the machine regardless of cgroup — and on a 2 GB server, that is your container, or worse, something you did not know was running.",
          "Memory accounting also has a subtlety that explains the most common container complaint: the kernel charges a cgroup for the <strong>page cache</strong> its files generate, and only reclaims that under pressure. So a container that wrote 2 GB into a volume can be OOM-killed even though its <code>RSS</code> is 200 MB. <code>memory.stat</code> (or <code>memory.current</code> vs <code>anon</code>) is how you tell real memory from cached."
        ]
      },
      {
        type: "diagram",
        h: "The cgroup hierarchy on a node, and what happens at the limit",
        caption: "Every task on the node is in exactly one leaf cgroup; the leaf is where limits are written. On your 18.04 box the tree is <b>v1</b>, so the controllers are separate directory trees and the paths differ — that is the single most common source of \"the file does not exist\" when copying limits between machines. On a v2 kernel there is one tree and <code>memory.max</code> instead of <code>memory.limit_in_bytes</code>.",
        svg: `
<svg viewBox="0 0 1100 660" role="img" aria-label="cgroup v2 hierarchy with limits and OOM behaviour, plus v1 path differences">
  <rect class="box-a" x="30" y="24" width="360" height="46" rx="9"/>
  <text class="t-accent" x="48" y="46" font-size="14.5">cgroup v2 — one tree</text>
  <text class="t-xs" x="48" y="62">/sys/fs/cgroup/</text>

  <rect class="box" x="30" y="82" width="360" height="40" rx="8"/>
  <text class="t-sm" x="48" y="106">/  (the root, all tasks)</text>

  <path class="ln" d="M210,122 L150,150" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M210,122 L360,150" marker-end="url(#lm-arrow)"/>

  <rect class="box-ok" x="30" y="150" width="240" height="40" rx="8"/>
  <text class="t-sm" x="48" y="174">system.slice  (systemd units)</text>
  <rect class="box-v" x="290" y="150" width="240" height="40" rx="8"/>
  <text class="t-sm" x="308" y="174">kubepods.slice  (your cluster)</text>

  <path class="ln" d="M150,190 L110,222" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M150,190 L240,222" marker-end="url(#lm-arrow)"/>

  <rect class="box" x="30" y="222" width="160" height="40" rx="8"/>
  <text class="t-sm" x="44" y="246">nginx.service</text>
  <rect class="box" x="200" y="222" width="160" height="40" rx="8"/>
  <text class="t-sm" x="214" y="246">ssh.service</text>

  <path class="ln" d="M410,190 L370,222" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M410,190 L500,222" marker-end="url(#lm-arrow)"/>

  <rect class="box-b" x="290" y="222" width="160" height="40" rx="8"/>
  <text class="t-sm" x="304" y="246">pod A (qos)</text>
  <rect class="box-b" x="460" y="222" width="160" height="40" rx="8"/>
  <text class="t-sm" x="474" y="246">pod B (qos)</text>

  <path class="ln-b" d="M370,262 L370,296" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-b" x="290" y="296" width="160" height="94" rx="8"/>
  <text class="t-sm" x="304" y="320">container 0 (leaf)</text>
  <text class="t-xs" x="304" y="340">memory.max = 536870912</text>
  <text class="t-xs" x="304" y="358">memory.high = 483183820</text>
  <text class="t-xs" x="304" y="376">cpu.max = 200000 100000</text>

  <text class="t-xs" x="650" y="330">memory.high  → soft limit. Above it the kernel reclaims</text>
  <text class="t-xs" x="650" y="350">page cache and throttles. The process slows. Nobody dies.</text>
  <text class="t-xs" x="650" y="376">memory.max   → hard limit. Allocations now fail.</text>
  <text class="t-xs" x="650" y="396">memory.events counters oom / oom_kill / max go up.</text>
  <path class="ln-b" d="M460,330 L640,330" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <path class="ln-b" d="M460,376 L640,376" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>

  <rect class="box-w" x="30" y="420" width="360" height="216" rx="10"/>
  <text class="t-warn" x="48" y="444" font-size="14.5">cgroup v1 — your Ubuntu 18.04</text>
  <text class="t-xs" x="48" y="468">Separate trees, one per controller:</text>
  <text class="t-xs" x="48" y="492">/sys/fs/cgroup/memory/…</text>
  <text class="t-xs" x="48" y="512">/sys/fs/cgroup/cpu/…</text>
  <text class="t-xs" x="48" y="532">/sys/fs/cgroup/pids/…</text>
  <text class="t-xs" x="48" y="552">/sys/fs/cgroup/cpu,cpuacct/…  (combined on systemd)</text>
  <text class="t-xs" x="48" y="576">Same concepts, different filenames:</text>
  <text class="t-xs" x="48" y="598">memory.limit_in_bytes   → memory.max</text>
  <text class="t-xs" x="48" y="618">cpu.cfs_quota_us + cpu.cfs_period_us → cpu.max</text>

  <rect class="box-p" x="420" y="420" width="650" height="216" rx="10"/>
  <text class="t-bad" x="438" y="444" font-size="14.5">Reading it on a live machine</text>
  <text class="t-sm" x="438" y="470">systemd does not make you cd around — ask it:</text>
  <text class="t-sm" x="438" y="492">systemctl show nginx -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax</text>
  <text class="t-sm" x="438" y="516">systemd-cgtop                    # live usage per unit</text>
  <text class="t-sm" x="438" y="540">cat /sys/fs/cgroup/&lt;path&gt;/memory.max /memory.current /memory.stat</text>
  <text class="t-sm" x="438" y="564">cat /sys/fs/cgroup/&lt;path&gt;/memory.events   # oom, oom_kill, max, high counters</text>
  <text class="t-xs" x="438" y="592">On 18.04 the v1 equivalent is memory.failcnt, memory.oom_control and memory.limit_in_bytes — and a host-level</text>
  <text class="t-xs" x="438" y="610">OOM kill appears in dmesg as “Out of memory: Killed process 1234 (nginx)” with no cgroup named, which is</text>
  <text class="t-xs" x="438" y="628">exactly why that message is worth reading twice rather than dismissing.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Working with isolation directly — the toolbelt",
        code:
`# who am I, really?
id                                    # uid, gid, supplementary groups — this is the whole identity
id -u ; id -un ; id -G
getent passwd alexgris               # resolve the OTHER way round, NSS-aware

# what capabilities does this process actually hold?
cat /proc/self/status | grep -E 'Cap(Inh|Prm|Eff|Bnd|Amb)'
getpcaps $$                         # one-line summary of a pid
capsh --print                       # decode the capability sets, and list all names
capsh --decode=0x00000000a80425fb    # hex → capability names

# build a process with exactly the privileges it needs
setpriv --reuid=www-data --regid=www-data --init-groups --inh-caps=-all \\
        --ambient-caps=-all --bounding-set=-all --no-new-privs /usr/sbin/nginx -t
# equivalent on disk:
#   setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx

# namespaces, without a container runtime
unshare -p -f --mount-proc bash          # new pid + mount ns, fork so PID 1 is right
lsns -t pid -o NS,PID,COMMAND              # every namespace on the system and who is in it
readlink /proc/1/ns/pid /proc/self/ns/pid # compare: different inode = different namespace
nsenter -t 1234 -n -m -u -i -p -a -t ls   # drop into another process's view of everything
#   -n network  -m mount  -u uts  -i ipc  -p pid  -C cgroup  -a all user-owned

# cgroups (v2 paths shown; see v1 equivalents in the chapter)
cat /sys/fs/cgroup/system.slice/nginx.service/memory.max
echo 536870912 > /sys/fs/cgroup/system.slice/nginx.service/memory.max   # 512 MiB
systemctl set-property nginx.service MemoryMax=512M CPUQuota=50% TasksMax=200
systemd-cgtop --depth=2

# audit: who is privileged, and what should not be
find / -perm -4000 -type f 2>/dev/null          # every setuid binary on the machine
getcap -r / 2>/dev/null | head -50             # file capabilities
systemd-analyze security nginx.service          # scores a unit's hardening, item by item

# isolate for real, with no container runtime at all
systemd-run --scope -p MemoryMax=256M -p NoNewPrivileges=yes \\
            -p ProtectSystem=strict -p ProtectHome=yes -- your-command
bwrap --unshare-all --ro-bind /usr /usr --ro-bind /lib /lib \\
     --bind ./data ./data --dev /dev --proc /proc -- /bin/sh`
      },
      {
        type: "callout",
        kind: "fact",
        title: "What “root” means on your own server",
        text: "Your VPS runs as a single-tenant machine where sshd is reachable only over Tailscale, <code>PasswordAuthentication no</code> is set, and both account passwords are locked. That means the practical privilege boundary is not the permission model at all — it is <b>who holds an SSH key</b>. The DAC layers only matter once something is authenticated: the second user account, a compromised key, a malicious package, a web shell in <code>/var/www</code>.<br><br>That is the honest ranking of controls on that box: (1) network reachability of SSH, (2) key integrity, (3) patch level, (4) everything else. Chapters 11 and 15 build on that ordering rather than pretending <code>chmod 700</code> is the defence."
      },
      {
        type: "table",
        cols: ["", "chroot", "Container", "VM"],
        rows: [
          ["Kernel", "shared with the host", "shared with the host", "its own"],
          ["Isolation from a kernel bug", "<b>none</b> — it is not a security boundary at all", "weak — shares the kernel, but namespaced and limited", "strong — the hypervisor is the boundary"],
          ["Boot time", "instant", "<b>instant</b> (no kernel to boot)", "seconds to tens of seconds"],
          ["Memory overhead", "none", "a few MB", "tens to hundreds of MB of guest kernel"],
          ["Networking", "host's, unless you unshare net manually", "own netns, CNI/veth, NAT", "own virtual NIC, bridge or virtio"],
          ["File isolation", "partial — chroot is escapable and shares the filesystem", "overlayfs + mount namespace, real layering", "a virtual disk"],
          ["The one thing it is for", "legacy software that expects a fixed root; positional args", "<b>packaging and running untrusted-ish code</b>", "running genuinely hostile code, or a different kernel/OS"]
        ]
      }
    ],
    takeaways: [
      "Permission checks are <strong>one row, not a union</strong>, and root bypasses them via capabilities, not via a magic number.",
      "<strong>Capabilities replaced setuid</strong>. Drop <code>CAP_DAC_OVERRIDE</code> and a process obeys the permission bits like anyone else — the highest-value move in the stack.",
      "Never give a process <code>CAP_SYS_ADMIN</code>. It is root with extra steps and it removes a container's containment.",
      "Namespaces hide, cgroups bound, LSMs restrict, seccomp filters syscalls. <strong>None of them alone is a sandbox.</strong>",
      "A container is a rootfs + namespaces + a cgroup + a credential profile. There is no fifth thing, and no magic hypervisor.",
      "Containers share the kernel, the clock, the page cache and every device node. For hostile multi-tenant code, that is the whole risk.",
      "<code>ulimit</code> is a promise; a cgroup is a fact. Limits that must hold are cgroup limits."
    ],
    glossary: {
      "DAC": "Discretionary Access Control — the owner/group/other permission model. Advisory: it stops accidents, not attacks.",
      "ACL": "Access Control List — per-user and per-group permissions on a single file, beyond the three-row model. See getfacl/setfacl.",
      "capability": "A single, separately-grantable privilege such as CAP_NET_BIND_SERVICE. Replaced setuid as the unit of privilege.",
      "capability bounding set": "The ceiling a process can ever regain. Root inside a container usually cannot exceed it, which is part of why rootless is stronger.",
      "file capabilities": "Capabilities stored in a binary's xattr, granted on exec. Lets an unprivileged user run a binary with one narrow privilege.",
      "setuid bit": "The u+s file bit making a binary run as its owner. The old, coarse model; still present on sudo and passwd.",
      "namespace": "A per-task copy of a kernel global: PIDs, mounts, network stack, hostname, IPC, UIDs. The foundation of containers.",
      "cgroup": "A kernel accounting group for tasks. Limits memory, CPU, PIDs and IO, and enforces them at allocation time.",
      "cgroup v2 / unified hierarchy": "The single modern cgroup tree (memory.max, cpu.max, pids.max) versus v1's separate per-controller trees.",
      "memory.high": "A soft memory limit: the kernel reclaims and throttles instead of killing. memory.max is the hard one.",
      "page cache accounting": "The kernel charges a cgroup for cached file data, which is why a container with a small RSS can still be OOM-killed.",
      "seccomp": "A BPF filter restricting which syscalls a process may make. Docker ships a default profile that blocks ~44 syscalls.",
      "LSM": "Linux Security Module hook points. AppArmor is path-based, SELinux is label-based; both can deny an access DAC allowed.",
      "rootless container": "A container whose user namespace maps inside-root to an unprivileged host UID, so the host daemon is not trusted root.",
      "chroot": "Changing the apparent root directory. Not a security boundary — it is trivially escaped and shares every other namespace.",
      "user namespace": "The namespace that maps UIDs between parent and child. What makes rootless containers and safe NFS/overlay ownership possible."
    }
  });
})();