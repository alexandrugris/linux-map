/* ch09 — Networking: from your process to the wire */
(function () {
  LX.push({
    id: "networking",
    title: "The network stack, from your process to the wire",
    tagline: "A packet is a kernel data structure with a socket attached to it. Everything else — routes, neighbours, firewalls, NAT — is bookkeeping that decides where that structure goes.",
    sections: [
      {
        type: "prose",
        h: "What the kernel owns and what the NIC does",
        p: [
          "The single most useful thing to hold onto: <strong>almost nothing about networking happens in hardware that you can see</strong>. The NIC owns two things — a MAC address, and the ability to put bytes on a physical medium. That is genuinely all. It does not know what TCP is, what an IP address is, or whether you are running nginx. It has a ring of transmit buffers, a ring of receive buffers, an interrupt line, and a state machine that says <em>“I have these 1.5 KB and I would like more”</em>.",
          "Everything else — parsing Ethernet frames, ARP, IP routing, TCP sequence numbers, retransmission timers, congestion windows, socket buffers, firewall hooks, NAT translation — is <strong>kernel code</strong> running on your CPU. When someone says \"the network is slow\", the first question is which of the two halves is slow, and on a modern VPS the answer is almost always the kernel half, because the NIC half is doing nothing but moving frames between a queue and a cable.",
          "This split is also why drivers matter more than the wire protocol. The interface driver programs the NIC's DMA rings, maps them into kernel memory, and hands the NIC two doorbells: <code>rx-&gt;prod</code> and <code>tx-&gt;prod</code>. The NIC raises an interrupt when a ring fills or empties; the kernel's NAPI layer then drains up to a budget of packets per poll, because processing packets in interrupt context for an unbounded amount of time would starve everything else on the box. Under load you will see the softirq time attributed to the driver rather than to any process, which is how you recognise a NIC that needs interrupt coalescing, a larger ring, or simply less traffic."
        ],
        noteTitle: "What is actually on this box",
        note: "A 2&nbsp;GB VPS with virtio NICs. <code>ethtool -i eth0</code> shows <code>virtio_net</code>; there is no physical MAC switch, no VLAN tagging by hardware, and no offload worth trusting. Everything that would be “in silicon” on a bare-metal box is in <code>virtio_net</code> and the host hypervisor instead. That is why <code>ethtool -k</code> on a VPS often shows checksum offload as <em>on</em> while actually costing CPU: the hypervisor may not honour it.",
        noteKind: "fact"
      },
      {
        type: "diagram",
        h: "The whole path, once, in order",
        caption: "A <code>write()</code> from nginx worker to a client socket crosses five boundaries: the libc wrapper, the socket layer (which owns the TCP state machine and buffers), the routing decision, the netfilter hook chain, and finally the driver that rings the NIC doorbell. Diagnosing a network problem means finding which of these five it stopped in — <code>ss</code> tells you about 2, <code>ip route get</code> about 3, <code>iptables -L</code> about 4, <code>ethtool</code>/<code>dmesg</code> about 5.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="Packet path from application write syscall down through socket layer, routing, netfilter, driver, NIC and onto the wire">
  <!-- stage labels -->
  <text class="t-xs" x="30" y="34">USER SPACE</text>
  <text class="t-xs" x="30" y="330">KERNEL — socket layer</text>
  <text class="t-xs" x="30" y="470">KERNEL — policy &amp; forwarding</text>
  <text class="t-xs" x="30" y="600">HARDWARE</text>
  <line class="ln dash" x1="30" y1="44" x2="1070" y2="44" stroke-dasharray="4 6"/>
  <line class="ln dash" x1="30" y1="340" x2="1070" y2="340" stroke-dasharray="4 6"/>
  <line class="ln dash" x1="30" y1="480" x2="1070" y2="480" stroke-dasharray="4 6"/>
  <line class="ln dash" x1="30" y1="610" x2="1070" y2="610" stroke-dasharray="4 6"/>

  <!-- user space -->
  <rect class="box-a" x="150" y="60" width="200" height="70" rx="10"/>
  <text class="t-accent" x="168" y="88" font-size="15">nginx worker</text>
  <text class="t-sm" x="168" y="110">write(fd, buf, n)</text>

  <rect class="box-v" x="450" y="60" width="200" height="70" rx="10"/>
  <text class="t-violet" x="468" y="88" font-size="15">libc</text>
  <text class="t-sm" x="468" y="110">send() / sendto()</text>

  <rect class="box" x="750" y="60" width="200" height="70" rx="10"/>
  <text x="768" y="88" font-size="15">syscall gate</text>
  <text class="t-sm" x="768" y="110">copy_from_user()</text>
  <text class="t-xs" x="768" y="126">EFAULT if the pointer is bad</text>

  <!-- socket layer -->
  <rect class="box-p" x="120" y="140" width="240" height="110" rx="10"/>
  <text class="t-bad" x="138" y="168" font-size="15">socket layer</text>
  <text class="t-sm" x="138" y="190">struct sock lives here</text>
  <text class="t-sm" x="138" y="208">send buffer · recv buffer</text>
  <text class="t-sm" x="138" y="226">TCP state machine</text>
  <text class="t-xs" x="138" y="244">/proc/net/tcp shows one row per socket</text>

  <rect class="box-p" x="420" y="140" width="240" height="110" rx="10"/>
  <text class="t-bad" x="438" y="168" font-size="15">TCP / UDP / ICMP</text>
  <text class="t-sm" x="438" y="190">seq numbers, ACKs</text>
  <text class="t-sm" x="438" y="208">retransmit timers</text>
  <text class="t-sm" x="438" y="226">congestion control (cwnd)</text>
  <text class="t-xs" x="438" y="244">Reno, CUBIC, BBR in newer kernels</text>

  <rect class="box-p" x="720" y="140" width="240" height="110" rx="10"/>
  <text class="t-bad" x="738" y="168" font-size="15">IP layer</text>
  <text class="t-sm" x="738" y="190">source address selection</text>
  <text class="t-sm" x="738" y="208">fragmentation, reassembly</text>
  <text class="t-sm" x="738" y="226">hop limit / TTL</text>
  <text class="t-xs" x="738" y="244">IPv6 has no router fragments, ever</text>

  <!-- forwarding -->
  <rect class="box-w" x="120" y="360" width="240" height="100" rx="10"/>
  <text class="t-warn" x="138" y="388" font-size="15">route lookup</text>
  <text class="t-sm" x="138" y="410">longest prefix match</text>
  <text class="t-sm" x="138" y="428">over local, main, default</text>
  <text class="t-xs" x="138" y="450">answer: iface + gateway + src</text>

  <rect class="box-w" x="420" y="360" width="240" height="100" rx="10"/>
  <text class="t-warn" x="438" y="388" font-size="15">neighbour table</text>
  <text class="t-sm" x="438" y="410">ARP / NDP cache</text>
  <text class="t-sm" x="438" y="428">IP address to MAC address</text>
  <text class="t-xs" x="438" y="450">missing entry: kernel sends ARP</text>

  <rect class="box-w" x="720" y="360" width="240" height="100" rx="10"/>
  <text class="t-warn" x="738" y="388" font-size="15">netfilter hooks</text>
  <text class="t-sm" x="738" y="410">PREROUTING → OUTPUT</text>
  <text class="t-sm" x="738" y="428">conntrack, NAT, filter</text>
  <text class="t-xs" x="738" y="450">iptables rules live on these edges</text>

  <!-- hardware -->
  <rect class="box-ok" x="300" y="500" width="480" height="90" rx="10"/>
  <text class="t-ok" x="318" y="528" font-size="15">driver: virtio_net</text>
  <text class="t-sm" x="318" y="550">builds skb, fills descriptor ring, rings the doorbell</text>
  <text class="t-sm" x="318" y="568">RX: NAPI poll drains the ring up to a budget</text>
  <text class="t-xs" x="318" y="584">netif_receive_skb() walks back up the stack for every incoming frame</text>

  <rect class="box" x="300" y="620" width="480" height="58" rx="10"/>
  <text x="318" y="646" font-size="15">NIC — DMA rings, a MAC, and a cable</text>
  <text class="t-sm" x="318" y="666">everything above this line is software running on your CPU</text>

  <!-- arrows -->
  <path class="ln-a" d="M250,130 L200,140" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M550,130 L540,140" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M850,130 L840,140" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-b" d="M240,250 L200,360" marker-end="url(#lm-arrow-bad)"/>
  <path class="ln-w" d="M540,250 L540,360" marker-end="url(#lm-arrow-warn)"/>
  <path class="ln-w" d="M840,250 L840,360" marker-end="url(#lm-arrow-warn)"/>
  <path class="ln-ok" d="M200,460 L420,500" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M540,460 L540,500" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-ok" d="M840,460 L660,500" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-a" d="M540,590 L540,620" marker-end="url(#lm-arrow-accent)"/>

  <text class="t-bad" x="940" y="300" font-size="13.5">RX runs this</text>
  <text class="t-bad" x="940" y="318" font-size="13.5">diagram bottom-up.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Interface, address, route, neighbour",
        p: [
          "Four kernel data structures, and every forwarding decision consults them in that order. An <strong>interface</strong> is a <code>struct net_device</code> plus an rx queue; it has no address of its own, only a MAC and a name. An <strong>address</strong> is attached to an interface as a separate object, because an interface can have as many as you like and they can be added and removed while sockets are open. A <strong>route</strong> is a prefix plus an action, stored in a table and a priority-ordered list of <em>routing rules</em>. A <strong>neighbour</strong> entry caches the link-layer address for an IP address on the same segment.",
          "The important correction: <strong>a route is not a path</strong>. It is a lookup result — \"for anything starting with this prefix, send it out this interface, optionally via this next hop, preferring this source address\". There is no per-flow state in the routing table, no bandwidth reservation, no path pinning. Traffic is not bound to a link after the first packet; the very next packet can take a different route because a higher-priority prefix appeared, because an interface went down, or because a cache was flushed. <code>traceroute</code> showing one path and your traffic actually taking another is not a bug, it is the design.",
          "Source address selection is the part people forget: <code>ip route get 1.1.1.1</code> prints not just where the packet goes but <code>src 10.0.0.4</code> — which local address the kernel will stamp on it. That chosen address is then bound to the TCP socket, so a connection to the same destination is pinned to the same source IP for its entire lifetime even if the route changes underneath it. When traffic exits via a different interface than you expected, this is the first thing to check, and it is also why a host with several IPs (a VPS with an extra IPv4, an interface with both a public and a Tailscale address) has genuinely different behaviour depending on which address the client used."
        ],
        noteTitle: "Policy routing is what makes multi-homed hosts work",
        note: "<code>ip rule</code> shows numbered rules — <code>0: from all lookup local</code>, then the <code>main</code> table, then a pile of <code>32766</code>-style custom ones. A <code>lookup 100</code> that only matches <code>from 100.64.0.0/10</code> is how Tailscale forces its own traffic out <code>tailscale0</code> regardless of what the main table says. <code>ip route show table all</code> is the honest command; <code>ip route show</code> only shows <code>main</code> and will lie to you on a box with policy routing.",
        noteKind: "tip"
      },
      {
        type: "diagram",
        h: "How the kernel picks a route",
        caption: "Longest-prefix match, evaluated over the union of tables selected by <code>ip rule</code>. The <code>local</code> table is consulted first and is why a packet to the machine's own address never leaves the machine — it is answered by the INPUT hook instead. Only when every rule fails to produce a route is the packet dropped with <code>ENETUNREACH</code>.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Flow chart of the kernel route lookup: rules, tables, longest prefix match, neighbour resolution and transmission">
  <rect class="box-a" x="420" y="24" width="260" height="52" rx="9"/>
  <text class="t-accent" x="550" y="48" font-size="15" text-anchor="middle">packet: dst 1.1.1.1</text>
  <text class="t-xs" x="550" y="66" text-anchor="middle">from a socket, with src 10.0.0.4</text>

  <path class="ln-a" d="M550,76 L550,110" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="360" y="110" width="380" height="56" rx="9"/>
  <text class="t-violet" x="550" y="134" font-size="15" text-anchor="middle">ip rule — in numeric order</text>
  <text class="t-xs" x="550" y="152" text-anchor="middle">0: from all lookup local · 32765: main · 1000+: policy</text>

  <path class="ln-a" d="M550,166 L550,200" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box" x="360" y="200" width="380" height="56" rx="9"/>
  <text x="550" y="224" font-size="15" text-anchor="middle">longest prefix match inside that table</text>
  <text class="t-xs" x="550" y="242" text-anchor="middle">10.0.0.0/8 beats 10.1.0.0/16 beats default</text>

  <path class="ln-a" d="M550,256 L250,300" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M550,256 L850,300" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-ok" x="300" y="282" font-size="13.5">match found → route</text>
  <text class="t-bad" x="800" y="282" font-size="13.5">no match anywhere → ENETUNREACH</text>

  <rect class="box-ok" x="70" y="300" width="360" height="66" rx="9"/>
  <text class="t-ok" x="86" y="324" font-size="14.5">local table matched</text>
  <text class="t-sm" x="86" y="344">dst is ours → INPUT hook, no NIC</text>
  <text class="t-xs" x="86" y="360">this is why curl to the public IP works from inside</text>

  <rect class="box-w" x="670" y="300" width="360" height="66" rx="9"/>
  <text class="t-warn" x="686" y="324" font-size="14.5">main table matched</text>
  <text class="t-sm" x="686" y="344">via 192.0.2.1 dev eth0 src 10.0.0.4</text>
  <text class="t-xs" x="686" y="360">pref, metric, scope all came with it</text>

  <path class="ln-w" d="M850,366 L850,400" marker-end="url(#lm-arrow-warn)"/>

  <rect class="box-p" x="670" y="400" width="360" height="96" rx="10"/>
  <text class="t-bad" x="686" y="424" font-size="14.5">is the next hop on-link?</text>
  <text class="t-sm" x="686" y="446">scope link → use the neighbour table</text>
  <text class="t-sm" x="686" y="464">scope global → always send to the gateway</text>
  <text class="t-xs" x="686" y="486">ip route get 1.1.1.1 shows the scope</text>

  <path class="ln-p" d="M850,496 L850,520" marker-end="url(#lm-arrow-bad)"/>
  <path class="ln-b" d="M760,520 L520,520" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-b" x="70" y="490" width="450" height="86" rx="10"/>
  <text class="t-bad" x="86" y="514" font-size="14.5">neighbour entry present → build the Ethernet header</text>
  <text class="t-sm" x="86" y="536">absent → kernel queues the packet and sends an ARP request</text>
  <text class="t-xs" x="86" y="556">the packet you see queued while ARP is unanswered is normal, not lost</text>
  <text class="t-xs" x="86" y="572">ip neigh show  ·  failed entries show FAILED and 0.0.0.0 as the MAC</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Read the network configuration the way the kernel has it, not the way you think you configured it",
        code:
`# -b (brief) is one line per interface; -4 because a dual-stack box doubles everything
ip -br -4 addr
# lo      UNKNOWN  127.0.0.1/8 ::1/128
# eth0    UP       10.0.0.4/24
# tailscale0 UP    100.101.102.103/32

# the route the kernel would actually use, with the source address it would pick
ip route get 1.1.1.1
# 1.1.1.1 via 192.0.2.1 dev eth0 src 10.0.0.4 uid 1000
#     cache
ip route get 100.101.102.103        # Tailscale peer: goes out tailscale0, no gateway
ip route get 8.8.8.8 from 10.0.0.4   # force a source and watch it fail from any other iface

# every table, not just main — the command that tells the truth on a policy-routed host
ip rule show
ip route show table all
ip route show table main proto kernel   # kernel-installed: addresses, broadcast, multicast
ip route show table all | grep -E "tailscale|100\." 

# neighbours: the ARP cache, and what it looks like when it is broken
ip -4 neigh show
# 192.0.2.1 dev eth0 lladdr 52:54:00:12:34:56 REACHABLE
# 203.0.113.9 dev eth0 lladdr 52:54:00:12:34:56 STALE        <- STALE is fine, it revalidates lazily
# 203.0.113.9 dev eth0  FAILED                               <- this is the one that breaks things
ip neigh flush dev eth0                 # the single most useful "try that again" command in networking

# link-level counters: RX/TX errors and drops are hardware or driver, not TCP
ip -s link show dev eth0
ethtool eth0 ; ethtool -i eth0 ; ethtool -S eth0 | head -40
# carrier changes, CRC errors, missed frames -> physical or virtual wire problem

# addresses on an interface, added permanently and correctly
ip addr add 192.0.2.9/24 dev eth0
# then make it survive reboot:
#   netplan (18.04+): /etc/netplan/01-netcfg.yaml, netplan apply
#   ifupdown:         /etc/network/interfaces + ip addr add line, then ifup eth0
# a bare "ip addr add" is lost on reboot; that is not a bug, it never persisted anywhere`
      },
      {
        type: "prose",
        h: "The socket: where a file descriptor becomes a network conversation",
        p: [
          "A socket is the single abstraction that unifies \"file\" and \"connection\". <code>socket(AF_INET, SOCK_STREAM, 0)</code> asks the kernel for a new <code>struct sock</code> and returns a file descriptor pointing at it. From that moment it <em>is</em> a file: <code>read()</code>, <code>write()</code>, <code>select()</code>, <code>poll()</code>, <code>fcntl()</code> and <code>close()</code> all work on it. <code>/proc/&lt;pid&gt;/fd/</code> shows it as <code>socket:[12345]</code>, and <code>/proc/net/tcp</code> lists the other end of that same inode. This is why <code>ls -l /proc/$(pgrep nginx | head -1)/fd</code> and <code>ss -p</code> answer the same question from two directions, and why you can pass a connected socket over a Unix domain socket with <code>SCM_RIGHTS</code> — it is a file descriptor, and descriptors are what you send.",
          "There are three ways a program can wait, and the difference is the whole reason event-driven servers exist. <strong>Blocking</strong>: <code>recv()</code> parks the thread in an interruptible sleep until data or EOF arrives, then returns. One thread per connection — simple, correct, and it costs roughly 8&nbsp;MB of virtual stack plus a kernel task per connection. <strong>Non-blocking</strong>: <code>O_NONBLOCK</code> makes every syscall return immediately with <code>EAGAIN</code> if it cannot complete. Useless on its own, because then you are spinning. <strong>Ready-notification</strong>: <code>epoll_wait()</code> parks no thread per connection — the kernel keeps one interest list per epoll instance and one ready list, and wakes you with every descriptor that has work. libuv, Node, Go's runtime, nginx's event module and <code>curl</code>'s multi interface are all epoll (or <code>select</code>/<code>poll</code>/<code>io_uring</code>) in different clothing.",
          "The detail that surprises people: with thousands of connections, <code>select()</code> is O(n) per call because it copies and scans the whole fd set on every wait, and its <code>FD_SETSIZE</code> cap is 1024 by default. <code>epoll</code> is O(active) because the ready list is maintained by the kernel as state changes — adding a descriptor is a pointer into a list, not a rescan. <code>io_uring</code> goes further and moves the whole async submission model into shared rings between kernel and user space. None of this is “modern”; <code>epoll</code> has been in Linux since 2.6, and it is why nginx with <code>worker_processes 4</code> can hold 30,000 connections on a 2&nbsp;GB box without a thread per client."
        ],
        noteTitle: "Why an event loop exists, in one sentence",
        note: "Because the expensive resource is not the CPU — it is the <em>connection</em>. Each connection costs a kernel socket, two buffer allocations, an entry in conntrack, an fd, and a <code>struct file</code>. Threads would add a task and a stack on top of all that; epoll lets one thread multiplex thousands of them. Any daemon that can hold more connections than it has cores needs this.",
        noteKind: "tip"
      },
      {
        type: "diagram",
        h: "Blocking vs epoll: two ways to wait for a thousand sockets",
        caption: "On the left, one thread per connection: 1000 threads, 1000 kernel tasks, 1000 stacks, and 1000 wakeups when a single client sends data. On the right, one thread and one <code>epoll</code> ready list — the kernel appends the descriptor to the ready list at the moment state changes, so the wakeup carries exactly the work that exists. The right-hand column is why nginx can hold 30k connections on 2&nbsp;GB while still finishing requests in microseconds.",
        svg: `
<svg viewBox="0 0 1100 500" role="img" aria-label="Side by side comparison of thread-per-connection blocking IO and a single-threaded epoll event loop">
  <text class="t-title" x="30" y="34">BLOCKING — one thread per connection</text>
  <text class="t-title" x="590" y="34">EPOLL — one thread, many connections</text>

  <rect class="box-w" x="30" y="48" width="500" height="420" rx="12"/>

  <rect class="box-a" x="50" y="66" width="200" height="34" rx="7"/>
  <text class="t-accent" x="66" y="88" font-size="14">main thread</text>
  <text class="t-xs" x="66" y="102">accept() → spawn</text>

  <g>
  <rect class="box" x="50" y="112" width="215" height="38" rx="7"/>
  <text class="t-sm" x="64" y="128">thread 2 · fd 7</text><text class="t-xs" x="64" y="143">blocked in recv()</text>
  <rect class="box" x="50" y="158" width="215" height="38" rx="7"/>
  <text class="t-sm" x="64" y="174">thread 3 · fd 8</text><text class="t-xs" x="64" y="189">blocked in recv()</text>
  <rect class="box" x="50" y="204" width="215" height="38" rx="7"/>
  <text class="t-sm" x="64" y="220">thread 4 · fd 9</text><text class="t-xs" x="64" y="235">blocked in recv()</text>
  <rect class="box" x="50" y="250" width="215" height="38" rx="7"/>
  <text class="t-sm" x="64" y="266">thread 5 · fd 10</text><text class="t-xs" x="64" y="281">blocked in recv()</text>
  <rect class="box" x="50" y="296" width="215" height="38" rx="7"/>
  <text class="t-sm" x="64" y="312">… 999 more</text><text class="t-xs" x="64" y="327">each ~8 MB stack</text>
  </g>

  <path class="ln-a" d="M250,132 L300,150" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M250,178 L300,150" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-bad" x="306" y="150" font-size="13.5">one client sends data →</text>
  <text class="t-bad" x="306" y="166" font-size="13.5">scheduler wakes 1 thread,</text>
  <text class="t-bad" x="306" y="182" font-size="13.5">context-switches on the</text>
  <text class="t-bad" x="306" y="198" font-size="13.5">whole group anyway</text>
  <text class="t-xs" x="306" y="222">ulimit -n per process, 1000 tasks,</text>
  <text class="t-xs" x="306" y="238">scheduler latency scales with n</text>

  <rect class="box-p" x="590" y="48" width="480" height="420" rx="12"/>

  <rect class="box-a" x="610" y="66" width="440" height="34" rx="7"/>
  <text class="t-accent" x="626" y="88" font-size="14">one thread</text>
  <text class="t-xs" x="626" y="102">epoll_wait() → returns the descriptors that changed state</text>

  <rect class="box-v" x="610" y="116" width="440" height="96" rx="9"/>
  <text class="t-violet" x="626" y="138" font-size="14.5">kernel interest list</text>
  <text class="t-sm" x="626" y="158">fd 7 · fd 8 · fd 9 … one entry per socket, registered once</text>
  <text class="t-sm" x="626" y="176">state change → kernel moves the fd to the ready list</text>
  <text class="t-xs" x="626" y="198">cost is O(active), not O(connections) — the whole point</text>

  <rect class="box-ok" x="610" y="228" width="440" height="86" rx="9"/>
  <text class="t-ok" x="626" y="250" font-size="14.5">kernel ready list</text>
  <text class="t-sm" x="626" y="270">fd 9 ready: data available</text>
  <text class="t-sm" x="626" y="288">fd 14 ready: connection closed</text>
  <text class="t-xs" x="626" y="308">built at the moment of the event, not scanned at wait time</text>

  <path class="ln-a" d="M830,212 L830,228" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-ok" d="M610,300 L610,380" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box" x="610" y="386" width="440" height="62" rx="9"/>
  <text class="t-sm" x="626" y="408">handle exactly those two, then loop</text>
  <text class="t-xs" x="626" y="428">accept() is level-triggered by default; use EPOLLET only if you</text>
  <text class="t-xs" x="626" y="442">are certain you drain each fd — nginx does, and it is not free of bugs</text>
</svg>`
      },
      {
        type: "prose",
        h: "TCP is a kernel state machine you can inspect",
        p: [
          "TCP lives in the kernel, not in your process. Your program hands bytes to a socket and stops caring; the kernel keeps the send buffer, assigns sequence numbers, tracks the peer's advertised window, runs the retransmission timers, grows and shrinks the congestion window, and reassembles the byte stream in order before your <code>read()</code> ever sees it. If the peer's packets are delayed, reordered or duplicated, the kernel hides it entirely. That is the contract, and it is why \"my application wrote 400 bytes and the peer got 900\" is never a TCP bug.",
          "The three-way handshake exists to establish one thing: that both sides agree on the initial sequence numbers. Each SYN carries an ISN; the reply ACKs it. <code>ss</code> shows the local and remote ends of that conversation as two sequence-number spaces. Sequence numbers are per-direction 32-bit counters, and everything about reliability is built on them — a receiver ACKs the highest contiguous byte it has, duplicates are discarded below that point, and a gap triggers a fast retransmit after three duplicate ACKs. The retransmission timer is the backstop: RTO starts near 200&nbsp;ms and is tracked per connection with smoothing so it adapts to real delay, which is why a link with 80&nbsp;ms RTT and jitter retransmits far less than one with 5&nbsp;ms RTT and the same loss rate.",
          "The four states you will actually argue about are the ones below the listener. <code>SYN_SENT</code> on a <em>client</em> is normal and transient. <code>SYN_SENT</code> or <code>SYN_RECV</code> in bulk on a <em>server</em> means your SYN backlog is overflowing — connections are arriving faster than the accept path drains them, and the fix is a larger <code>somaxconn</code>, a faster accept loop, or SYN cookies, not a bigger box. <code>CLOSE_WAIT</code> is an application bug: the peer sent FIN, the kernel moved the socket there, and your program never called <code>close()</code>. Hundreds of <code>CLOSE_WAIT</code> sockets mean a leak in a proxy or a daemon that lost track of a connection. <code>TIME_WAIT</code> is the cost of correctness: whoever closes first must keep the tuple around for 2×MSL (60&nbsp;s on Linux) so late duplicates cannot be accepted by a new connection with the same ports. On a *client* that is fine. On a *server* seeing thousands of them, you are closing connections you did not need to close, or you are missing keepalive."
        ]
      },
      {
        type: "diagram",
        h: "One connection, both directions, all four states",
        caption: "Client opens: SYN → SYN/ACK → ACK, then <code>ESTABLISHED</code> on both sides. Data flows with sequence numbers advancing independently per direction — the client's ISN is <em>not</em> related to the server's, which is why there are two number spaces. Client closes first: FIN → ACK puts the client in <code>FIN_WAIT_1</code>, the server's ACK moves it to <code>FIN_WAIT_2</code> while the server sits in <code>CLOSE_WAIT</code> until it closes, then <code>LAST_ACK</code> → <code>CLOSE</code>. The client lingers in <code>TIME_WAIT</code> for 60&nbsp;s. If the <em>server</em> closes first, it is the server that pays the <code>TIME_WAIT</code> cost instead.",
        svg: `
<svg viewBox="0 0 1100 540" role="img" aria-label="TCP three-way handshake and four-way close with sequence numbers and both sides state timelines">
  <rect class="box-a" x="60" y="20" width="200" height="40" rx="8"/>
  <text class="t-accent" x="160" y="45" font-size="15" text-anchor="middle">client (nginx worker)</text>
  <rect class="box-ok" x="840" y="20" width="200" height="40" rx="8"/>
  <text class="t-ok" x="940" y="45" font-size="15" text-anchor="middle">server (your VPS :443)</text>

  <line class="ln dash" x1="160" y1="60" x2="160" y2="500"/>
  <line class="ln dash" x1="940" y1="60" x2="940" y2="500"/>

  <path class="ln-a" d="M170,90 L930,90" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="550" y="82" font-size="14" text-anchor="middle">1. SYN   seq=1000  win=64240   MSS=1460</text>
  <text class="t-bad" x="170" y="108" font-size="13">SYN_SENT</text>

  <path class="ln-ok" d="M930,130 L170,130" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="550" y="122" font-size="14" text-anchor="middle">2. SYN+ACK  seq=5000 ack=1001  win=65535</text>
  <text class="t-bad" x="800" y="148" font-size="13">SYN_RECV on the server while this is in flight</text>

  <path class="ln-a" d="M170,170 L930,170" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="550" y="162" font-size="14" text-anchor="middle">3. ACK   ack=5001  →  both sides now ESTABLISHED</text>

  <path class="ln-a" d="M170,220 L930,220" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="550" y="212" font-size="14" text-anchor="middle">GET / HTTP/1.1   seq=1001 len=512  →  ack=1001+512</text>

  <path class="ln-ok" d="M930,270 L170,270" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-sm" x="550" y="262" font-size="14" text-anchor="middle">HTTP/1.1 200  len=8140   seq=5001 …  ack=1513</text>

  <line class="ln dash" x1="60" y1="300" x2="1040" y2="300" stroke-dasharray="4 6"/>
  <text class="t-warn" x="60" y="318" font-size="14">close: whoever sends the first FIN pays TIME_WAIT. Keeping the socket alive makes the peer close instead.</text>

  <path class="ln-b" d="M170,340 L930,340" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="550" y="332" font-size="14" text-anchor="middle">4. FIN  seq=1513  →  client: FIN_WAIT_1</text>

  <path class="ln-ok" d="M930,376 L170,376" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="550" y="368" font-size="14" text-anchor="middle">5. ACK        →  client: FIN_WAIT_2   server: CLOSE_WAIT</text>

  <path class="ln-b" d="M930,412 L170,412" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="550" y="404" font-size="14" text-anchor="middle">6. FIN  seq=9141  →  server: LAST_ACK → CLOSE after ack</text>

  <path class="ln-ok" d="M170,448 L930,448" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="550" y="440" font-size="14" text-anchor="middle">7. ACK  →  client: TIME_WAIT for 60 s, then CLOSED</text>

  <!-- state timelines -->
  <text class="t-accent" x="60" y="480" font-size="13">SYN_SENT → ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSED</text>
  <text class="t-ok" x="60" y="502" font-size="13">LISTEN → SYN_RECV → ESTABLISHED → CLOSE_WAIT → LAST_ACK → CLOSED</text>
  <text class="t-xs" x="60" y="524">ss -tan state time-wait   ·   ss -tan state close-wait   ·   the counts tell you which side is broken</text>
</svg>`
      },
      {
        type: "table",
        cols: ["State", "Who sits in it", "What it actually means when you see many"],
        rows: [
          ["<code>LISTEN</code>", "server", "The socket exists and has a backlog. Normal. If it is missing, nothing is bound — check <code>ss -ltnp</code> for the process."],
          ["<code>ESTAB</code>", "both", "Working connections. <code>ss -s</code> prints this count first; compare it to your app's own connection log to find leaks."],
          ["<code>SYN_SENT</code>", "client", "Normal for a moment. Thousands of them means connect() calls are piling up — DNS, a full backlog, or an unreachable next hop."],
          ["<code>SYN_RECV</code>", "server", "Handshake half-done. Bulk here means the accept queue is full: raise <code>net.core.somaxconn</code> and <code>net.ipv4.tcp_max_syn_backlog</code>, or enable <code>tcp_syncookies</code>."],
          ["<code>FIN_WAIT_1/2</code>", "the closer", "Waiting for the peer's FIN, or for the final ACK. Lingering means the peer is not finishing — usually a dead network, not a local fault."],
          ["<code>CLOSE_WAIT</code>", "the receiver", "<strong>Application leak.</strong> The peer closed and your code never called close(). This is a bug in the server, never in the network."],
          ["<code>LAST_ACK</code>", "the closer", "Short-lived by design. Piling up means the server cannot send its final ACK."],
          ["<code>TIME_WAIT</code>", "the closer", "2×MSL = 60&nbsp;s on Linux, holding the 4-tuple so late duplicates die. On a client: harmless. On a server: you are the one closing, and you probably should not be."]
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "ss filters worth memorising — these answer most questions in one line",
        code:
`# the three-line triage: total, by state, listening sockets with owners
ss -s
ss -tan state time-wait | wc -l
ss -ltnp                       # -l listen -n numeric -p process (needs root for the process column)

# TIME_WAIT from a server: are you the one closing?
ss -tan state time-wait | awk '{print $4}' | cut -d: -f2 | sort | uniq -c | sort -rn | head
# a big pile on :443 means nginx is closing first on every response → configure keepalive_timeout

# CLOSE_WAIT is always an application bug, never a network one
ss -tan state close-wait | wc -l
ss -tanp state close-wait | head           # shows which process owns the leak

# what the kernel knows about one live connection: rtt, cwnd, retransmits
ss -tin dst 1.1.1.1
#   cubic wscale:7,7 rto:204 rtt:23.456/12.5 ato:40 mss:1448 pmtu:1500 rcvmss:...
#   retrans:0/12 cwnd:10 bytes_sent:20481 bytes_acked:20481 delivery_rate ...

# counters, not connections — the fastest way to see retransmission storms
nstat -az | grep -E "TcpRetransSegs|IpInReceives|TcpExtListenDrops|TcpExtSyncookies"
netstat -s | grep -iE "retransmit|overflow" 
# TcpExtListenDrops climbing = accept queue full, the server is the bottleneck

# UDP: no state machine, so look at queues instead
ss -ulnp                          # every UDP socket and its owner
ss -uan | grep 41641             # tailscaled's WireGuard endpoint
# Recv-Q for UDP sockets in the diag line is packets waiting for the application

# which sockets a process holds — the modern lsof, no dependency
ss -ltnp 'sport = :443'
ss -tanp | grep nginx | head -20
for f in /proc/$(pgrep -o nginx)/fd/*; do readlink $f; done | sort | uniq -c`
      },
      {
        type: "prose",
        h: "UDP and the trade you are making",
        p: [
          "UDP is the IP protocol with the reliability features removed: eight bytes of header, a checksum, no handshake, no sequence numbers, no retransmission, no ordering, no congestion control, no connection state. A UDP send is a hand-off into a receive queue, and if nobody is listening or the queue is full, the kernel either drops it or returns <code>ECONNREFUSED</code> from a subsequent read on a connected socket — which is how ICMP port-unreachable becomes visible to an application.",
          "What you get in exchange is a much better fit for three real workloads. <strong>DNS</strong>: one query, one answer, latency dominates, and a retransmitted query is usually worse than a fresh one. <strong>Real-time media</strong>: a retransmitted video frame is worthless if the next one arrives 30&nbsp;ms later, so forward error correction and playout buffers beat TCP's retransmit queue. <strong>WireGuard and QUIC</strong>: they run their own reliability and congestion control over UDP, because putting both in user space is strictly more flexible than patching a kernel state machine — that choice is the whole reason QUIC exists.",
          "The cost is that <em>you</em> must handle everything UDP does not: reordering, duplication, loss, authentication and amplification control. On a public-facing UDP service this is a real security surface — a few bytes of spoofed source address produce a megabyte of reply, which is how DNS reflection and UDP memcache amplification work. If you write UDP servers, rate-limit by source and never trust a source address you have not authenticated. For everything else, use TCP and let the kernel's two decades of hard-won congestion control do the work."
        ]
      },
      {
        type: "diagram",
        h: "netfilter: the five gates every packet meets",
        caption: "netfilter is a set of hooks placed at fixed points in the packet path, not a rule engine. Rules live in <em>tables</em> attached to those hooks, and each table is walked in order — <code>filter</code> then <code>mangle</code> then <code>nat</code> then <code>security</code>, which is why the same packet number can match a rule in one table and not another. Hooks marked <code>*nat</code> are consulted <em>only</em> for the first packet of a connection; everything after comes from conntrack. That asymmetry is the single most important fact on this page.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Netfilter hook chain PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING with the tables attached to each hook and conntrack lookup shown">
  <!-- incoming -->
  <rect class="box-ok" x="30" y="24" width="150" height="44" rx="8"/>
  <text class="t-ok" x="105" y="51" font-size="14" text-anchor="middle">wire (eth0)</text>
  <path class="ln-a" d="M180,46 L230,46" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="205" y="38" font-size="13">in</text>

  <!-- PREROUTING -->
  <rect class="box-p" x="230" y="24" width="290" height="58" rx="9"/>
  <text class="t-bad" x="246" y="46" font-size="15">PREROUTING *nat</text>
  <text class="t-xs" x="246" y="66">mangle · nat(DNAT) · filter? no — filter is INPUT/FORWARD</text>

  <path class="ln-a" d="M520,46 L570,46" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M570,46 L570,130" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M570,46 L570,290" marker-end="url(#lm-arrow-accent)"/>

  <!-- routing decision -->
  <rect class="box-w" x="470" y="160" width="200" height="100" rx="9"/>
  <text class="t-warn" x="570" y="186" font-size="15" text-anchor="middle">is dst me?</text>
  <text class="t-sm" x="570" y="208" text-anchor="middle">route lookup happened</text>
  <text class="t-sm" x="570" y="226" text-anchor="middle">between PREROUTING</text>
  <text class="t-sm" x="570" y="244" text-anchor="middle">and INPUT/FORWARD</text>

  <!-- INPUT -->
  <rect class="box-p" x="230" y="130" width="240" height="58" rx="9"/>
  <text class="t-bad" x="246" y="152" font-size="15">INPUT</text>
  <text class="t-xs" x="246" y="172">filter · security · mangle(in)</text>

  <!-- FORWARD -->
  <rect class="box-p" x="620" y="290" width="240" height="58" rx="9"/>
  <text class="t-bad" x="636" y="312" font-size="15">FORWARD</text>
  <text class="t-xs" x="636" y="332">filter · security · mangle</text>

  <!-- decision from routing -->
  <path class="ln-v" d="M670,260 L700,290" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="676" y="278" font-size="13">no — forward it</text>

  <!-- local -->
  <rect class="box-a" x="180" y="130" width="0" height="0"/>
  <path class="ln-a" d="M470,159 L120,159" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="30" y="136" width="90" height="46" rx="8"/>
  <text class="t-accent" x="75" y="156" font-size="13" text-anchor="middle">yes →</text>
  <text class="t-accent" x="75" y="174" font-size="13" text-anchor="middle">socket</text>

  <!-- OUTPUT -->
  <rect class="box-p" x="620" y="130" width="240" height="58" rx="9"/>
  <text class="t-bad" x="636" y="152" font-size="15">OUTPUT</text>
  <text class="t-xs" x="636" y="172">filter · nat(SNAT) · mangle(out)</text>

  <path class="ln-a" d="M860,159 L960,159" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="960" y="136" width="110" height="46" rx="8"/>
  <text class="t-accent" x="1015" y="164" font-size="13" text-anchor="middle">locally</text>
  <text class="t-accent" x="1015" y="180" font-size="13" text-anchor="middle">generated</text>

  <!-- POSTROUTING -->
  <path class="ln-a" d="M740,348 L740,400" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-p" x="620" y="400" width="240" height="58" rx="9"/>
  <text class="t-bad" x="636" y="422" font-size="15">POSTROUTING *nat</text>
  <text class="t-xs" x="636" y="442">filter (rarely used) · mangle</text>

  <path class="ln-a" d="M860,429 L960,429" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-ok" x="960" y="412" width="110" height="34" rx="8"/>
  <text class="t-ok" x="1015" y="434" font-size="13" text-anchor="middle">wire (eth0)</text>

  <!-- local loop -->
  <path class="ln-ok" d="M740,188 L740,400" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="750" y="300" font-size="13">locally generated,</text>
  <text class="t-ok" x="750" y="316" font-size="13">dest is not us →</text>
  <text class="t-ok" x="750" y="332" font-size="13">skips INPUT</text>

  <!-- conntrack -->
  <rect class="box-v" x="230" y="490" width="700" height="110" rx="10"/>
  <text class="t-violet" x="248" y="516" font-size="15">conntrack — the state machine netfilter shares with TCP</text>
  <text class="t-sm" x="248" y="538">Every packet is looked up in a hash table keyed by (proto, src ip, src port, dst ip, dst port).</text>
  <text class="t-sm" x="248" y="558">Found = ESTABLISHED. New = INSERT into a NEW state and run only the *nat tables.</text>
  <text class="t-xs" x="248" y="580">This is why a rule with "-m state --state INVALID,NEW" drops the second packet of a UDP flow, and why the table filling up silently drops everything.</text>
  <text class="t-xs" x="248" y="596">cat /proc/net/nf_conntrack  ·  conntrack -L  ·  sysctl net.netfilter.nf_conntrack_max  ·  conntrack -E for events</text>

  <path class="ln-v" d="M375,490 L375,82" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
  <path class="ln-v" d="M740,490 L740,458" marker-end="url(#lm-arrow-bad)" stroke-dasharray="4 4"/>
</svg>`
      },
      {
        type: "prose",
        h: "Conntrack, and why your stateless rule is not working",
        p: [
          "Every netfilter decision that involves <code>NEW</code>/<code>RELATED</code> state requires the kernel to remember the flow. That memory is conntrack: one entry per direction per connection, keyed by the 5-tuple, holding the NAT translations and a timeout. It is a hash table with a fixed ceiling (<code>net.netfilter.nf_conntrack_max</code>, commonly 65,536 on 4.15 and 262,144 on newer kernels), and it costs roughly 300 bytes per entry. On a busy gateway the table filling is the single most common cause of \"the firewall randomly eats my traffic\": when the table is full, new entries are not created, the packet is treated as untracked, and your first rule — typically <code>ACCEPT RELATED,ESTABLISHED</code> — no longer matches.",
          "This is why <code>-m state</code> / <code>-m conntrack</code> exists at all. A rule like <code>-A INPUT -p tcp --dport 22 -j ACCEPT</code> without state works for inbound connections but leaves the return path broken for UDP and for protocols where the reply comes from a different source port. The stateful pattern — accept <code>RELATED,ESTABLISHED</code> on the input path and <code>NEW</code> only where you expect new flows — is not a convenience, it is what makes bidirectional conversation possible with a small rule set. And it is why a rule of the form <code>-p tcp --sport 80 -j ACCEPT</code> \"does not work\": by the time the reply arrives, the tuple is ESTABLISHED, not NEW.",
          "The relatedness rules are subtler than the state names suggest. <code>RELATED</code> is decided by helper modules in <code>/lib/udp_mtu.so</code>-style plugins — FTP's data channel and ICMP errors are the classic cases. <code>INVALID</code> means the kernel could not match the packet to any existing flow <em>and</em> it looked wrong: a fragment whose first piece was never seen, a stray ACK, or a spoofed source. Dropping <code>INVALID</code> early is cheap and correct, and it is the rule you should place before anything else."
        ],
        noteTitle: "Tuning conntrack without breaking anything",
        note: "Two sysctls and one knob: <code>net.netfilter.nf_conntrack_max</code> (raise it, then keep <code>hashsize</code> proportional — it cannot be changed after boot without reloading the module), <code>net.netfilter.nf_conntrack_tcp_timeout_time_wait</code> (shorten from 120&nbsp;s to ~30&nbsp;s on servers where you never <em>accept</em> connections and always originate them — this is the TIME_WAIT mitigation that actually works), and <code>nf_conntrack_helper=0</code> if you do not need FTP/SIP helpers.",
        noteKind: "warn"
      },
      {
        type: "prose",
        h: "The nftables rewrite, and how two rule sets coexist silently",
        p: [
          "iptables was a userspace tool generating kernel data structures. Each table, chain and rule was an opaque blob registered with <code>xtables</code>, and the only way to read your own configuration back was to remember it. The kernel grew a second, better interface in 3.13 — nftables — with real named objects, maps, sets, atomic whole-ruleset replacement and expressions instead of extension modules. nftables is what <code>nft</code> talks to. <code>iptables</code>, <code>ip6tables</code>, <code>ebtables</code> and <code>arptables</code> were reimplemented as thin translators: <code>iptables-nft</code> compiles your iptables syntax into an nftables ruleset, while <code>iptables-legacy</code> keeps writing the old <code>xtables</code> blobs.",
          "This is the trap. Both backends are compiled in, and they are <strong>completely separate rule stores that both consult</strong>. On this box — Ubuntu 18.04.6, kernel 4.15, iptables 1.6.1 — <code>update-alternatives</code> points <code>/usr/sbin/iptables</code> at one of them, and <code>ufw</code> hard-codes <code>iptables</code> too. If you ever install or switch to <code>iptables-nft</code> (a Docker or Kubernetes install can do this as a dependency resolution accident) and then edit rules with <code>iptables -A</code> expecting them to appear in <code>nft list ruleset</code>, or run <code>iptables -L</code> and see only your ufw rules while your <code>nft list ruleset</code> shows an entirely different set, you have hit the classic disagreement. The two stores are applied in a fixed order and the <em>first</em> verdict wins, so a permissive legacy rule can shadow a strict nftables one and nothing will warn you.",
          "Saying which backend you are on is now a mandatory first step in any firewall debugging. <code>update-alternatives --display iptables</code> shows the current link and every candidate; <code>iptables -V</code> prints <code>nf_tables</code> or <code>legacy</code> in the version string. If a rule you added is not taking effect, check that second one before anything else. On modern systems the sane move is to convert once to nftables and never mix: <code>iptables-save &gt; backup.rules</code> for the record, <code>nft flush ruleset</code>, then port the policy deliberately — and remember that Docker, ufw and fail2ban all have to be pointed at the same backend or you will spend an evening wondering which store is live."
        ],
        noteKind: "fact",
        noteTitle: "Where nftables is genuinely better",
        note: "Sets and maps. <code>ipset</code> before nftables meant maintaining a parallel userspace list and pushing it in from cron; in nftables a named set is a kernel object that thousands of rules reference, so blocking 50,000 IPs costs one rule. Atomicity is the other one: <code>nft -f file</code> replaces the entire ruleset in one transaction, so there is no window where a half-applied config leaves your host open. It is also about an order of magnitude cheaper per rule, which matters on a box with <code>iptables -L</code> taking seconds because a DHCP-less VPS picked up thousands of dynamic rules."
      },
      {
        type: "diagram",
        h: "Two rule stores, one packet path",
        caption: "The <code>iptables-legacy</code> store (populated by ufw, Docker, hand-written scripts) and the <code>iptables-nft</code> store are independent kernel objects, evaluated in a fixed order before the packet continues. A <code>DROP</code> in the legacy store ends the packet there; a later nftables <code>ACCEPT</code> never runs. This is why \"my rule is not taking effect\" is usually a backend mismatch rather than a logic error.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Two coexisting firewall backends, iptables-legacy and iptables-nft, both consulted for one incoming packet">
  <rect class="box-b" x="30" y="24" width="150" height="46" rx="8"/>
  <text class="t-bad" x="105" y="52" font-size="14" text-anchor="middle">incoming pkt</text>

  <rect class="box-v" x="240" y="24" width="760" height="46" rx="8"/>
  <text class="t-violet" x="620" y="52" font-size="14" text-anchor="middle">netfilter core — evaluates both stores in a fixed internal order</text>

  <path class="ln-a" d="M180,47 L238,47" marker-end="url(#lm-arrow-accent)"/>

  <!-- legacy store -->
  <rect class="box-w" x="240" y="110" width="350" height="180" rx="10"/>
  <text class="t-warn" x="258" y="136" font-size="15">iptables-legacy store (xtables blobs)</text>
  <text class="t-sm" x="258" y="158">INPUT / FORWARD / OUTPUT chains</text>
  <text class="t-sm" x="258" y="176">written by: ufw, docker, hand scripts</text>
  <text class="t-xs" x="258" y="198">iptables -V  →  v1.6.1 legacy</text>
  <text class="t-xs" x="258" y="216">iptables -L -n -v  reads this store only</text>
  <line class="ln dash" x1="258" y1="228" x2="572" y2="228" stroke-dasharray="4 4"/>
  <text class="t-sm" x="258" y="250">rules in order, first match wins:</text>
  <text class="t-xs" x="258" y="270">ACCEPT  tcp --dport 22</text>
  <text class="t-xs" x="258" y="286">DROP    all  (ufw default incoming)</text>
  <text class="t-bad" x="258" y="310">a DROP here ends the packet. Nothing</text>
  <text class="t-bad" x="258" y="326">in the nftables store gets a say.</text>

  <rect class="box-p" x="650" y="110" width="350" height="180" rx="10"/>
  <text class="t-accent" x="668" y="136" font-size="15">iptables-nft store (nftables ruleset)</text>
  <text class="t-sm" x="668" y="158">nftables chain with names, sets, maps</text>
  <text class="t-sm" x="668" y="176">written by: iptables-nft, nft, containerd/CNI</text>
  <text class="t-xs" x="668" y="198">nft list ruleset  reads this store only</text>
  <line class="ln dash" x1="668" y1="210" x2="982" y2="210" stroke-dasharray="4 4"/>
  <text class="t-sm" x="668" y="232">independent chain, evaluated after</text>
  <text class="t-xs" x="668" y="252">add rule inet filter input tcp dport 22 accept</text>
  <text class="t-xs" x="668" y="270">add rule inet filter input counter drop</text>
  <text class="t-xs" x="668" y="296">This is the one you edited with</text>
  <text class="t-xs" x="668" y="312">iptables-nft while ufw kept writing legacy.</text>

  <path class="ln-w" d="M620,70 L415,108" marker-end="url(#lm-arrow-warn)"/>
  <path class="ln-a" d="M620,70 L825,108" marker-end="url(#lm-arrow-accent)"/>

  <path class="ln-ok" d="M415,290 L415,340" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="240" y="340" width="350" height="40" rx="8"/>
  <text class="t-ok" x="415" y="366" font-size="14" text-anchor="middle">packet accepted → INPUT chain → socket</text>

  <path class="ln-b" d="M825,290 L825,340" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="650" y="340" width="350" height="40" rx="8"/>
  <text class="t-bad" x="825" y="366" font-size="14" text-anchor="middle">packet dropped here — silently, with no log line</text>

  <!-- how to tell -->
  <rect class="box" x="30" y="410" width="1040" height="130" rx="10"/>
  <text x="50" y="436" font-size="15">the three commands that settle it</text>
  <text class="t-sm" x="50" y="462">update-alternatives --display iptables    →  link /usr/sbin/iptables → /usr/sbin/iptables-legacy</text>
  <text class="t-sm" x="50" y="484">iptables -V                                 →  v1.6.1 legacy   or   v1.6.1 nf_tables</text>
  <text class="t-sm" x="50" y="506">nft list ruleset                            →  prints the nftables store; empty means nothing is in it</text>
  <text class="t-xs" x="50" y="528">On Ubuntu 18.04 the default is legacy, because that is what ufw 0.36 and Docker 18.06 call. Installing a package that</text>
  <text class="t-xs" x="50" y="542">requires iptables-nft can flip the alternative silently. Re-check after every apt install that pulls in networking libraries.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Reading the firewall without guessing, on a ufw box with the legacy backend",
        code:
`# ufw's own view — human-readable, and it tells you the backend it is driving
ufw status verbose
# Status: active
# To:                   Action      From
# 22/tcp                 ALLOW IN    Anywhere                   # keep ssh reachable
# 80/tcp                 ALLOW IN    Anywhere
# 443/tcp                ALLOW IN    Anywhere
# 100.64.0.0/10          ALLOW IN    Anywhere                   # Tailscale only
# 192.168.1.0/24         ALLOW IN    Anywhere                   # LAN → this box
# Default: deny (incoming), allow (outgoing), disabled (routed)

# what ufw actually generated. This is the truth; ufw status is a summary of it.
cat /etc/ufw/user.rules | grep -E "^###|^-A" | head -40
grep -rn "DOCKER" /etc/ufw/ | head          # is anything trying to integrate?

# the raw filter table, with packet counters — nonzero counts prove a rule is live
iptables -L -n -v --line-numbers | less
iptables -t nat -L -n -v
iptables -t mangle -L -n -v

# flush the counters, then watch which rules move. The fastest firewall diagnosis there is.
iptables -Z
watch -n1 "iptables -L -n -v | awk 'NR>2 && \\$1+0>0 {print \\$1, \\$2, \\$3, \\$8}'"

# is the nftables store empty (i.e. are we legacy-only)?
nft list ruleset | head -20 ; echo "ruleset bytes: $(nft list ruleset | wc -c)"

# port listening vs firewall: a DROP here still leaves a LISTEN socket
ss -ltnp
nc -vz -w3 127.0.0.1 80      # from localhost: PREROUTING never runs
nc -vz -w3 <public-ip> 80    # from outside: the real test
# if the second hangs instead of refusing, you have a DROP (not REJECT) — a REJECT
# answers immediately with "No route to host" / "Connection refused", which is
# why REJECT rules are better for admin experience and for scanning-time DoS`
      },
      {
        type: "prose",
        h: "NAT: address translation as a lookup table",
        p: [
          "NAT is not a “mode”; it is the <code>nat</code> table's first-packet-only rewriting of the 5-tuple, with the translation remembered in conntrack so every later packet can be reversed. Only connections whose first packet traverses a <code>*nat</code> hook get an entry, which is why NAT state is one-way in practice and why the DNAT on a forwarded packet must happen before the routing decision that follows it.",
          "There are three shapes you will meet. <strong>DNAT</strong> rewrites the destination: your public IP becomes an internal container address. This is a port mapping, and the mapping must be explicit because the kernel does not invent one — DNAT with no port sends traffic to the same port it arrived on, which is almost never what you wanted. <strong>SNAT</strong> rewrites the source to a specific address: the classic case is a mail server, where an outbound connection must originate from the IP that the destination's reverse DNS and SPF policy expect. <strong>MASQUERADE</strong> is SNAT that resolves the address at send time instead of storing it, which is why it survives an interface getting a new DHCP lease and why it costs a route lookup per packet. Use it on mobile or cloud interfaces where the address is not fixed; use SNAT when it is, because SNAT is cheaper and does not depend on a route existing.",
          "The port-mapping mental model is the one worth memorising, because it explains the entire class of \"my Docker service is not reachable\" bugs. Outbound, a container's connection is just a normal socket: the container picks an ephemeral source port, and with SNAT/masquerade the host rewrites the source to its own IP and port, so the reply comes back to the host and conntrack finds the right container. Inbound, there is no socket to guess from — the host received a packet addressed to <em>its</em> IP and port, so unless a DNAT rule exists for exactly that (protocol, IP, port), there is nothing to match. Every inbound service therefore needs one explicit mapping, and the exhaustion of the 16-bit port space plus the per-tuple NAT table is why large-scale inbound NAT needs a VIP or a real load balancer."
        ]
      },
      {
        type: "diagram",
        h: "Outbound masquerade and inbound DNAT, as conntrack sees them",
        caption: "Top: a container's outbound flow is rewritten on POSTROUTING, so the reply returns to the host and conntrack un-maps it. Bottom: an inbound packet to the host's public address hits no socket, so a DNAT rule in PREROUTING <code>*nat</code> must exist for exactly that protocol/port. If you forget the port, the packet continues to INPUT, matches no listener, and returns RST — the classic <code>curl: (7) Failed to connect</code> from outside while the service works fine on localhost.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Outbound SNAT and inbound DNAT translation shown with conntrack table entries">
  <text class="t-title" x="30" y="30">OUTBOUND — MASQUERADE (what Docker does automatically)</text>

  <rect class="box-a" x="40" y="48" width="200" height="58" rx="8"/>
  <text class="t-accent" x="140" y="72" font-size="14" text-anchor="middle">container 172.17.0.2</text>
  <text class="t-xs" x="140" y="92" text-anchor="middle">src 172.17.0.2:51820</text>
  <rect class="box-ok" x="450" y="48" width="200" height="58" rx="8"/>
  <text class="t-ok" x="550" y="72" font-size="14" text-anchor="middle">host 10.0.0.4 (eth0)</text>
  <text class="t-xs" x="550" y="92" text-anchor="middle">docker0 + MASQUERADE</text>
  <rect class="box" x="860" y="48" width="200" height="58" rx="8"/>
  <text x="960" y="72" font-size="14" text-anchor="middle">the internet</text>
  <text class="t-xs" x="960" y="92" text-anchor="middle">sees 10.0.0.4</text>

  <path class="ln-a" d="M240,77 L448,77" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M650,77 L858,77" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-bad" x="290" y="70" font-size="13">src rewritten on POSTROUTING</text>
  <text class="t-xs" x="290" y="128">conntrack:  172.17.0.2:51820 → 93.184.216.34:443</text>
  <text class="t-xs" x="290" y="146">             10.0.0.4:41234  ← 93.184.216.34:443</text>
  <text class="t-xs" x="290" y="168">MASQUERADE picks the address at send time (survives DHCP); SNAT stores a fixed one and is cheaper.</text>
  <text class="t-xs" x="290" y="186">requires net.ipv4.ip_forward=1 — otherwise the kernel answers "no route" and you never see it.</text>
  <path class="ln-ok" d="M858,105 L652,105" marker-end="url(#lm-arrow-ok)"/>

  <line class="ln" x1="30" y1="216" x2="1070" y2="216" stroke-dasharray="6 6"/>

  <text class="t-title" x="30" y="250">INBOUND — DNAT, and why the port must be explicit</text>

  <rect class="box" x="40" y="268" width="200" height="58" rx="8"/>
  <text x="140" y="292" font-size="14" text-anchor="middle">client</text>
  <text class="t-xs" x="140" y="312" text-anchor="middle">dst 93.184.216.34:8080</text>

  <path class="ln-a" d="M240,297 L448,297" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="450" y="268" width="230" height="96" rx="9"/>
  <text class="t-bad" x="466" y="292" font-size="14.5">PREROUTING *nat</text>
  <text class="t-xs" x="466" y="312">-A PREROUTING -p tcp --dport 8080</text>
  <text class="t-xs" x="466" y="330">   -j DNAT --to-destination</text>
  <text class="t-xs" x="466" y="348">   172.17.0.2:80</text>

  <path class="ln-a" d="M680,297 L758,297" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="760" y="268" width="300" height="96" rx="9"/>
  <text class="t-accent" x="776" y="292" font-size="14.5">container 172.17.0.2:80</text>
  <text class="t-sm" x="776" y="312">the connection never touched a socket</text>
  <text class="t-sm" x="776" y="330">on the host — the DNAT rule is what made</text>
  <text class="t-sm" x="776" y="348">it exist</text>

  <rect class="box-b" x="30" y="392" width="500" height="106" rx="9"/>
  <text class="t-bad" x="46" y="416" font-size="14.5">if the DNAT rule is missing or the port is wrong</text>
  <text class="t-sm" x="46" y="438">packet → INPUT → no listener on that host port → RST</text>
  <text class="t-sm" x="46" y="456">inside the container: works perfectly (curl localhost:80)</text>
  <text class="t-sm" x="46" y="474">outside: curl: (7) Failed to connect · ECONNREFUSED</text>
  <text class="t-xs" x="46" y="492">That asymmetry — fine locally, refused remotely — is the fingerprint of a missing NAT or firewall rule.</text>

  <rect class="box" x="550" y="392" width="520" height="106" rx="9"/>
  <text x="566" y="416" font-size="14.5">the rules that make forwarding work at all</text>
  <text class="t-xs" x="566" y="440">sysctl net.ipv4.ip_forward=1</text>
  <text class="t-xs" x="566" y="460">iptables -A FORWARD -o docker0 -j ACCEPT   (ufw does NOT do this for you)</text>
  <text class="t-xs" x="566" y="480">iptables -t nat -A POSTROUTING -s 172.17.0.0/16 ! -o docker0 -j MASQUERADE</text>
  <text class="t-xs" x="566" y="496">docker installs these itself, in the DOCKER-USER/DOCKER chains — another reason ufw + Docker surprise people.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Interfaces that are not physical: bridges, bonds, VLANs, VRFs and tunnels",
        p: [
          "A Linux interface is a <code>struct net_device</code>, and nothing about that structure requires hardware. Four virtual kinds matter operationally. A <strong>bridge</strong> (<code>br0</code>, <code>br-&lt;12 hex&gt;</code> per Docker network, <code>virbr0</code> from libvirt) is a software switch: it learns MAC addresses from the frames it sees and forwards between ports, learning <em>without</em> the interface having an IP. A <strong>bond</strong> (<code>bond0</code>, mode <code>802.3ad</code>/LACP for real switches, <code>active-backup</code> without) aggregates several NICs into one. A <strong>VLAN</strong> subinterface (<code>eth0.100</code>) tags frames with an 802.1Q header in software and requires a parent that can carry more than one VLAN — a trunk port on the switch, which is a managed-port concept a VPS does not have unless the provider explicitly gives you one. A <strong>tunnel</strong> (<code>tun0</code>, <code>wg0</code>, <code>tailscale0</code>) is a device whose “wire” is another IP connection.",
          "Two consequences bite in practice. First, <strong>bridged traffic may bypass iptables entirely</strong>: on kernel 4.15 a bridged frame traverses <code>FORWARD</code> only if <code>net.bridge.bridge-nf-call-iptables=1</code> (not the default). So a rule you wrote to block something on <code>br0</code> does nothing unless that sysctl is set — the default is the opposite of what the rule assumes. Second, <strong>VRFs are routing tables attached to interfaces</strong>: a <code>vrf</code> device with a table bound to it means every socket in a process that has entered that VRF (via <code>setns</code> or a cgroup v2 BPF program) looks up routes in that table only, while the host's own sockets use <code>main</code>. It is the cheapest real multi-tenancy available without network namespaces, and it is why a <code>vrf</code>-aware box needs <code>ip rule add l3mdev pref 1000</code> plus per-interface rules to keep VRF traffic out of <code>main</code>."
        ],
        noteTitle: "The interface zoo on a box with Docker, Tailscale and systemd-resolved",
        note: "<code>ip -br link</code> on this VPS shows <code>lo</code>, <code>eth0</code>, <code>docker0</code> (172.17.0.1/16) plus one <code>br-&lt;hex&gt;</code> per user-defined Docker network, and <code>tailscale0</code> (100.x/32). <code>lo</code> and <code>tailscale0</code> are tun devices; <code>docker0</code> and <code>br-*</code> are bridges. If you have ever run <code>bridge link</code> and seen a bridge with a hundred ports, that is one Docker network with a hundred containers, not a hundred network devices your host is bridging between.",
        noteKind: "fact"
      },
      {
        type: "diagram",
        h: "The interface zoo, and where traffic actually goes",
        caption: "Bridges forward frames without touching the routing table; tun devices carry IP inside IP, which is why <code>ss -t</code> shows ordinary TCP sockets on <code>tailscale0</code> with 100.x addresses while the outside world sees one UDP flow to port 41641. The numbered path is the classic “it works on localhost but not from the internet” chain: every arrow crossing a bridge is invisible to iptables unless <code>bridge-nf-call-iptables</code> is on.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Diagram of bridge, bond, vlan and tun interfaces with a docker network, tailscale overlay and host routing">
  <!-- host boundary -->
  <rect class="box" x="30" y="24" width="1040" height="500" rx="12"/>
  <text class="t-title" x="50" y="50">the host's network namespace</text>

  <!-- eth0 -->
  <rect class="box-ok" x="50" y="70" width="220" height="76" rx="9"/>
  <text class="t-ok" x="66" y="94" font-size="15">eth0</text>
  <text class="t-sm" x="66" y="114">10.0.0.4/24 · default route</text>
  <text class="t-xs" x="66" y="132">virtio_net driver · one MAC</text>
  <text class="t-xs" x="66" y="144">no hardware VLAN/trunk on a VPS</text>

  <!-- default route -->
  <path class="ln-a" d="M270,108 L380,108" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-sm" x="280" y="100" font-size="13">0.0.0.0/0 via</text>
  <text class="t-xs" x="280" y="128">192.0.2.1</text>

  <!-- gateway -->
  <rect class="box" x="382" y="70" width="180" height="76" rx="9"/>
  <text x="398" y="94" font-size="14.5">provider gateway</text>
  <text class="t-sm" x="398" y="114">L2: your ARP target</text>
  <text class="t-xs" x="398" y="132">everything not local stops here</text>

  <!-- bond -->
  <rect class="box-v" x="382" y="166" width="180" height="70" rx="9"/>
  <text class="t-violet" x="398" y="190" font-size="14.5">bond0 (optional)</text>
  <text class="t-sm" x="398" y="210">active-backup or 802.3ad</text>
  <text class="t-xs" x="398" y="228">needs a switch that agrees</text>

  <!-- vlan -->
  <rect class="box-v" x="382" y="256" width="180" height="70" rx="9"/>
  <text class="t-violet" x="398" y="280" font-size="14.5">eth0.100</text>
  <text class="t-sm" x="398" y="300">802.1Q tag, software</text>
  <text class="t-xs" x="398" y="318">parent must be a trunk port</text>

  <!-- docker0 -->
  <rect class="box-a" x="620" y="166" width="200" height="84" rx="9"/>
  <text class="t-accent" x="636" y="190" font-size="15">docker0</text>
  <text class="t-sm" x="636" y="210">172.17.0.1/16 · bridge</text>
  <text class="t-sm" x="636" y="228">a software switch</text>
  <text class="t-xs" x="636" y="244">MASQUERADE for egress</text>

  <rect class="box-a" x="620" y="266" width="200" height="84" rx="9"/>
  <text class="t-accent" x="636" y="290" font-size="15">br-4f2a9c1b3d07</text>
  <text class="t-sm" x="636" y="310">user-defined network</text>
  <text class="t-sm" x="636" y="328">per-Docker-network bridge</text>
  <text class="t-xs" x="636" y="344">embedded DNS at 127.0.0.11</text>

  <path class="ln-a" d="M270,120 L618,200" marker-end="url(#lm-arrow-accent)" stroke-dasharray="5 4"/>
  <path class="ln-a" d="M270,130 L618,300" marker-end="url(#lm-arrow-accent)" stroke-dasharray="5 4"/>
  <text class="t-warn" x="300" y="176" font-size="13">routed, hits FORWARD + nat</text>
  <text class="t-warn" x="300" y="192" font-size="13">ufw does not manage this</text>

  <!-- containers -->
  <rect class="box-b" x="866" y="166" width="184" height="84" rx="9"/>
  <text class="t-bad" x="882" y="190" font-size="14.5">container netns</text>
  <text class="t-sm" x="882" y="210">veth pair ends</text>
  <text class="t-xs" x="882" y="230">own routes, own loopback</text>
  <text class="t-xs" x="882" y="246">no IPv6 unless enabled</text>
  <path class="ln-a" d="M820,208 L864,208" marker-end="url(#lm-arrow-bad)"/>
  <path class="ln-a" d="M820,308 L864,240" marker-end="url(#lm-arrow-bad)"/>

  <!-- tailscale -->
  <rect class="box-p" x="620" y="386" width="200" height="90" rx="9"/>
  <text class="t-bad" x="636" y="410" font-size="15">tailscale0</text>
  <text class="t-sm" x="636" y="430">100.101.102.103/32</text>
  <text class="t-sm" x="636" y="448">tun device, CGNAT range</text>
  <text class="t-xs" x="636" y="466">MTU 1280 · UDP/41641 out</text>

  <rect class="box" x="866" y="386" width="184" height="90" rx="9"/>
  <text x="882" y="410" font-size="14.5">tailnet peers</text>
  <text class="t-sm" x="882" y="430">encrypted in-kernel</text>
  <text class="t-xs" x="882" y="450">no inbound port opened</text>
  <text class="t-xs" x="882" y="468">on your edge firewall</text>
  <path class="ln-ok" d="M820,431 L864,431" marker-end="url(#lm-arrow-ok)"/>

  <path class="ln-v" d="M560,108 L618,420" marker-end="url(#lm-arrow-warn)" stroke-dasharray="5 4"/>
  <text class="t-violet" x="500" y="300" font-size="13">ip rule 1000:</text>
  <text class="t-violet" x="500" y="316" font-size="13">from all lookup</text>
  <text class="t-violet" x="500" y="332" font-size="13">tailscale</text>

  <text class="t-bad" x="50" y="500" font-size="13">net.bridge.bridge-nf-call-iptables=0 (the default) → frames crossing a bridge never reach iptables FORWARD.</text>
</svg>`
      },
      {
        type: "prose",
        h: "WireGuard and Tailscale: a network interface that is just cryptography",
        p: [
          "WireGuard is deliberately tiny — about 4,000 lines against OpenVPN's ~100,000 — and it lives in the kernel as the <code>wireguard</code> module, or in user space as <code>wireguard-go</code>. Its API is a <code>tun</code> device: the kernel routes packets into <code>wg0</code> as if they came from a wire, and the driver encrypts them, wraps them in UDP and sends them to the peer's endpoint. On the far side the reverse happens. From the routing stack's point of view this is indistinguishable from a physical link, which is why a WireGuard peer behaves exactly like a neighbour on a subnet.",
          "The property that matters operationally: <strong>there is no listening port</strong>. Outbound, the initiator sends a UDP packet to the endpoint and remembers it; the reply is a stateful flow behind the same ephemeral socket. Nothing on your edge firewall needs a hole, and the service you actually run over it — SSH — is bound to a Tailscale address, not to <code>0.0.0.0</code>.",
          "And here is the subtlety that surprises people: <strong>the SSH session is not invisible to <code>ss -t</code>, it is simply not on the interface you expected</strong>. <code>ss -tanp | grep sshd</code> shows <code>100.101.102.103:22 → 100.101.104.5:44120</code>, because the kernel decrypted it before TCP ever saw it. What is invisible is the <em>public</em> identity: on the wire there is one UDP flow to the coordination server's endpoint, and the address you SSH'd from is nowhere in the packet. That is the security property worth naming — a Tailscale-only sshd plus a Tailscale-only firewall rule means a full port scan of your public IP reaches nothing at all, because the daemon is not bound there and the packets were never addressed there.",
          "Tailscale adds the coordination plane on top: key exchange through a DERP relay when direct UDP paths fail, a control server that distributes endpoints and ACLs, and MagicDNS names that resolve inside the tailnet. The <code>tailscaled</code> process is user space and speaks to the kernel WireGuard module; it configures routes and ACLs through netlink. The search domain it installs is why <code>ns.alexandrugris.ro</code> and your VPS's MagicDNS hostname both resolve on machines inside the tailnet but nowhere else — and it is a live demonstration that <em>which resolver answers</em> is a property of the path, not of the name."
        ],
        noteTitle: "Reverse tunnels, the other half of SSH",
        note: "<code>ssh -R 8080:localhost:80 user@vps</code> opens a <em>listening</em> port on the VPS that forwards back through the tunnel to your laptop. That is why a reverse tunnel needs <code>GatewayPorts clientspecified</code> and an <code>AllowTcpForwarding remote</em> policy to be reachable from anywhere but localhost — it is a genuinely different attack surface from ordinary SSH, and it is the mechanism behind many “expose my local dev server” workflows. Chapter 11 covers the policy.",
        noteKind: "warn"
      },
      {
        type: "prose",
        h: "MTU: the failure you will spend a day on",
        p: [
          "Every link has a maximum frame payload. Ethernet's is 1500 bytes; subtracting 20 bytes of IP header and 20 of TCP header leaves 1460 bytes of MSS. When a path contains a link with a smaller MTU than the endpoints assume, the packet is too big — and the correct behaviour is <strong>not to fragment</strong>. That is <em>Path MTU Discovery</em>: routers on the path drop the oversized packet and send an ICMP <em>Fragmentation Needed</em> back to the sender, which caches a smaller MTU for that destination. It is an elegant mechanism that relies on every router on the path actually generating that ICMP message.",
          "When something in the path is configured to drop ICMP — a firewall, a load balancer, a tunnel endpoint, or the Tailscale/overlay layer itself — PMTUD breaks silently. Small packets keep working perfectly: DNS replies, HTTP headers, small GET responses, the TCP handshake. The first packet that exceeds the real MTU vanishes, gets retransmitted, vanishes again, and TCP eventually gives up. The user-visible symptom is therefore extremely specific: <strong>a small response works, and anything large or encrypted hangs</strong>. A TLS handshake is the classic victim because the certificate alone exceeds the tunnel's budget; so is a large file download, and a page that pulls in a CSS bundle.",
          "The distinguishing test is to force the size yourself: <code>ping -M do -s 1472 host</code> succeeds but <code>ping -M do -s 1473 host</code> fails, which pins the MTU exactly. <code>tracepath</code> (from <code>iputils-tracepath</code>) prints the discovered path MTU at each hop because it sends probe packets of increasing size. The fixes, in order of preference: raise the MTU on the tun device (<code>ip link set dev tailscale0 mtu 1400</code>); make sure ICMP fragmentation-needed is permitted (<code>-p icmp --icmp-type fragmentation-needed -j ACCEPT</code> — a rule you should have in any rate-limited ICMP accept list); or clamp globally with iptables TCPMSS clamping on forwarding interfaces, which rewrites the advertised MSS in SYN packets so endpoints never try the larger size at all."
        ]
      },
      {
        type: "diagram",
        h: "Why small responses work and TLS handshakes hang",
        caption: "The endpoints assume 1500 and advertise MSS 1460. Something in the middle is 1420. Handshake packets fit, so the connection looks healthy. The certificate response does not fit, is dropped, and is retransmitted until the connection times out — with no error anywhere in the kernel log, because nothing is misconfigured, the ICMP that should have said so is simply being discarded.",
        svg: `
<svg viewBox="0 0 1100 520" role="img" aria-label="Path MTU discovery failure: small packets pass, large packets are dropped because ICMP fragmentation needed is filtered">
  <rect class="box-a" x="30" y="24" width="180" height="66" rx="9"/>
  <text class="t-accent" x="46" y="48" font-size="14.5">your process</text>
  <text class="t-sm" x="46" y="68">thinks MTU = 1500</text>
  <text class="t-xs" x="46" y="84">advertises MSS 1460</text>

  <rect class="box-v" x="300" y="24" width="180" height="66" rx="9"/>
  <text class="t-violet" x="316" y="48" font-size="14.5">tun / wg interface</text>
  <text class="t-sm" x="316" y="68">MTU 1420</text>
  <text class="t-xs" x="316" y="84">encapsulation cost</text>

  <rect class="box-w" x="570" y="24" width="200" height="66" rx="9"/>
  <text class="t-warn" x="586" y="48" font-size="14.5">firewall / middlebox</text>
  <text class="t-sm" x="586" y="68">drops ICMP type 3</text>
  <text class="t-xs" x="586" y="84">code 4 = frag needed</text>

  <rect class="box-ok" x="860" y="24" width="210" height="66" rx="9"/>
  <text class="t-ok" x="876" y="48" font-size="14.5">peer</text>
  <text class="t-sm" x="876" y="68">MTU 1500</text>
  <text class="t-xs" x="876" y="84">will not complain</text>

  <path class="ln-a" d="M210,57 L298,57" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M480,57 L568,57" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M770,57 L858,57" marker-end="url(#lm-arrow-accent)"/>

  <line class="ln" x1="30" y1="112" x2="1070" y2="112" stroke-dasharray="6 6"/>

  <!-- small packet -->
  <text class="t-ok" x="30" y="140" font-size="15">small packet — 400 bytes of payload, 1440 on the wire</text>
  <rect class="box-ok" x="30" y="152" width="230" height="40" rx="7"/>
  <text class="t-sm" x="46" y="177">DNS reply · 512 bytes</text>
  <path class="ln-ok" d="M260,172 L1050,172" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="330" y="166" font-size="13">fits inside 1420 → delivered → everything looks fine</text>

  <rect class="box-ok" x="30" y="200" width="230" height="40" rx="7"/>
  <text class="t-sm" x="46" y="225">HTTP 200 headers</text>
  <path class="ln-ok" d="M260,220 L1050,220" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="330" y="214" font-size="13">fits → the page's HTML arrives</text>

  <rect class="box-ok" x="30" y="248" width="230" height="40" rx="7"/>
  <text class="t-sm" x="46" y="273">TLS handshake SYN/ACK</text>
  <path class="ln-ok" d="M260,268 L1050,268" marker-end="url(#lm-arrow-ok)"/>
  <text class="t-ok" x="330" y="262" font-size="13">small → still fine</text>

  <!-- big packet -->
  <text class="t-bad" x="30" y="322" font-size="15">first packet that exceeds the real path MTU</text>
  <rect class="box-b" x="30" y="336" width="230" height="52" rx="7"/>
  <text class="t-sm" x="46" y="358">TLS certificate, 2.4 KB</text>
  <text class="t-xs" x="46" y="378">segmented to MSS 1460</text>

  <path class="ln-b" d="M260,362 L540,362" marker-end="url(#lm-arrow-bad)"/>
  <text class="t-bad" x="272" y="356" font-size="13">1452 bytes — too big for the 1420 link</text>

  <rect class="box-b" x="545" y="336" width="225" height="52" rx="7"/>
  <text class="t-sm" x="561" y="358">DROPPED, silently</text>
  <text class="t-xs" x="561" y="378">no ICMP reply — filter drops it</text>

  <path class="ln-b" d="M620,388 L620,412" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box" x="500" y="412" width="240" height="40" rx="7"/>
  <text class="t-sm" x="516" y="437">retransmit · same size · same drop</text>
  <text class="t-xs" x="330" y="437" font-size="13">exponential backoff: 200 ms, 400 ms, 800 ms …</text>

  <rect class="box-w" x="500" y="458" width="570" height="46" rx="9"/>
  <text class="t-warn" x="516" y="480" font-size="14">symptom: the site loads its HTML, then hangs forever with no error in any log</text>
  <text class="t-xs" x="516" y="497">curl says “Empty reply” or times out; the browser shows a spinning tab; the access log records a request that never completed.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "The diagnostics layer — filters and questions worth memorising",
        code:
`# ss: connections (see the earlier block) — the fastest first look

# tcpdump: the filters actually worth remembering
tcpdump -i any -nn -vv 'tcp port 22'                      # one service, both directions
tcpdump -i eth0 -nn 'host 100.101.104.5 and port 22'     # one peer
tcpdump -i any -nn 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0'   # handshakes only
tcpdump -i eth0 -nn 'icmp and icmp[0] == 3'              # fragmentation-needed = PMTUD problems
tcpdump -i eth0 -nn 'icmp[0] == 3 and icmp[1] == 4'       # specifically frag-needed (type 3, code 4)
tcpdump -i any -nn 'udp port 53 and not host 127.0.0.53'  # real DNS leaving the box
tcpdump -i any -nn -w /tmp/trace.pcap 'port 443'          # save for wireshark, -c 200 to bound it
tcpdump -r /tmp/trace.pcap -A | less                      # read it back on any machine

# path: hops, and the discovered MTU at each one
tracepath -n example.com
mtr -n -r -c 20 example.com                # -r is report mode, safe to paste
# hop with a rising RTT = congestion; a * is a filter dropping ICMP, not a dead router

# the application layer, where the real error string lives
curl -v --max-time 10 https://example.com/ 2>&1 | grep -E "Trying|Connected|TLS|SSL|error|refused"
curl -v https://example.com/                # shows the exact TLS negotiation and cert chain
curl -4 -v https://example.com/             # force v4 — if it fixes it, you have an AAAA/routing problem
openssl s_client -connect example.com:443 -servername example.com </dev/null

# raw connectivity tests
nc -vz -w3 example.com 443        # TCP only, tells you refused vs timeout vs open
nc -l 9000                        # listener, for a reverse-tunnel test
ping -c3 -M do -s 1472 example.com   # fits at 1500 MTU
ping -c3 -M do -s 1473 example.com   # fails → path MTU is exactly 1500

# DNS side of the stack (chapter 10 covers the protocol)
dig +short example.com A
dig @1.1.1.1 example.com A +short      # bypass the local resolver entirely
resolvectl query example.com            # ask systemd-resolved what it thinks

# counters that explain "it is slow"
ss -ti dst 93.184.216.34 | tr '\\n' ' '   # rtt, cwnd, retrans
nstat -az | grep -E "Retrans|ListenDrops|BacklogLen"
cat /proc/net/netstat | grep -A1 TcpExt | head
ethtool -S eth0 | grep -iE "drop|miss|err" # NIC-level, before TCP is involved`
      },
      {
        type: "table",
        cols: ["Error string", "Where it came from", "What is actually happening"],
        rows: [
          ["<code>ECONNREFUSED</code> (curl: (7))", "an RST came back", "Nothing is listening on that host and port, or a firewall sent REJECT. <strong>Immediate</strong> — the network works fine, which is the useful signal."],
          ["<code>Connection timed out</code>", "no RST, no reply", "Packets are being dropped: a firewall DROP, a wrong route to a black hole, or a dead next hop. <code>nc -vz</code> hangs instead of refusing."],
          ["<code>ENETUNREACH</code>", "local routing", "No route to that network at all. <code>ip route get &lt;dest&gt;</code> returns <code>unreachable ...</code>. Local misconfiguration, nothing left the box."],
          ["<code>EHOSTUNREACH</code>", "local or ARP failure", "Route exists but the host is unreachable — classically a failed ARP on the local segment, or <code>ip_forward=0</code> on a forwarding path."],
          ["<code>EPERM</code> from connect()", "netfilter, locally", "A local rule matched and returned REJECT/REJECT-with-error, or you tried to bind a port below 1024 without privilege. See <code>journalctl -k</code> for the rule's name."],
          ["<code>EAGAIN</code> on a non-blocking socket", "listen backlog", "The accept queue is full. <code>ss -ltn</code> shows <code>Recv-Q</code> at the Send-Q value, and <code>TcpExtListenDrops</code> climbs."],
          ["<code>EMSGSIZE</code> / <code>Message too long</code>", "IP layer", "A datagram exceeded the path MTU and fragmentation is disallowed. Symptom: UDP sends fail while TCP works."],
          ["<code>ETIMEDOUT</code> on write", "TCP retransmissions", "Data was sent, never acknowledged. Either the path is dropping it or the peer's receive window closed. <code>ss -ti</code> shows the retransmit count."]
        ]
      },
      {
        type: "cards",
        items: [
          { title: "Blocking", tag: "SYSCALL", tone: "violet", text: "<code>recv()</code> parks the thread. One thread per connection, ~8&nbsp;MB stack each, simplest possible correctness. Fine up to a few hundred connections per process; beyond that you are paying for threads you did not need." },
          { title: "Non-blocking", tag: "O_NONBLOCK", tone: "warn", text: "Every call returns <code>EAGAIN</code> immediately. Useless alone — this is a spin loop unless something tells you <em>when</em> to try again. Its real job is inside the next item." },
          { title: "epoll", tag: "READY", tone: "ok", text: "One kernel interest list, one ready list, O(active) instead of O(n). 1024 <code>FD_SETSIZE</code> cap disappears, wakeups carry exactly the work that exists. nginx, Node and Go all end up here." },
          { title: "io_uring", tag: "5.19+", tone: "pink", text: "Shared rings between kernel and userspace, with completion events rather than readiness polling. Best on NVMe and high-fanout sockets. On a 4.15 kernel this simply does not exist — it landed in 5.19." }
        ]
      },
      {
        type: "prose",
        h: "What this looks like on the box this map was written against",
        p: [
          "Ubuntu 18.04.6, kernel 4.15.0-213, iptables 1.6.1 with the <strong>legacy</strong> backend selected by <code>update-alternatives</code> — not the nftables default that every modern guide will assume. ufw 0.36 in front of it, allowing <code>22</code>, <code>80</code>, <code>443</code>, the Tailscale CGNAT range and the LAN. systemd-resolved answering on <code>127.0.0.53</code> with a Tailscale search domain. One public interface <code>eth0</code> with the default route, one <code>tailscale0</code> carrying SSH, and the nginx workers listening on <code>0.0.0.0:80</code> and <code>0.0.0.0:443</code>.",
          "Two of those lines are deliberate policy rather than convenience. Binding sshd to the Tailscale address only would mean the public port 22 is not open <em>and</em> the daemon is not listening there — two independent layers, because a firewall rule can be rewritten by a package install and a listening socket cannot be forgotten. And the AAAA question is worth raising here: if the VPS has no IPv6, publishing AAAA records for it sends half your visitors into a path that dead-ends. <code>curl -4</code> versus <code>curl -6</code> against your own hostname answers that in one second, and it is a DNS bug that presents as a network bug.",
          "The last practical habit: when something on this box will not talk to the internet, the order is <strong><code>ip route get</code> → <code>ss -tan</code> → <code>iptables -L -n -v</code> after zeroing counters → <code>tcpdump</code> on the specific tuple</strong>. Each step eliminates a whole layer, and the point at which the packet disappears tells you which half of the diagram at the top of this chapter you are actually looking at."
        ],
        noteTitle: "Where modern systems differ from everything above",
        note: "nftables as the default backend (Ubuntu 22.10+, Debian 12, Fedora 33+), <code>ip</code> replacing <code>ifconfig</code>/<code>route</code>/<code>arp</code> (done: <code>net-tools</code> is gone from minimal installs), <code>bridge-nf-call-iptables</code> replaced by nftables <code>bridge</code> family which handles bridged traffic natively, TCP <code>syncookies</code> on by default since 4.1, <code>io_uring</code> available since 5.19, and the CUBIC congestion control algorithm as the default instead of Reno. The <em>concepts</em> in this chapter are unchanged; the tools that expose them are not.",
        noteKind: "fact"
      },
      {
        type: "callout",
        kind: "boss",
        title: "mental model to keep",
        text: "Networking is four kernel data structures — interfaces, addresses, routes, neighbours — plus one shared state machine for reliability (TCP) and one for policy (netfilter/conntrack). Both state machines are <em>inspectable</em>, which is the entire reason <code>ss</code> and <code>conntrack -L</code> exist. When a connection misbehaves, ask which state machine is wrong before you blame the wire: <code>ss</code> for TCP, <code>conntrack -L</code> for firewall and NAT, <code>ip route get</code> for forwarding, and <code>tcpdump</code> only for what all three of those cannot see."
      }
    ],
    takeaways: [
      "The NIC owns a MAC and a cable. Everything else — IP, TCP, NAT, firewall — is software on your CPU, which is why \"the network\" is almost never the network.",
      "A route is a lookup result, not a path. There is no per-flow pinning, so <code>traceroute</code> shows one path and your packets may take another; <code>ip route get</code> is the honest question.",
      "A socket is a file. <code>/proc/&lt;pid&gt;/fd</code> and <code>/proc/net/tcp</code> are two views of the same inode, which is why <code>ss -p</code> and <code>lsof</code> agree.",
      "TCP is a kernel state machine. <code>CLOSE_WAIT</code> in bulk is always an application leak; <code>TIME_WAIT</code> in bulk on a server means you are closing first and probably want <code>keepalive_timeout</code> plus <code>SO_REUSEADDR</code> instead of a bigger box.",
      "netfilter hooks are gates; tables are rules attached to those gates; <code>*nat</code> tables run <em>only for the first packet</em>, and everything later comes from conntrack. If the conntrack table fills, your stateful rules silently stop matching.",
      "Legacy and nftables backends can coexist and disagree, because they are separate kernel stores. <code>update-alternatives --display iptables</code> and <code>iptables -V</code> are mandatory first steps in any firewall debugging.",
      "Small responses working while TLS handshakes hang is a path-MTU symptom, not an application bug. <code>ping -M do</code> pins it, <code>tracepath</code> shows it, and accepting ICMP type 3 code 4 fixes it.",
      "A Tailscale-only service is not hidden from <code>ss -t</code>, it is invisible on the public interface — which is exactly the property you want, and exactly the one a port scan cannot see."
    ],
    glossary: {
      "socket": "A kernel object exposed as a file descriptor. Owns buffers, state and the protocol state machine behind a connection.",
      "net_device": "The kernel's interface struct. Physical, bridge, bond, VLAN or tun — the stack cannot tell them apart.",
      "route": "A prefix plus an action in a routing table. Longest-prefix match wins; no flow state, no path reservation.",
      "routing rule": "An ordered entry in the policy-routing list naming a table and a match. <code>ip rule</code>; index 0 is always local.",
      "neighbour table": "The ARP/NDP cache mapping link-layer addresses to IP addresses on the same segment.",
      "MTU": "Maximum transmission unit — the largest payload a link will carry without fragmentation. Ethernet is 1500.",
      "PMTUD": "Path MTU Discovery. Routers send ICMP type 3 code 4; endpoints cache a smaller size. Broken by ICMP filtering.",
      "conntrack": "The kernel's per-connection state table shared by netfilter and NAT, keyed by the 5-tuple.",
      "netfilter": "The kernel framework of hooks (PREROUTING, INPUT, FORWARD, OUTPUT, POSTROUTING) with rule tables attached.",
      "SYN_SENT / SYN_RECV": "Half-open handshake states. Bulk SYN_RECV on a server means the accept backlog is full.",
      "TIME_WAIT": "The 2×MSL (60 s on Linux) linger after close, preventing late duplicates from a new connection with the same ports.",
      "NAT / SNAT / DNAT": "Translation of addresses. SNAT rewrites source, DNAT rewrites destination, masquerade is SNAT resolved at send time.",
      "epoll": "Linux's readiness-notification interface: one interest list, one ready list, O(active) per wait.",
      "tun": "A virtual interface whose packets are carried inside another protocol's packets — the basis of WireGuard and Tailscale."
    }
  });
})();