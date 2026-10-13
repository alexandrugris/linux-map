/* ch00 — Master map: how to read this thing */
(function () {
  LX.push({
    id: "map",
    title: "The whole machine on one screen",
    tagline: "Every box below is a chapter. Start anywhere; the arrows are the dependency order.",
    sections: [
      {
        type: "prose",
        h: "How to read this map",
        p: [
          "Most Linux explanations are layered like an onion and assume you already know which layer you are in. This one is organised by <strong>dependency</strong> instead: the left column is what physically exists, the middle is what runs on it, and the right is what modern infrastructure builds out of the middle. You cannot understand the right column by reading only the right column — a Kubernetes node is a Linux machine pretending to be a packet switch pretending to be a configuration management system.",
          "So the rule is simple: <strong>the left column is always true</strong>. Every abstraction on the right is an arrangement of things you already met in the left. A pod is a cgroup and a set of namespaces and an overlayfs mount and a netns with a veth in it. A “cluster” is a fleet of machines each running the left column, plus one HTTP API that everyone agrees to trust.",
          "The three questions this document keeps answering, in this order, are: <em>what is running</em> (kernel → processes → services), <em>what can touch it</em> (users → permissions → namespaces → cgroups), and <em>how does anything get from outside to inside</em> (sockets → DNS → netfilter → proxies → the process that finally does the work)."
        ]
      },
      {
        type: "diagram",
        h: "The map: physical machine → running services → orchestration",
        caption: "Read it left-to-right and top-to-bottom. The <b>left column</b> exists whether or not you installed anything. The <b>middle column</b> is ordinary userspace: processes, files, permissions, packages, sockets. The <b>right column</b> is what you build when one machine is not enough. Click any box to jump to its chapter.",
        svg: `
<svg viewBox="0 0 1100 720" role="img" aria-label="Three-column map of a Linux machine, userspace services, and container orchestration">
  <text class="t-title" x="30" y="30">1 · THE MACHINE</text>
  <text class="t-title" x="390" y="30">2 · WHAT RUNS ON IT</text>
  <text class="t-title" x="750" y="30">3 · WHAT YOU BUILD ON TOP</text>

  <!-- LEFT COLUMN -->
  <g class="jump" data-jump="boot">
    <rect class="box" x="30" y="46" width="320" height="70" rx="10"/>
    <text x="48" y="74" font-size="15">Hardware</text>
    <text class="t-xs" x="48" y="94">CPU cores · RAM · NVMe/virtio disk · NIC</text>
    <text class="t-xs" x="48" y="109">hypervisor, if it is a VPS</text>
  </g>
  <g class="jump" data-jump="boot">
    <rect class="box-w" x="30" y="132" width="320" height="78" rx="10"/>
    <text class="t-warn" x="48" y="160" font-size="15">Firmware + boot chain</text>
    <text class="t-xs" x="48" y="180">UEFI/BIOS → GRUB → kernel + initramfs</text>
    <text class="t-xs" x="48" y="198">everything above is inert until this runs</text>
  </g>
  <g class="jump" data-jump="kernel">
    <rect class="box-a" x="30" y="226" width="320" height="124" rx="10"/>
    <text class="t-accent" x="48" y="254" font-size="15">Kernel (ring 0)</text>
    <text class="t-sm" x="48" y="276">scheduler · memory manager</text>
    <text class="t-sm" x="48" y="296">VFS · network stack · drivers</text>
    <text class="t-sm" x="48" y="316">signals · cgroups · namespaces</text>
    <text class="t-xs" x="48" y="332">owns CPU, memory and devices. unprivileged,</text>
    <text class="t-xs" x="48" y="344">and it does not isolate itself from anyone</text>
  </g>
  <g class="jump" data-jump="systemd">
    <rect class="box-ok" x="30" y="354" width="320" height="70" rx="10"/>
    <text class="t-ok" x="48" y="382" font-size="15">init — systemd, PID 1</text>
    <text class="t-xs" x="48" y="402">the first process; starts and watches</text>
    <text class="t-xs" x="48" y="417">everything else, forever</text>
  </g>
  <g class="jump" data-jump="services">
    <rect class="box-v" x="30" y="440" width="320" height="70" rx="10"/>
    <text class="t-violet" x="48" y="468" font-size="15">Long-running services</text>
    <text class="t-xs" x="48" y="488">nginx · sshd · named · cron</text>
    <text class="t-xs" x="48" y="503">each one just a program with a socket</text>
  </g>
  <g class="jump" data-jump="storage">
    <rect class="box" x="30" y="526" width="320" height="70" rx="10"/>
    <text x="48" y="554" font-size="15">Storage underneath</text>
    <text class="t-xs" x="48" y="574">block devices → filesystem → mount</text>
    <text class="t-xs" x="48" y="589">one namespace, grafted from many disks</text>
  </g>
  <g class="jump" data-jump="security">
    <rect class="box-b" x="30" y="612" width="320" height="70" rx="10"/>
    <text class="t-bad" x="48" y="640" font-size="15">Trust boundary</text>
    <text class="t-xs" x="48" y="660">public interface · ssh · DNS · TLS</text>
    <text class="t-xs" x="48" y="675">where attacks actually arrive</text>
  </g>

  <!-- MIDDLE COLUMN -->
  <g class="jump" data-jump="processes">
    <rect class="box-a" x="390" y="46" width="320" height="70" rx="10"/>
    <text class="t-accent" x="408" y="74" font-size="15">Processes &amp; threads</text>
    <text class="t-xs" x="408" y="94">fork/exec · the process table · states</text>
    <text class="t-xs" x="408" y="109">signals · /proc · the thing systemd manages</text>
  </g>
  <g class="jump" data-jump="filesystem">
    <rect class="box" x="390" y="132" width="320" height="78" rx="10"/>
    <text x="408" y="160" font-size="15">Files &amp; paths</text>
    <text class="t-xs" x="408" y="180">one tree · /proc and /sys are synthesised</text>
    <text class="t-xs" x="408" y="198">fds · mounts · overlayfs · FUSE</text>
  </g>
  <g class="jump" data-jump="isolation">
    <rect class="box-v" x="390" y="226" width="320" height="112" rx="10"/>
    <text class="t-violet" x="408" y="254" font-size="15">Users &amp; isolation</text>
    <text class="t-sm" x="408" y="276">uid/gid · rwx bits · ACLs · capabilities</text>
    <text class="t-sm" x="408" y="296">namespaces (pid, mount, net, user, …)</text>
    <text class="t-sm" x="408" y="316">cgroups (memory, cpu, pids) · seccomp · LSM</text>
    <text class="t-xs" x="408" y="334">the layering that makes containers possible</text>
  </g>
  <g class="jump" data-jump="packaging">
    <rect class="box-ok" x="390" y="354" width="320" height="70" rx="10"/>
    <text class="t-ok" x="408" y="382" font-size="15">Packages &amp; repositories</text>
    <text class="t-xs" x="408" y="402">deb/rpm archives, maintainer scripts, GPG</text>
    <text class="t-xs" x="408" y="417">“a package is just files + metadata”</text>
  </g>
  <g class="jump" data-jump="build">
    <rect class="box" x="390" y="440" width="320" height="70" rx="10"/>
    <text x="408" y="468" font-size="15">Compiling &amp; linking</text>
    <text class="t-xs" x="408" y="488">./configure → make → make install</text>
    <text class="t-xs" x="408" y="503">ld.so, RPATH, shared libraries</text>
  </g>
  <g class="jump" data-jump="networking">
    <rect class="box-w" x="390" y="526" width="320" height="156" rx="10"/>
    <text class="t-warn" x="408" y="554" font-size="15">Network stack</text>
    <text class="t-sm" x="408" y="576">sockets: the fd ↔ network boundary</text>
    <text class="t-sm" x="408" y="596">TCP state machine · routes · neighbours</text>
    <text class="t-sm" x="408" y="616">netfilter/nft: filter, NAT, conntrack</text>
    <text class="t-sm" x="408" y="636">veth · bridges · tun (WireGuard/Tailscale)</text>
    <text class="t-xs" x="408" y="658">every incoming packet crosses two things</text>
    <text class="t-xs" x="408" y="674">you control: the firewall, and the socket</text>
  </g>

  <!-- RIGHT COLUMN -->
  <g class="jump" data-jump="containers">
    <rect class="box-p" x="750" y="46" width="320" height="70" rx="10"/>
    <text class="t-bad" x="768" y="74" font-size="15">OCI image &amp; rootfs</text>
    <text class="t-xs" x="768" y="94">content-addressed layers, digests</text>
    <text class="t-xs" x="768" y="109">unpacked into overlayfs snapshots</text>
  </g>
  <g class="jump" data-jump="containers">
    <rect class="box-p" x="750" y="132" width="320" height="78" rx="10"/>
    <text class="t-bad" x="768" y="160" font-size="15">containerd + runc</text>
    <text class="t-xs" x="768" y="180">content store · snapshotter · shim</text>
    <text class="t-xs" x="768" y="198">the OCI runtime spec = your container’s config</text>
  </g>
  <g class="jump" data-jump="containers">
    <rect class="box-p" x="750" y="226" width="320" height="78" rx="10"/>
    <text class="t-bad" x="768" y="254" font-size="15">CRI — the kubelet contract</text>
    <text class="t-xs" x="768" y="274">RunPodSandbox() = the pod’s namespaces</text>
    <text class="t-xs" x="768" y="292">CreateContainer() = one container in them</text>
  </g>
  <g class="jump" data-jump="kubernetes">
    <rect class="box-a" x="750" y="320" width="320" height="104" rx="10"/>
    <text class="t-accent" x="768" y="348" font-size="15">kubelet — the node agent</text>
    <text class="t-sm" x="768" y="370">watches the API, syncs pods to reality,</text>
    <text class="t-sm" x="768" y="390">runs CNI, streams logs, serves metrics</text>
    <text class="t-xs" x="768" y="412">converges: desired state vs actual state</text>
  </g>
  <g class="jump" data-jump="kubernetes">
    <rect class="box-v" x="750" y="440" width="320" height="116" rx="10"/>
    <text class="t-violet" x="768" y="468" font-size="15">Control plane</text>
    <text class="t-sm" x="768" y="490">etcd — the only source of truth</text>
    <text class="t-sm" x="768" y="510">apiserver — every write is validated here</text>
    <text class="t-sm" x="768" y="530">scheduler — picks a node per pod</text>
    <text class="t-sm" x="768" y="550">controllers — make reality match intent</text>
  </g>
  <g class="jump" data-jump="kubernetes">
    <rect class="box-ok" x="750" y="572" width="320" height="110" rx="10"/>
    <text class="t-ok" x="768" y="600" font-size="15">Workloads</text>
    <text class="t-sm" x="768" y="622">Deployment → ReplicaSet → Pod</text>
    <text class="t-sm" x="768" y="642">Service (ClusterIP, DNS) · Ingress</text>
    <text class="t-sm" x="768" y="662">PVC → CSI → a volume on some node</text>
    <text class="t-xs" x="768" y="678">all of it is a loop, not a pipeline</text>
  </g>

  <!-- cross-column arrows -->
  <path class="ln dash" d="M350,282 L386,282" marker-end="url(#lm-arrow)"/>
  <path class="ln dash" d="M710,700 C 730,700 730,660 746,660" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="700" y="712" font-size="13">the cluster moves the boxes on the left</text>
  <path class="ln dash" d="M350,475 L386,604" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="252" y="520" font-size="13">packaged as images</text>
</svg>`
      },
      {
        type: "prose",
        h: "The one request you can trace all the way down",
        p: [
          "Abstract diagrams stop helping somewhere. The fastest way to make Linux concrete is to follow one byte of traffic from a browser to the RAM of a process and back, naming every component it touched. Do that once and the whole map stops being a list of nouns.",
          "On your own server that path is short and entirely local: a packet arrives, netfilter decides whether it survives, a listening socket claims it, an nginx worker wakes up, opens a file, and the page cache or disk gives it bytes. There is no magic in the middle — just a few thousand lines of C that you have now seen from both sides in chapters 02, 09 and 11.",
          "In Kubernetes the same path gains a translation layer that rewrites addresses as it descends, and a control plane that did that rewriting for you. Once you can see that a <code>Service</code> is just a set of netfilter rules installed by a program watching an API, the “magic” of cluster networking collapses into chapter 09's material again."
        ]
      },
      {
        type: "diagram",
        h: "One HTTP request, top to bottom",
        caption: "Top: your VPS, no containers. Bottom: the same request through a Kubernetes Service. <b>The path is identical in kind at every step — packet, firewall, socket, process, file.</b> Kubernetes only adds address translation and a control loop that keeps it honest.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="Packet path on a plain server and through a Kubernetes service">
  <text class="t-ok" x="30" y="30" font-size="17">A · plain nginx on a server</text>
  <text class="t-violet" x="30" y="366" font-size="17">B · the same request into a Kubernetes Service</text>

  <!-- ===== LANE A ===== -->
  <g class="jump" data-jump="networking">
    <rect class="box" x="30" y="46" width="140" height="52" rx="9"/>
    <text class="t-sm" x="100" y="70" text-anchor="middle">browser</text>
    <text class="t-xs" x="100" y="86" text-anchor="middle">builds the packet</text>
  </g>
  <path class="ln-a" d="M170,72 L226,72" marker-end="url(#lm-arrow-accent)"/>
  <g class="jump" data-jump="dns">
    <rect class="box-v" x="226" y="46" width="150" height="52" rx="9"/>
    <text class="t-sm" x="301" y="70" text-anchor="middle">DNS</text>
    <text class="t-xs" x="301" y="86" text-anchor="middle">name → IP (ch 10)</text>
  </g>
  <path class="ln-a" d="M376,72 L432,72" marker-end="url(#lm-arrow-accent)"/>
  <g class="jump" data-jump="networking">
    <rect class="box-w" x="432" y="46" width="170" height="52" rx="9"/>
    <text class="t-sm" x="517" y="70" text-anchor="middle">NIC → netfilter</text>
    <text class="t-xs" x="517" y="86" text-anchor="middle">ufw: accept? (ch 9,15)</text>
  </g>
  <path class="ln-a" d="M602,72 L658,72" marker-end="url(#lm-arrow-accent)"/>
  <g class="jump" data-jump="services">
    <rect class="box-ok" x="658" y="46" width="170" height="52" rx="9"/>
    <text class="t-sm" x="743" y="70" text-anchor="middle">listen socket</text>
    <text class="t-xs" x="743" y="86" text-anchor="middle">nginx :443, fd 6</text>
  </g>
  <path class="ln-a" d="M828,72 L884,72" marker-end="url(#lm-arrow-accent)"/>
  <g class="jump" data-jump="processes">
    <rect class="box-a" x="884" y="46" width="186" height="52" rx="9"/>
    <text class="t-sm" x="977" y="70" text-anchor="middle">worker wakes</text>
    <text class="t-xs" x="977" y="86" text-anchor="middle">epoll → read() (ch 3)</text>
  </g>

  <path class="ln-a" d="M977,98 L977,132" marker-end="url(#lm-arrow-accent)"/>
  <g class="jump" data-jump="filesystem">
    <rect class="box" x="884" y="132" width="186" height="70" rx="9"/>
    <text class="t-sm" x="977" y="156" text-anchor="middle">openat("/var/www/…")</text>
    <text class="t-xs" x="977" y="174" text-anchor="middle">permission bits · LSM</text>
    <text class="t-xs" x="977" y="190" text-anchor="middle">page cache hit? else disk</text>
  </g>

  <rect class="box-a" x="30" y="132" width="700" height="70" rx="9"/>
  <text class="t-accent" x="48" y="156" font-size="14.5">the whole journey is: netfilter → socket → process → file → process → socket → netfilter → NIC</text>
  <text class="t-xs" x="48" y="176">every step is a place where the request can be refused (RST), dropped silently (DROP), or queued forever (D state).</text>
  <text class="t-xs" x="48" y="192">“connection refused” = reached the host, nothing listening. “timed out” = dropped somewhere on the way. That one sentence is most of network debugging.</text>

  <!-- ===== LANE B ===== -->
  <g class="jump" data-jump="networking">
    <rect class="box" x="30" y="382" width="140" height="52" rx="9"/>
    <text class="t-sm" x="100" y="406" text-anchor="middle">client</text>
    <text class="t-xs" x="100" y="422" text-anchor="middle">to the Service IP</text>
  </g>
  <path class="ln-v" d="M170,408 L226,408" marker-end="url(#lm-arrow)"/>
  <g class="jump" data-jump="networking">
    <rect class="box-w" x="226" y="382" width="190" height="52" rx="9"/>
    <text class="t-sm" x="321" y="406" text-anchor="middle">kube-proxy rules</text>
    <text class="t-xs" x="321" y="422" text-anchor="middle">iptables/nft DNAT, conntrack</text>
  </g>
  <path class="ln-v" d="M416,408 L472,408" marker-end="url(#lm-arrow)"/>
  <g class="jump" data-jump="kubernetes">
    <rect class="box-v" x="472" y="382" width="190" height="52" rx="9"/>
    <text class="t-sm" x="567" y="406" text-anchor="middle">veth → pod netns</text>
    <text class="t-xs" x="567" y="422" text-anchor="middle">CNI installed this bridge</text>
  </g>
  <path class="ln-v" d="M662,408 L718,408" marker-end="url(#lm-arrow)"/>
  <g class="jump" data-jump="containers">
    <rect class="box-p" x="718" y="382" width="170" height="52" rx="9"/>
    <text class="t-sm" x="803" y="406" text-anchor="middle">container</text>
    <text class="t-xs" x="803" y="422" text-anchor="middle">its own pid/mount/net ns</text>
  </g>
  <path class="ln-v" d="M888,408 L944,408" marker-end="url(#lm-arrow)"/>
  <g class="jump" data-jump="containers">
    <rect class="box-p" x="944" y="382" width="126" height="52" rx="9"/>
    <text class="t-sm" x="1007" y="406" text-anchor="middle">runc</text>
    <text class="t-xs" x="1007" y="422" text-anchor="middle">namespace + cgroup</text>
  </g>

  <rect class="box-v" x="30" y="462" width="700" height="88" rx="9"/>
  <text class="t-violet" x="48" y="486" font-size="14.5">Who put those rules there? kube-proxy, watching the API server for Service and Endpoint objects.</text>
  <text class="t-xs" x="48" y="506">So the packet path is data; the rule table is control-plane state. Delete kube-proxy and the ClusterIP is a dead address.</text>
  <text class="t-xs" x="48" y="524">A Cilium/eBPF dataplane replaces the iptables rules with programs attached to the TC/XDP hooks — faster, but still just</text>
  <text class="t-xs" x="48" y="542">“where a packet should go next”, expressed in a different place.</text>

  <path class="ln-a" d="M567,246 L567,340" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="580" y="300" font-size="13">control plane writes the desired state ↓</text>
  <g class="jump" data-jump="kubernetes">
    <rect class="box-a" x="472" y="340" width="190" height="42" rx="9"/>
    <text class="t-sm" x="567" y="366" text-anchor="middle">apiserver + etcd</text>
  </g>

  <rect class="box-ok" x="30" y="586" width="1040" height="92" rx="9"/>
  <text class="t-ok" x="48" y="612" font-size="15">The invariant worth memorising</text>
  <text class="t-sm" x="48" y="634">Kubernetes is a convergent loop: someone declares intent into etcd, controllers compare intent to observed reality, and daemons on every node</text>
  <text class="t-sm" x="48" y="652">make reality match — then do it again, forever. Nothing in a cluster is “set”; things are only ever being reconciled. When a system is healthy, the</text>
  <text class="t-sm" x="48" y="670">reconcile loops are idle and boring. When it is unhealthy, they are all busy at once — which is exactly what the kubectl describe output is showing you.</text>
</svg>`
      },
      {
        type: "cards",
        items: [
          { title: "I want to understand the machine", tag: "2 HOURS", tone: "", text: "01 boot → 02 kernel → 03 processes → 06 systemd. This is the spine, and nothing later will make sense without it." },
          { title: "I run production and things break", tag: "THE PRACTICAL PATH", tone: "violet", text: "06 systemd → 11 services → 09 networking → 10 DNS → 16 troubleshooting. Then keep 17 cheatsheet open in a tab forever." },
          { title: "I work on the k8s cluster", tag: "THE STACK PATH", tone: "ok", text: "04 isolation → 13 containers → 14 kubernetes. The first chapter is the one people skip and regret: a Pod is namespaces and cgroups, nothing else." },
          { title: "I am securing a box", tag: "THE ADVERSARY PATH", tone: "bad", text: "15 security, with 02 kernel (the trust boundary) and 09 networking (where packets arrive) as background reading." },
          { title: "I want to install software I cannot find", tag: "THE PACKAGING PATH", tone: "warn", text: "07 packaging → 08 build → 05 filesystem. Understand where files land and why <code>PATH</code> is lying to you." },
          { title: "I want to read the source", tag: "THE BRIDGE", tone: "pink", text: "02 kernel is written as a map of <code>linux/</code>. Once that is in your head, <code>fs/</code>, <code>net/</code> and <code>mm/</code> stop being directories and start being places you already understand." }
        ]
      },
      {
        type: "prose",
        h: "Three ideas that carry the whole document",
        p: [
          "<strong>Everything is a file, and a file is a kernel object, not bytes on a disk.</strong> A socket, a pipe, a device, a process's memory map and a directory all have one thing in common: an entry in a table, reachable by an integer, obeying permission rules. That is why <code>/dev/null</code>, <code>/proc/1/fd/3</code> and <code>docker0</code> can all be moved around by the same tools and all obey the same DAC rules — and why \"is it a file?\" is the first question to ask about almost any Linux abstraction.",
          "<strong>Isolation is layering, and each layer costs you something.</strong> Ownership (uid/gid) stops accidents. Capabilities stop privilege escalation inside a program. Namespaces hide what a process can see. cgroups bound what it can consume. seccomp and LSM restrict what syscalls and paths it may use at all. No single layer is a sandbox; a container is the specific combination of all of them. Understanding which layer a problem lives in is the difference between chmodding a file and finding out you actually needed a <code>seccomp</code> profile.",
          "<strong>Declarative intent, imperative reconciliation.</strong> systemd, Kubernetes, Ansible and package managers all express the same idea: <em>describe the state you want, then run a loop until it is true</em>. The loops are cheap, the description is where the bugs live. This is why \"it worked yesterday\" is usually \"something reconciled back to the declaration after I changed reality\", and why the interesting bugs are always about <em>where the two disagree</em>."
        ],
        noteTitle: "How to spot a place where this document has drifted",
        note: "Everything is stated against Debian/Ubuntu + systemd and checked against a real Ubuntu 18.04 VPS. When a modern kernel differs, it is called out inline — the two that matter most are <b>cgroups v1 vs v2</b> (different paths, different limits, different accounting) and <b>iptables-legacy vs nftables</b> (same intent, different binary, silently different rulesets). If you are on Fedora, Arch, Alpine or macOS, treat those two as the first things to re-check.",
        noteKind: "fact"
      }
    ],
    takeaways: [
      "Read the map in dependency order, not topic order: machine → userspace → orchestration.",
      "A Pod is namespaces + cgroups + an overlayfs rootfs + a netns with a veth in it. There is no fifth thing.",
      "A Kubernetes <strong>Service</strong> is a netfilter rule installed by a program watching an API server. Trace any cluster network problem back to that sentence.",
      "“Connection refused” means you reached the host and nothing was listening; “timed out” means a packet was dropped somewhere. Different bugs, different chapters.",
      "Every system in this document is a reconciliation loop. Bugs live in the gap between declared intent and observed reality — never in the loop itself."
    ],
    glossary: {
      "reconciler": "A control loop that compares declared intent with observed reality and acts to close the gap. systemd, Kubernetes controllers and kubelet are all reconcilers.",
      "control plane": "The part of a distributed system that decides what should happen: Kubernetes' apiserver, scheduler and controllers, as opposed to the nodes that do it.",
      "dataplane": "The path data actually takes. In Kubernetes this is kube-proxy's rules or a CNI's eBPF programs, as opposed to the control plane that configured them."
    }
  });
})();