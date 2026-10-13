/* ch17 — Cheatsheet */
(function () {
  LX.push({
    id: "cheatsheet",
    title: "The commands, and what each one is telling you",
    tagline: "Organised by the task you are doing, not by the tool. Each entry: what it answers, and the one thing to look at in the output.",
    sections: [
      {
        type: "prose",
        h: "How to use this chapter",
        p: [
          "Everything here answers a question you are already asking. The format is deliberate: <strong>the command, what it settles, and the specific thing in the output that matters</strong> — because a command that produces forty lines and does not tell you which line to read is worse than no command at all.",
          "Read it once end to end. It is not meant to be tab-completed from; it is meant to be absorbed so that later, when something is broken, you reach for the right one immediately and know what you are looking at. The mechanisms behind all of these are in the chapters above; this is the index into them."
        ]
      },
      {
        type: "diagram",
        h: "The one-page orientation: which layer answers which question",
        caption: "Almost every confusion in a terminal comes from asking a lower layer a question only a higher layer can answer. <code>df</code> cannot tell you why the disk is full (ch12), <code>free</code> cannot tell you why you were OOM-killed (ch04), <code>curl</code> cannot tell you whether DNS is lying (ch10). Use the lowest layer that can actually answer, and escalate only when it says \"I don't know\".",
        svg: `
<svg viewBox="0 0 1100 500" role="img" aria-label="Which layer of the system answers which question">
  <rect class="box-b" x="30" y="24" width="1040" height="62" rx="10"/>
  <text class="t-bad" x="48" y="48" font-size="15">“is it reachable?”</text>
  <text class="t-xs" x="48" y="70">ping · nc · traceroute · tcpdump · ip route get · ss  — the network exists before anything on it does</text>
  <text class="t-xs" x="820" y="48">chapter 09, 11, 16</text>

  <rect class="box-w" x="30" y="98" width="1040" height="62" rx="10"/>
  <text class="t-warn" x="48" y="122" font-size="15">“is it listening / does the name resolve?”</text>
  <text class="t-xs" x="48" y="144">ss -tanp · dig · resolvectl · getent · curl -sv — a process must be bound before DNS matters</text>
  <text class="t-xs" x="820" y="122">chapter 10, 11</text>

  <rect class="box-p" x="30" y="172" width="1040" height="62" rx="10"/>
  <text class="t-bad" x="48" y="196" font-size="15">“is it healthy / did it start?”</text>
  <text class="t-xs" x="48" y="218">systemctl status · journalctl -u -b · crictl ps/logs · kubectl describe — the supervisor's own record</text>
  <text class="t-xs" x="820" y="196">chapter 06, 13, 14</text>

  <rect class="box-v" x="30" y="246" width="1040" height="62" rx="10"/>
  <text class="t-violet" x="48" y="270" font-size="15">“what is it actually doing?”</text>
  <text class="t-xs" x="48" y="292">strace -f -tt · lsof -p · /proc/PID/{status,fd,limits} · coredumpctl — the process itself answers last</text>
  <text class="t-xs" x="820" y="270">chapter 03</text>

  <rect class="box-a" x="30" y="320" width="1040" height="62" rx="10"/>
  <text class="t-accent" x="48" y="344" font-size="15">“is there room?”</text>
  <text class="t-xs" x="48" y="366">df -hT / df -i · free -m · lsof +L1 · cgroup memory.current/max · du -x — capacity answers to limits, not to hope</text>
  <text class="t-xs" x="820" y="344">chapter 04, 12</text>

  <rect class="box-ok" x="30" y="394" width="1040" height="62" rx="10"/>
  <text class="t-ok" x="48" y="418" font-size="15">“is the kernel unhappy?”</text>
  <text class="t-xs" x="48" y="440">journalctl -k -b · dmesg -T · /proc/pressure/* — hardware, drivers, OOM and blocked I/O all surface here first</text>
  <text class="t-xs" x="820" y="440">chapter 02</text>
</svg>`
      },

      {
        type: "kv",
        h: "System, kernel, boot",
        items: [
          { k: "uname -a", v: "Kernel version and architecture. Check this first when a bug is version-specific — and compare against <code>/proc/cmdline</code> if the machine rebooted unexpectedly." },
          { k: "cat /proc/cmdline", v: "Every argument the kernel booted with. Root device, console, interface naming, cgroup mode, rescue target. The most revealing single command on a misbehaving machine." },
          { k: "uptime", v: "Load averages and time since boot. Load is runnable + uninterruptible tasks, <strong>not</strong> CPU. Compare against the core count before concluding anything." },
          { k: "free -m", v: "Memory. Read <code>available</code>, not <code>free</code> — cached memory is available memory, and acting on <code>free</code> is the most common misreading of Linux memory." },
          { k: "last -x reboot shutdown", v: "The shutdown/reboot history with run time. Answers “did it reboot cleanly or did something kill it”." },
          { k: "systemd-analyze blame | head", v: "Which boot unit cost the most wall-clock time. Followed by <code>critical-chain</code> for the ordering path." },
          { k: "cat /proc/pressure/{cpu,memory,io}", v: "PSI: the percentage of the last 10/60/300 s that tasks were stalled on each resource. Rising <code>some</code> with idle CPU means throttling, not saturation." },
          { k: "lsblk -f", v: "Block devices, partition tables, filesystems, mountpoints and UUIDs in one view. UUIDs are what belong in <code>/etc/fstab</code>." },
          { k: "findmnt -T /path", v: "Which filesystem a path actually lives on, and with which options. Faster and more correct than reasoning from <code>df</code>." },
          { k: "dmidecode -t system", v: "Hardware identity and, on a VM, the hypervisor. Often the only place a VPS's true memory size is visible." },
          { k: "cat /sys/devices/system/cpu/online", v: "Which CPUs the kernel actually brought up. Fewer than you paid for means a hypervisor pinning, not a fault." },
          { k: "mokutil --sb-state", v: "Secure Boot state. Explains “Key was rejected by service” when a third-party kernel module refuses to load." }
        ]
      },
      {
        type: "kv",
        h: "Processes: who is doing what",
        items: [
          { k: "ps -eo pid,ppid,stat,etimes,%cpu,%mem,rss,comm --sort=-%cpu", v: "The process table sorted by CPU. Look at <code>STAT</code> before anything else: <strong>D</strong> means blocked on I/O and cannot be killed." },
          { k: "ps -eo stat,pid,comm | awk '$1 ~ /^D/'", v: "The D-state hunt. Run this first on any machine described as “frozen” or “hung” — the answer is usually a dead mount or a wedged disk, not load." },
          { k: "pstree -asp 1", v: "The whole process tree from init. Answers “who spawned this” without hunting through <code>ps</code> output." },
          { k: "systemd-cgls", v: "The cgroup tree, which is systemd's view of processes. On a busy host this is faster to read than the process table and groups by unit." },
          { k: "ls -l /proc/PID/fd", v: "Every file, socket and device the process holds. <code>/proc/PID/fd</code> is a symlink per descriptor — this is <code>lsof</code> for one process, always available." },
          { k: "readlink /proc/PID/exe", v: "The real binary path. Defeats processes that lie about argv, and reveals a deleted binary after an in-place upgrade." },
          { k: "cat /proc/PID/cmdline | tr '\\0' ' '", v: "argv exactly as passed, NUL-separated. <code>ps aux | grep</code> matches its own grep; this does not, and it survives spaces and metacharacters." },
          { k: "cat /proc/PID/status", v: "Threads, state, UID/GID, <code>CapEff</code> (capabilities), seccomp mode, VmRSS. The capability line is how you check whether a process really dropped root." },
          { k: "cat /proc/PID/limits", v: "The actual rlimits in force. Compare <code>open files</code> here against your <code>LimitNOFILE=</code> setting." },
          { k: "cat /proc/PID/maps", v: "Every mapping: heap, shared libraries, stacks, file-backed regions. How you spot a process running a deleted library after an upgrade." },
          { k: "strace -f -tt -T -e trace=%file ./cmd", v: "Every syscall with microsecond timestamps and real error numbers. The fastest truth in any debugging session; <code>-f</code> follows forks, <code>-T</code> shows latency." },
          { k: "coredumpctl list / info / gdb", v: "Crashes the kernel caught. <code>journalctl</code> may rate-limit the rest of a crash loop away; the coredump is kept." },
          { k: "kill -0 PID", v: "Test existence without sending a signal. Returns the error code if you lack permission — which distinguishes “gone” from “not yours”." },
          { k: "pkill -u USER -f PATTERN", v: "Kill by user <em>and</em> command line, never by name alone — <code>pkill nginx</code> matches your log files and other people's processes." }
        ]
      },
      {
        type: "kv",
        h: "Services and logs",
        items: [
          { k: "systemctl status UNIT --no-pager -l", v: "State, uptime, the process tree, and the last log lines on one screen. The correct first command for any service question." },
          { k: "systemctl show UNIT -p PROP", v: "<strong>Effective</strong> values, not the file. <code>MemoryCurrent</code>, <code>TasksCurrent</code>, <code>NRestarts</code>, <code>ExecMainStatus</code>, <code>FragmentPath</code>, <code>DropInPaths</code>." },
          { k: "systemctl cat UNIT", v: "The unit plus every drop-in, merged, with the file paths. Proves whether the file you edited is the one in effect." },
          { k: "systemctl list-dependencies TARGET", v: "The boot graph. Add <code>--reverse</code> to ask what breaks if this unit dies." },
          { k: "systemctl --failed", v: "Everything that failed this boot. The highest-value single command during any incident review." },
          { k: "journalctl -u UNIT -f", v: "Follow one unit live. The command you will type most often in a career." },
          { k: "journalctl -b -1 -p warning", v: "The <em>previous</em> boot's warnings. Why did it restart? Almost always answered here." },
          { k: "journalctl -k -b", v: "The kernel ring buffer for this boot: hardware probe, driver messages, OOM kills, blocked requests. (Equivalent to <code>dmesg -T</code> with filtering.)" },
          { k: "journalctl -o short-precise", v: "Millisecond timestamps — the only format that reveals a race between two services." },
          { k: "journalctl --disk-usage / --vacuum-size=300M", v: "Journal size and cleanup. Uncapped journald on a 19 GB disk once reached 1.8 GB here." },
          { k: "journalctl -x", v: "Adds the human explanation of known messages. Often decodes a cryptic line instantly." },
          { k: "systemctl reload vs restart", v: "<code>reload</code> = graceful, in-flight requests finish (nginx workers, sshd re-exec). <code>restart</code> = hard stop then start. Prefer reload where it exists." },
          { k: "systemctl enable --now UNIT", v: "Link into the boot target <em>and</em> start now. Two actions people routinely forget to do separately." },
          { k: "systemctl list-timers --all", v: "NEXT / LEFT / LAST / PASSED for every timer. Verify your schedule is what you think before assuming it did not run." },
          { k: "systemd-analyze verify PATH/to.unit", v: "Syntax check for a hand-written unit, including directives this systemd version does not understand — which it ignores silently." },
          { k: "coredumpctl / coredump list", v: "Post-mortem crash store, when journald rate-limiting ate the interesting part." }
        ]
      },
      {
        type: "kv",
        h: "Packages and building",
        items: [
          { k: "dpkg -L PACKAGE", v: "Every file a package installed. The first question when something is installed but not behaving: is there a conffile, a unit, a binfmt handler, a cron job you did not know about?" },
          { k: "dpkg -S /path/to/file", v: "Which package owns a file. Answers “what just overwrote my config” and “is this file even from a package”." },
          { k: "dpkg -l | grep ^ii", v: "Installed packages and their versions, including the <code>hold</code> flag. <code>ii</code> = installed and OK." },
          { k: "apt-get -s install PKG", v: "<strong>Simulate.</strong> Shows exactly what would be installed, upgraded and removed. Run it before every risky change on a production machine." },
          { k: "apt-get update && apt-get -s upgrade", v: "Refresh the index, then see what an upgrade would do. Read the removals line — that is where surprises live." },
          { k: "grep -R . /etc/apt/sources.list.d/", v: "Where packages come from. Mixed Debian and Ubuntu repositories here is the single most destructive thing you can add to a server." },
          { k: "apt-mark showhold", v: "Pinned packages that will never upgrade. Use deliberately: an upgrade of openssl or systemd mid-incident is a bad idea." },
          { k: "/var/log/apt/history.log", v: "What was installed, upgraded or removed and when. Read it before every unexplained behaviour change." },
          { k: "apt-get build-dep PKG", v: "Installs the build dependencies the maintainers declared. Better than installing <code>build-essential</code> and discovering what is missing one header at a time." },
          { k: "./configure --help", v: "Every flag this particular source tree supports. Never guess a <code>--prefix</code> path; ask." },
          { k: "ldd /path/to/binary", v: "Which shared libraries it loads and which are <code>not found</code>. Explains a binary that will not start after a library upgrade." },
          { k: "readelf -d ./binary | grep NEEDED", v: "The libraries it <em>requires</em>, plus RPATH/RUNPATH. The dependency list without the loading." },
          { k: "LD_DEBUG=libs ./binary", v: "Traces the dynamic loader's search path step by step. When ldd says it resolves and it still fails, this says why." },
          { k: "make -j\\$(nproc)", v: "Parallel build. On a 2-core VPS this halves build time; it also occasionally exposes racy Makefiles." },
          { k: "DESTDIR=/tmp/pkg make install", v: "Install into a staging directory instead of /. <strong>This is how packaging works</strong> — and it is why a manual <code>make install</code> can never be cleanly removed." },
          { k: "dpkg-deb --build DIR/ PACKAGE.deb", v: "Turn a staged tree into a real package. Contents of <code>DEBIAN/control</code> decide how it installs." }
        ]
      },
      {
        type: "kv",
        h: "Networking and DNS",
        items: [
          { k: "ss -tanp state listening", v: "What is listening, on which address, owned by which process. The <strong>bind address</strong> is the thing: <code>127.0.0.1</code> means unreachable from anywhere else." },
          { k: "ss -tanp | grep :443", v: "Every connection on a port, with process names. Check <code>Send-Q</code> (the accept backlog) when a server refuses connections under load." },
          { k: "ss -s", v: "Totals: sockets in use, memory, TCP states. A sudden pile of <code>CLOSE_WAIT</code> means an application is not closing connections." },
          { k: "ip -br addr", v: "Interfaces and addresses, one line each. The first thing to check when a host is unreachable." },
          { k: "ip route get DEST", v: "The route the kernel would actually use, including the source address it picks. <code>ip route</code> alone does not tell you that." },
          { k: "ip neigh", v: "ARP/neighbour table. A stuck <code>FAILED</code> entry is a genuine local-network problem, not a firewall one." },
          { k: "ethtool eth0", v: "Link speed, duplex, autoneg. A negotiated half-duplex or a mismatch is a performance bug that looks like an application bug." },
          { k: "tcpdump -ni any 'tcp port 443'", v: "The ground truth. Did the SYN arrive at all? Was there a RST? This ends arguments that <code>ss</code> cannot." },
          { k: "tcpdump -ni any -w /tmp/cap.pcap host X and port 443", v: "Save a capture to attach to a bug report. <code>-n</code> skips DNS, <code>-i any</code> catches every interface including tunnels." },
          { k: "conntrack -L 2>/dev/null | wc -l", v: "Connection tracking table size. Near <code>nf_conntrack_max</code> is the classic cause of intermittent, maddening packet drops." },
          { k: "iptables -t nat -L -n -v", v: "NAT rules, with packet counters. The counters tell you which rules have ever matched." },
          { k: "nft list ruleset", v: "The same information on nftables systems. On an old box check <code>update-alternatives --display iptables</code> — legacy and nft backends can coexist silently." },
          { k: "resolvectl status / query NAME", v: "The resolver's real configuration and its answer. Never edit <code>/etc/resolv.conf</code> on a systemd-resolved system; it is a symlink into <code>/run</code>." },
          { k: "dig +trace NAME", v: "Walks delegation from the root. The definitive answer to “is my domain published correctly, and where does it stop working”." },
          { k: "dig @SERVER NAME", v: "Ask one specific server. Compare the flags: <strong>aa</strong> authoritative, <strong>rd</strong>/<strong>ra</strong> recursion, <strong>tc</strong> truncated (retry with <code>+tcp</code>)." },
          { k: "curl -sv URL", v: "The whole conversation: DNS, TCP, TLS, request, response. <code>-w '%{time_namelookup} %{time_connect} %{time_appconnect} %{time_starttransfer}'</code> splits the latency by phase." },
          { k: "curl -w '%{http_code} %{time_total}\\n' -o /dev/null -sS URL", v: "Format-string probe for health checks. Keeps the checker's output to one number and one duration." },
          { k: "mtr -rwc 20 DEST", v: "Where a path degrades. <code>-c 20</code> counts, <code>-w</code> wide report — use both, the default report is unwieldy." }
        ]
      },
      {
        type: "kv",
        h: "Storage and capacity",
        items: [
          { k: "df -hT", v: "Space by filesystem with type. <code>df</code> counts deleted-but-open files; <code>du</code> does not. When they disagree, trust <code>du</code> for what to delete." },
          { k: "df -i", v: "Inode usage. 100% with free space means every new file fails — a completely different failure that <code>df -h</code> hides." },
          { k: "du -x --max-depth=1 / | sort -h | tail", v: "Where the space actually is. <code>-x</code> stops at filesystem boundaries so nested mounts do not double-count." },
          { k: "ncdu -x /", v: "The same thing, interactively and much faster to explore. The right tool when <code>du</code> is taking minutes." },
          { k: "lsof +L1", v: "Open files whose name has been deleted. Invisible to <code>df</code> and <code>du</code>, still occupying blocks. Restart the holder to reclaim." },
          { k: "find /var/log -type f -mtime +30 -ls", v: "Old logs nobody rotated. The single easiest win on a log-heavy small server." },
          { k: "iostat -x 1", v: "Per-device throughput and queue depth. <strong>%util</strong> near 100 means saturated; <strong>await</strong> high with low util means a slow device, not a busy one." },
          { k: "vmstat 1 5", v: "<code>r</code> runnable vs <code>b</code> blocked is the load story. <code>si</code>/<code>so</code> non-zero means swap thrash — never healthy on a 2 GB box." },
          { k: "cat /proc/mounts | grep -v cgroup", v: "Every mount with its options. Check for <code>noexec</code>, <code>nosuid</code>, <code>ro</code> surprises, and stale bind mounts." },
          { k: "tune2fs -l /dev/sda1 | grep -i state", v: "Filesystem health and mount count for ext. Run only on an unmounted filesystem unless it is <code>-n</code>." },
          { k: "resize2fs /dev/sda1   ·   xfs_growfs /", v: "Grow a filesystem after the partition or LV was already resized. xfs cannot shrink, and grows only mounted." },
          { k: "lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT", v: "The device tree, so you can see the layering: disk → partition → LV → filesystem → mountpoint." }
        ]
      },
      {
        type: "kv",
        h: "Users, permissions, containers",
        items: [
          { k: "id / id -G", v: "Effective UID, GID and supplementary groups — the complete identity used for every permission decision." },
          { k: "namei -l /path/to/file", v: "Permissions on every component of the path. A missing execute bit on a parent directory blocks access to a perfectly readable file." },
          { k: "getfacl / setfacl -m u:alexgris:r-- FILE", v: "POSIX ACLs — permissions for a user beyond the three-row model, without changing ownership." },
          { k: "lsattr FILE", v: "Inode flags. <code>i</code> (immutable) makes chmod and rm fail with a confusing <code>Operation not permitted</code> even for root." },
          { k: "find / -perm -4000 -type f", v: "Every setuid binary. Audit it on any machine you did not build; each one is a privilege-escalation surface." },
          { k: "getpcaps PID  ·  capsh --decode=0x...", v: "What a process may actually do. <code>/proc/PID/status</code> <code>CapEff</code> is the same answer, hex." },
          { k: "setcap 'cap_net_bind_service=+ep' BIN", v: "Grant one capability to a binary on disk. The correct way to let a daemon bind port 80 without being root." },
          { k: "systemd-analyze security UNIT", v: "Scores a unit's hardening and names each missing directive. Faster than reading the sandboxing man page." },
          { k: "lsns -t pid,mnt,net", v: "Every namespace on the system and which process is in it. The overview that makes containers concrete." },
          { k: "nsenter -t PID -n -m -u -i -p -a -- CMD", v: "Enter another process's view of the world. <code>-n</code> network, <code>-m</code> mount, <code>-p</code> PID — the container escape hatch that is also the debugging tool." },
          { k: "docker ps / nerdctl ps / crictl ps -a", v: "Three different views of the same runtime: dockerd's namespace, the generic client, and the Kubernetes CRI namespace. If <code>docker ps</code> is empty but pods exist, that is expected, not broken." },
          { k: "crictl images / pods / logs ID", v: "What Kubernetes asked containerd for. <code>crictl</code> speaks CRI, which is exactly what kubelet uses." },
          { k: "ctr -n k8s.io containers list", v: "containerd's own view inside the <code>k8s.io</code> namespace. The lowest level the cluster still exposes to you." },
          { k: "nerdctl system prune", v: "Reclaim containerd images, containers and volumes without Docker. Check <code>docker system df</code> first if Docker is in use." }
        ]
      },
      {
        type: "kv",
        h: "Kubernetes",
        items: [
          { k: "kubectl describe pod POD", v: "The <strong>Events at the bottom</strong> are the answer to 80% of pod questions. Everything above them is spec restatement." },
          { k: "kubectl get pods -o wide --field-selector=status.phase=Pending", v: "Server-side filtering — cheaper than grepping a large <code>get pods</code>, and it uses the API rather than your terminal." },
          { k: "kubectl logs POD --previous", v: "The output of the container run <em>before</em> the last restart. The only place a crash-loop's real message survives." },
          { k: "kubectl debug -it POD --image=… --target=CONTAINER", v: "An ephemeral container: attach debuggers to a running pod without changing the image or restarting anything." },
          { k: "kubectl get events --sort-by=.lastTimestamp", v: "Cluster events in order. The single best first command when something recently started misbehaving." },
          { k: "kubectl get --raw '/api/v1/nodes/N/proxy/logs/'", v: "Read node logs through the API server when you do not have SSH. Works even when kubelet's own logging is the problem." },
          { k: "kubectl top pods --sort-by=memory", v: "Live usage from metrics-server, which itself reads kubelet's summary API. If it is empty, metrics-server is the thing to debug." },
          { k: "kubectl diff -f manifests/ -R", v: "What would change before you apply it. The cheapest outage prevention available in the platform." },
          { k: "kubectl explain deploy.spec.strategy", v: "API documentation from the server itself, so it always matches the version you are running." }
        ]
      },
      {
        type: "prose",
        h: "Shell things that actually matter",
        p: [
          "Shell competence is not trivia — it is the difference between a script that works and a script that has quietly been wrong for a year. Six things carry most of the value.",
          "<strong>Quote everything</strong>. <code>$var</code> splits on whitespace and expands globs; <code>\"$var\"</code> does neither and is almost always what you meant. Unquoted expansion is also the mechanism behind the majority of injection bugs in shell scripts, so this is a security rule as much as a correctness one.",
          "<strong>Know when <code>set -e</code> will not save you.</strong> It exits on a failed simple command, but not inside <code>if</code>, <code>while</code>, <code>until</code>, <code>&&</code>/<code>||</code> chains, or a pipeline unless the last command fails. Use <code>set -euo pipefail</code> — <code>-u</code> catches typos that would otherwise silently become empty strings, and <code>pipefail</code> catches a failure that <code>head</code> swallowed. Then remember that <code>-e</code> still will not catch a <em>wrong answer</em>, only a non-zero exit.",
          "<strong>Handle failure where it happens.</strong> <code>trap cleanup EXIT</code> guarantees temporary directories and mounts are removed even when the script exits early, which is the difference between an idempotent script and one that accumulates debris.",
          "<strong>Handle names correctly.</strong> <code>find . -print0 | xargs -0</code> is the only safe way to process files whose names contain spaces or newlines. Without the null separator, <code>xargs</code> will cheerfully split a filename into two arguments and operate on the wrong files.",
          "<strong>Prefer the structured parser.</strong> <code>jq</code> for JSON, <code>awk</code> for columns, <code>sort -h</code> for sizes with units, <code>grep -P</code> when a plain pattern will not do. Text-scraping structured data is how scripts break when a version changes."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Shell patterns that are worth memorising whole",
        code:
`# fail loudly, and clean up whatever happens
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# null-safe iteration over filenames
find /var/log -type f -name '*.gz' -print0 | xargs -0 -r zcat -- | grep -i error

# an array, when you need real argument handling rather than a string
args=(--format=json --since="2h ago")
kubectl get events -o json | jq -r '.items[] | "\\(.lastTimestamp) \\(.reason) \\(.message)"' | sort | tail

# substitute into a template safely instead of building a command string
#   DANGEROUS:  cmd="rsync -av $src $dst"  -> word splitting, globbing, injection
#   DANGEROUS:  eval "cmd"                -> runs whatever the data contained
rsync -av -- "$src" "$dst/"                     # "--" ends option parsing

# check a command's success without losing its output
if ! out=$(systemctl is-active nginx); then
    echo "nginx is $out"; exit 1
fi

# distinguish "no such file" from "permission denied" from "no such process"
mkdir -p "$d" 2>/dev/null   || { echo "cannot create $d"; exit 1; }
ls "$d" 2>/dev/null         || echo "exists but unreadable"

# awk: the three questions people actually ask of a column
awk '$3 > 100 {print $1}'            # filter on a field, not on a match
awk '{s+=$2} END {print s}'           # sum a column
awk 'NR>1 {print $1"\\t"$3}' OFS='\\t' # drop the header, select columns

# diff two directories the way rsync will see them
diff -rq /etc/nginx /etc/nginx.new 2>&1 | head -40
rsync -avznc --delete src/ dst/       # -n dry-run, -c checksum, -n delete preview

# here-strings and process substitution beat most quoting gymnastics
diff <(sort a.txt) <(sort b.txt)
while read -r line; do ...; done < <(command that can fail)

# a health check that returns one number and one duration
curl -fsS -o /dev/null -w '%{http_code} %{time_total}\\n' --max-time 5 https://example.com/`
      },
      {
        type: "kv",
        h: "Paths worth knowing by heart",
        items: [
          { k: "/etc/systemd/system/", v: "Where your units and drop-ins live. Never edit <code>/lib/systemd/system/</code> — the package owns that and will overwrite it." },
          { k: "/etc/fstab", v: "Mounts, and the generator that turns them into <code>*.mount</code> units. A bad entry here can stop boot entirely; use <code>nofail</code> and <code>_netdev</code> where appropriate." },
          { k: "/proc/PID/", v: "status, stat, cmdline, exe, cwd, root, fd, maps, limits, ns/, cgroup, mountinfo. The kernel's own view of a process, free and always current." },
          { k: "/sys/fs/cgroup/", v: "Resource limits. <code>tmpfs</code> at the root means cgroups v1 (your 18.04 box); <code>cgroup2fs</code> means v2, with <code>memory.max</code> and <code>cpu.max</code>." },
          { k: "/run/systemd/resolve/stub-resolv.conf", v: "What <code>/etc/resolv.conf</code> points at on a systemd-resolved system. Edit <code>/etc/systemd/resolved.conf</code>, never this." },
          { k: "/var/lib/containerd/", v: "content, snapshots, runtime metadata, and the per-pod shim sockets. Where the disk goes when containers eat a server." },
          { k: "/var/lib/kubelet/", v: "Pod volumes, container logs, and the CRI runtime's socket. Deleting kubelet state is how you lose pods' files." },
          { k: "/var/log/apt/history.log", v: "What changed, when, and by whom — for packages. Read it before any unexplained behaviour change." },
          { k: "/var/backups/", v: "dpkg keeps conffile backups here, which is how you find what a package upgrade changed in your configuration." },
          { k: "/etc/ssh/sshd_config", v: "The file. <code>sshd -T</code> is the <em>effective</em> configuration, including Match blocks — and there is usually a second file in <code>/etc/ssh/sshd_config.d/</code> overriding it." },
          { k: "/var/www/html/", v: "On your box: four static sites, published by rsync from local git repositories. The docroot is a copy; the repositories are the source of truth." },
          { k: "/dev/", v: "Device nodes. A full <code>/dev</code> at boot means devtmpfs is not mounted and udev is not running — the classic initramfs rescue state." }
        ]
      },
      {
        type: "callout",
        kind: "tip",
        title: "The habit that outlasts every command on this page",
        text: "Before you type, ask <em>which layer owns this question</em>, and reach for the lowest tool that can actually answer it. Most wasted debugging time comes from asking the wrong layer: <code>free</code> cannot explain an OOM kill, <code>df</code> cannot explain a full disk, <code>curl</code> cannot explain a DNS failure, and a <code>systemctl restart</code> cannot explain anything at all. Each of those has exactly one layer above it that can — and that layer is always the one worth reading next."
      }
    ],
    takeaways: [
      "<strong>State, duration, log.</strong> <code>systemctl status</code>, <code>systemctl show -p</code> and <code>journalctl -u -b</code> answer nearly every service question.",
      "Refused / timed out / no-route distinguishes process problems from path problems from local ones — and costs nothing to check.",
      "Use <code>-b</code> and <code>-b -1</code>. Half of all wasted debugging is reading yesterday's failure and wondering why it does not match.",
      "<code>df -h</code> lies about deleted-open files; <code>df -i</code> catches the inode-exhaustion variant; <code>du -x</code> stops the double-counting.",
      "<code>set -euo pipefail</code>, <code>trap</code>, <code>--</code>, <code>-print0 | xargs -0</code> and a parser instead of a regex: the five habits that make shell scripts correct.",
      "The kernel speaks first. <code>journalctl -k -b</code> and <code>/proc/pressure/*</code> know about the problem before any service log does.",
      "When something works by hand but not under systemd, diff the contexts: <strong>User, Group, WorkingDirectory, Environment, UMask</strong>."
    ],
    glossary: {
      "pipefail": "set -o pipefail — make a pipeline fail if any component fails, not just the last. Essential when piping into head or grep.",
      "-print0 / xargs -0": "Null-separated file lists. The only safe way to process filenames containing spaces, quotes or newlines.",
      "trap ... EXIT": "Register cleanup that runs on any exit path, including errors. Makes a script idempotent instead of debris-generating.",
      "--": "End of options. Everything after it is a filename, even if it starts with a dash or looks like a flag.",
      "command substitution": "$(cmd) — capture stdout into a variable. Use \"$(...)\" quoted; never eval the result.",
      "effective configuration": "What a program would actually do, as opposed to what a file says: sshd -T, systemctl show -p, nginx -T, iptables-save.",
      "blast radius": "How much a fix disturbs. Check it before acting: TimeoutStopSec, KillMode, maxUnavailable, drain behaviour."
    }
  });
})();