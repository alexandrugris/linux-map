/* ch13 — Containers and containerd, behind the scenes */
(function () {
  LX.push({
    id: "containers",
    title: "Containers and containerd, behind the scenes",
    tagline: "A container is a rootfs, some namespaces, a cgroup and a credential profile. containerd is the daemon that assembles those four things from an image and a config, on behalf of whatever asked — Kubernetes, Docker, or you.",
    sections: [
      {
        type: "prose",
        h: "“A container is just a process” — true, and useless",
        p: [
          "Every container really is a Linux process. That is not a simplification, it is exactly what is true. But “process” describes what it is, not what it does, and the whole point is what the runtime does to that process before and around it.",
          "The four things turn a process into a container. It gets <strong>a root filesystem of its own</strong>, assembled from read-only image layers with an overlay on top. It gets <strong>its own namespaces</strong>, so the PIDs, mounts, network interfaces, hostname and IPC objects it sees are copies rather than the global ones. It gets <strong>a cgroup</strong>, so the kernel accounts and bounds what it consumes. And it gets <strong>a credential profile</strong> — a specific set of capabilities, a seccomp filter, possibly an LSM profile — that determines what it is even allowed to attempt.",
          "Remove any one of those and you have something much less interesting: without namespaces it can see and interfere with everything else; without cgroups one process can exhaust the host; without a rootfs it is just a process with no files. There is no fifth thing, and there is no hypervisor hiding underneath. Chapter 04 covers each mechanism; this chapter covers the machinery that assembles them, which is where containerd lives."
        ]
      },
      {
        type: "diagram",
        h: "The four layers, and what each one actually does",
        caption: "Left column: what exists. Right column: what is hidden or bounded, which is the part people miss. <b>Namespaces hide; cgroups bound; the rootfs isolates files; the credential profile restricts behaviour.</b> Note the bottom row: what stays shared with the host, no matter how many containers you run.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="The four layers that make a container, and what each hides or bounds">
  <text class="t-title" x="30" y="30">what it is</text>
  <text class="t-title" x="600" y="30">what it does about it</text>

  <rect class="box-a" x="30" y="46" width="530" height="86" rx="10"/>
  <text class="t-accent" x="48" y="72" font-size="15">1 · root filesystem</text>
  <text class="t-xs" x="48" y="92">an overlayfs mount: read-only image layers + one writable</text>
  <text class="t-xs" x="48" y="110">layer that is thrown away when the container is removed</text>
  <text class="t-xs" x="48" y="126">→ it sees its image and nothing else, unless a path is bind-mounted in</text>

  <rect class="box-a" x="600" y="46" width="470" height="86" rx="10"/>
  <text class="t-sm" x="618" y="72">mount namespace + the mount table</text>
  <text class="t-xs" x="618" y="92">its / is not your /. Bind mounts, /proc, /sys, /dev are</text>
  <text class="t-xs" x="618" y="110">explicitly re-shared by the runtime — every one is a</text>
  <text class="t-xs" x="618" y="126">decision someone made in a config file</text>

  <rect class="box-v" x="30" y="146" width="530" height="86" rx="10"/>
  <text class="t-violet" x="48" y="172" font-size="15">2 · namespaces</text>
  <text class="t-xs" x="48" y="192">pid · mnt · net · uts · ipc · user · cgroup · time</text>
  <text class="t-xs" x="48" y="210">each one is a private copy of a kernel global; PID 1 inside</text>
  <text class="t-xs" x="48" y="226">is a real process that merely has the number 1</text>

  <rect class="box-v" x="600" y="146" width="470" height="86" rx="10"/>
  <text class="t-sm" x="618" y="172">what is hidden</text>
  <text class="t-xs" x="618" y="192">other processes · other mounts · other interfaces · other</text>
  <text class="t-xs" x="618" y="210">hostnames · other IPC objects · other UIDs</text>
  <text class="t-xs" x="618" y="226">what is NOT hidden: the kernel, the clock, the page cache</text>

  <rect class="box-ok" x="30" y="246" width="530" height="86" rx="10"/>
  <text class="t-ok" x="48" y="272" font-size="15">3 · cgroup</text>
  <text class="t-xs" x="48" y="292">a directory in a kernel-managed hierarchy where every task's</text>
  <text class="t-xs" x="48" y="310">memory, CPU, PID count and IO are accounted, and bounded</text>
  <text class="t-xs" x="48" y="326">enforced at allocation time by the kernel, not by trust</text>

  <rect class="box-ok" x="600" y="246" width="470" height="86" rx="10"/>
  <text class="t-sm" x="618" y="272">what is bounded</text>
  <text class="t-xs" x="618" y="292">memory.max · cpu.max · pids.max · io.max</text>
  <text class="t-xs" x="618" y="310">exceeding memory.max means ENOMEM from the kernel; exceeding</text>
  <text class="t-xs" x="618" y="326">pids.max means fork fails — not a hang, an error</text>

  <rect class="box-p" x="30" y="346" width="530" height="86" rx="10"/>
  <text class="t-bad" x="48" y="372" font-size="15">4 · credential profile</text>
  <text class="t-xs" x="48" y="392">a specific capability set, a seccomp BPF filter, an optional</text>
  <text class="t-xs" x="48" y="410">AppArmor/SELinux profile, noNewPrivileges, maskedPaths</text>
  <text class="t-xs" x="48" y="426">→ what the process may attempt, as opposed to what it can see</text>

  <rect class="box-p" x="600" y="346" width="470" height="86" rx="10"/>
  <text class="t-sm" x="618" y="372">what is refused</text>
  <text class="t-xs" x="618" y="392">the Docker default keeps 14 capabilities and drops the rest,</text>
  <text class="t-xs" x="618" y="410">blocks ~44 syscalls with seccomp, and hides /proc/kcore,</text>
  <text class="t-xs" x="618" y="426">/sys/firmware, /proc/acpi under maskedPaths</text>

  <rect class="box-b" x="30" y="446" width="1040" height="98" rx="10"/>
  <text class="t-bad" x="48" y="470" font-size="15">What stays shared with the host — the honest cost</text>
  <text class="t-sm" x="48" y="494">The kernel and its bugs · the wall clock (a container cannot lie about time) · the page cache (shared, which is both a performance win and a side channel) · every device node you chose to expose</text>
  <text class="t-sm" x="48" y="514">The host's storage underneath · the host's network stack doing the routing · the host's page tables doing the work.</text>
  <text class="t-xs" x="48" y="534">For application packaging and running your own code, this is a non-issue. For genuinely hostile multi-tenant code, it is the entire risk — and the answer is a VM, not a better container configuration.</text>
</svg>`
      },
      {
        type: "prose",
        h: "The image: layers, digests, and why pulling is unpacking",
        p: [
          "An OCI image is not a disk image and not a tarball. It is a <strong>content-addressed list of blobs</strong>: a manifest describing which layers make up the root filesystem, a config JSON describing how to run it, and each layer compressed and named by the SHA-256 of its own contents. The naming matters enormously — it means an image is verifiable, cacheable and immutable without trusting a registry, because the digest <em>is</em> the identity.",
          "Because the manifest names layers by digest, layers are shared between images. Ten images based on the same base share the base layer once on disk. When you <code>docker pull</code> a slightly different build, only the changed top layer arrives. This is the whole reason image size behaves the way it does, and the reason “why is my 40 MB app 1.2 GB” has a mechanical answer rather than a philosophical one.",
          "<strong>Pulling is not starting.</strong> Pull = verify digests, download blobs into the content store, then <em>unpack</em> each layer into a snapshot in the snapshotter. Unpacking a layer means untarring it and applying the diff operations it contains — create, delete, rename, change permissions — into an overlayfs snapshot directory. Nothing has run yet. Only after that does the runtime create the container and process."
        ]
      },
      {
        type: "diagram",
        h: "Pull → unpack → run: what actually happens",
        caption: "Follow the three stores. The <b>content store</b> holds compressed blobs by digest (shared between images, deduplicated). The <b>snapshotter</b> holds unpacked filesystem trees (also shared, via overlay lowerdirs). The <b>metadata store</b> holds the graph of which blobs, which snapshots and which containers belong together. Note that the writable layer is created only at step 6, and deleted when the container is.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Image pull, unpack and container start pipeline">
  <rect class="box-a" x="30" y="24" width="200" height="72" rx="9"/>
  <text class="t-accent" x="48" y="48" font-size="14.5">registry</text>
  <text class="t-xs" x="48" y="68">manifest + config + layers,</text>
  <text class="t-xs" x="48" y="84">each addressed by sha256</text>
  <path class="ln-a" d="M230,60 L286,60" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="232" y="52">digest</text>

  <rect class="box-v" x="286" y="24" width="300" height="72" rx="9"/>
  <text class="t-violet" x="304" y="48" font-size="14.5">content store</text>
  <text class="t-xs" x="304" y="68">/var/lib/containerd/io.containerd.</text>
  <text class="t-xs" x="304" y="84">content.v1.content/blobs/sha256/&lt;digest&gt;</text>
  <text class="t-xs" x="304" y="100">compressed, deduplicated, verified</text>

  <path class="ln-a" d="M586,60 L642,60" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="588" y="52">unpack</text>

  <rect class="box-ok" x="642" y="24" width="428" height="72" rx="9"/>
  <text class="t-ok" x="660" y="48" font-size="14.5">snapshotter (overlayfs)</text>
  <text class="t-xs" x="660" y="68">/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/&lt;id&gt;/fs</text>
  <text class="t-xs" x="660" y="84">each layer becomes one snapshot; only the top one is writable</text>
  <text class="t-xs" x="660" y="100">a container's rootfs is an overlay of all of them</text>

  <path class="ln-a" d="M856,96 L856,136" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-b" x="286" y="136" width="784" height="88" rx="10"/>
  <text class="t-bad" x="304" y="160" font-size="15">the OCI runtime spec — one config.json per container, written at create time</text>
  <text class="t-xs" x="304" y="182">process (args, env, cwd, user, capabilities, rlimits, noNewPrivileges, apparmorProfile)</text>
  <text class="t-xs" x="304" y="200">root (path: overlay merged; readonly) · mounts · hostname · annotations</text>
  <text class="t-xs" x="304" y="218">linux.namespaces (pid, mnt, net, uts, ipc, cgroup, user) · linux.cgroupsPath · linux.resources · seccomp · maskedPaths</text>

  <path class="ln-a" d="M430,224 L430,262" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M900,224 L900,262" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="286" y="262" width="290" height="88" rx="10"/>
  <text class="t-accent" x="304" y="286" font-size="14.5">runc create</text>
  <text class="t-xs" x="304" y="308">reads config.json, creates the</text>
  <text class="t-xs" x="304" y="324">namespaces, writes the cgroup,</text>
  <text class="t-xs" x="304" y="342">forks the process — stopped</text>

  <rect class="box-p" x="800" y="262" width="270" height="88" rx="10"/>
  <text class="t-bad" x="818" y="286" font-size="14.5">runc start</text>
  <text class="t-xs" x="818" y="308">releases the process to run</text>
  <text class="t-xs" x="818" y="324">its entrypoint, and from that</text>
  <text class="t-xs" x="818" y="342">moment it is just an ordinary process</text>

  <rect class="box" x="30" y="262" width="230" height="88" rx="10"/>
  <text x="48" y="286" font-size="14.5">metadata store</text>
  <text class="t-xs" x="48" y="308">/var/lib/containerd/</text>
  <text class="t-xs" x="48" y="324">io.containerd.metadata.v1.bolt/meta.db</text>
  <text class="t-xs" x="48" y="342">images ↔ containers ↔ snapshots</text>

  <rect class="box-w" x="30" y="376" width="1040" height="98" rx="10"/>
  <text class="t-warn" x="48" y="400" font-size="15">the overlay, concretely — what a container's filesystem is</text>
  <text class="t-xs" x="48" y="424">/var/lib/containerd/…/snapshots/12/fs    lowerdir  ← base image layer (read-only, shared by every container from it)</text>
  <text class="t-xs" x="48" y="444">/var/lib/containerd/…/snapshots/47/fs    upperdir  ← this container's writable layer (new, empty, discarded on removal)</text>
  <text class="t-xs" x="48" y="462">/var/lib/containerd/…/snapshots/48/fs    workdir   ← same filesystem as upperdir, used atomically for renames and whiteouts</text>
  <text class="t-xs" x="48" y="486">Deleting a file inside the container creates a character device with major:minor 0:0 — a <tspan font-weight="700">whiteout</tspan> — in the upper layer, hiding the entry below. Deleting a whole directory adds an <tspan font-weight="700">opaque</tspan> xattr. That is why image layers stay pristine and why container filesystems are additive, never destructive.</text>

  <rect class="box-ok" x="30" y="500" width="1040" height="106" rx="10"/>
  <text class="t-ok" x="48" y="524" font-size="15">The three words that make containerd make sense</text>
  <text class="t-sm" x="48" y="548"><tspan font-weight="700">Image</tspan> — content, addressable by digest. Present in the content store and unpacked into snapshots. Inert.        <tspan font-weight="700">Container</tspan> — a recorded <tspan font-style="italic">configuration</tspan>: which image, which mounts, which namespaces, which cgroup.</text>
  <text class="t-sm" x="48" y="570"><tspan font-weight="700">Task</tspan> — a <tspan font-style="italic">running</tspan> container: the process tree, the namespaces, the cgroup membership, as seen by the runtime. One container can be created and stopped many times; each run is a task.</text>
  <text class="t-xs" x="48" y="594">Nearly every confusing containerd problem is one of these three being confused for another: “the image is there but the container will not start” is a snapshot problem, “the container exists but nothing runs” is a missing task,</text>
  <text class="t-xs" x="48" y="600" font-size="1"></text>
  <text class="t-xs" x="48" y="598">and ctr containers ls versus ctr tasks ls is the command that tells them apart in one second.</text>
</svg>`
      },
      {
        type: "prose",
        h: "containerd: the daemon you never configure",
        p: [
          "containerd is a daemon that exposes a gRPC API on a Unix socket and implements the container lifecycle as a graph of resources. It is deliberately small and deliberately boring: it has no opinions about networking, no concept of a pod, no scheduler, and (unlike Docker) no opinion about which UI should drive it. That is why Kubernetes adopted it and why the same daemon serves Docker's <code>moby</code> namespace too.",
          "Its internals are four stores, and knowing which store owns which question explains most of its errors. The <strong>content store</strong> is a content-addressed blob store — it knows about digests and sizes and nothing else. The <strong>metadata store</strong> is a BoltDB key-value database holding the actual object graph: images, containers, tasks, leases, and the relationships between them. The <strong>snapshotter</strong> is a pluggable filesystem driver (overlayfs, native, devmapper, btrfs, zfs) that knows how to turn content into filesystem trees. The <strong>runtime</strong> layer knows how to make processes happen, and it is split into <code>runtime.v1</code> and <code>runtime.v2</code>, the latter being the one everything uses now.",
          "The <strong>shim</strong> is the detail that explains a surprising amount of container behaviour. Before starting a task, containerd forks a small per-task process — <code>containerd-shim-runc-v2</code> — which becomes the parent of the container's processes and holds the channel to runc. The shim exists so that <strong>a running container survives containerd restarting</strong>: if you restart containerd or even upgrade it, it reconnects to the shims and rediscovers the running tasks, instead of killing everything. It is also why killing containerd with <code>SIGKILL</code> does not stop your containers, and why you sometimes have to stop the shims instead.",
          "Everything is scoped by <strong>namespace</strong>. Docker's containers live in <code>moby</code>, Kubernetes pods live in <code>k8s.io</code>, and hand-driven experiments live in <code>default</code>. They share the same content store and the same snapshots — which is why a Kubernetes node can pull an image once and have several runtimes use it — but they cannot see each other's containers. That is why <code>docker ps</code> can be empty on a node that is running forty pods, and it is not a bug."
        ]
      },
      {
        type: "diagram",
        h: "containerd's anatomy, with every socket and path",
        caption: "Three clients, one daemon, two of them speaking the <b>CRI</b> rather than the native API. The plugin names at the bottom are what you will see in <code>ctr plugins ls</code>, and the paths are what you will see when a container refuses to start and you go looking on disk. Everything privileged on this diagram runs as <b>root</b> — this is the same attack surface chapter 04 described.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="containerd architecture with clients, plugins, stores and shims">
  <text class="t-title" x="30" y="28">clients — three of them, speaking two protocols</text>

  <rect class="box-a" x="30" y="42" width="240" height="62" rx="9"/>
  <text class="t-accent" x="48" y="66" font-size="14.5">kubelet</text>
  <text class="t-xs" x="48" y="84">via the <tspan font-weight="700">CRI</tspan> plugin, never the native API</text>
  <text class="t-xs" x="48" y="98">io.containerd.grpc.v1.cri</text>

  <rect class="box-p" x="290" y="42" width="240" height="62" rx="9"/>
  <text class="t-bad" x="308" y="66" font-size="14.5">dockerd</text>
  <text class="t-xs" x="308" y="84">also via CRI now, or native</text>
  <text class="t-xs" x="308" y="98">namespace: moby</text>

  <rect class="box" x="550" y="42" width="240" height="62" rx="9"/>
  <text x="568" y="66" font-size="14.5">nerdctl / ctr</text>
  <text class="t-xs" x="568" y="84">native gRPC, direct</text>
  <text class="t-xs" x="568" y="98">namespace: default</text>

  <rect class="box-ok" x="810" y="42" width="260" height="62" rx="9"/>
  <text class="t-ok" x="828" y="66" font-size="14.5">containerd</text>
  <text class="t-xs" x="828" y="84">systemd unit, runs as root</text>
  <text class="t-xs" x="828" y="98">/run/containerd/containerd.sock</text>

  <path class="ln" d="M150,104 L150,140" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M410,104 L410,140" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M670,104 L670,140" marker-end="url(#lm-arrow)"/>
  <path class="ln" d="M940,104 L940,140" marker-end="url(#lm-arrow)"/>

  <text class="t-title" x="30" y="140">containerd plugins — every one of these is a gRPC service on the same socket, namespaced by URL path</text>

  <rect class="box-w" x="30" y="156" width="330" height="76" rx="9"/>
  <text class="t-warn" x="48" y="180" font-size="14.5">io.containerd.grpc.v1.cri</text>
  <text class="t-xs" x="48" y="200">ImageService + RuntimeService. Translates CRI verbs</text>
  <text class="t-xs" x="48" y="218">into containerd objects. This is what kubelet calls.</text>

  <rect class="box-v" x="380" y="156" width="330" height="76" rx="9"/>
  <text class="t-violet" x="398" y="180" font-size="14.5">content + metadata + snapshotter</text>
  <text class="t-xs" x="398" y="200">the three stores: blobs by digest, the object graph,</text>
  <text class="t-xs" x="398" y="218">and the filesystem trees the snapshots live in</text>

  <rect class="box-a" x="730" y="156" width="340" height="76" rx="9"/>
  <text class="t-accent" x="748" y="180" font-size="14.5">runtime.v2 → shim → runc</text>
  <text class="t-xs" x="748" y="200">forks one shim per task, which forks runc, which</text>
  <text class="t-xs" x="748" y="218">sets up the namespaces, cgroup and rootfs, then execs</text>

  <path class="ln-b" d="M195,232 L195,268" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="30" y="268" width="330" height="86" rx="10"/>
  <text class="t-bad" x="48" y="292" font-size="14">on disk</text>
  <text class="t-xs" x="48" y="312">/var/lib/containerd/</text>
  <text class="t-xs" x="48" y="330">  io.containerd.content.v1.content/blobs/sha256/</text>
  <text class="t-xs" x="48" y="346">  io.containerd.metadata.v1.bolt/meta.db</text>

  <path class="ln-v" d="M545,232 L545,268" marker-end="url(#lm-arrow)"/>
  <rect class="box" x="380" y="268" width="330" height="86" rx="10"/>
  <text x="398" y="292" font-size="14">on disk</text>
  <text class="t-xs" x="398" y="312">io.containerd.snapshotter.v1.overlayfs/</text>
  <text class="t-xs" x="398" y="330">  snapshots/&lt;id&gt;/fs   ← lower / upper / work</text>
  <text class="t-xs" x="398" y="346">plus whatever bind mounts were resolved</text>

  <path class="ln-a" d="M900,232 L900,268" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-p" x="730" y="268" width="340" height="86" rx="10"/>
  <text class="t-bad" x="748" y="292" font-size="14">on disk — the OCI bundle</text>
  <text class="t-xs" x="748" y="312">/run/containerd/io.containerd.runtime.v2.task/</text>
  <text class="t-xs" x="748" y="330">  &lt;namespace&gt;/&lt;id&gt;/config.json  ← the spec</text>
  <text class="t-xs" x="748" y="346">plus the shim's socket and its address file</text>

  <path class="ln-a" d="M900,354 L900,392" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="730" y="392" width="340" height="80" rx="10"/>
  <text class="t-accent" x="748" y="416" font-size="14">runc create → runc start</text>
  <text class="t-xs" x="748" y="436">unshare(CLONE_NEWNS|NEWPID|NEWNET|NEWUTS|NEWIPC)</text>
  <text class="t-xs" x="748" y="452">pivot_root into the overlay, set rlimits, exec</text>

  <rect class="box-w" x="30" y="392" width="680" height="80" rx="10"/>
  <text class="t-warn" x="48" y="416" font-size="14">why the shim exists — the single most useful thing to know about containerd</text>
  <text class="t-xs" x="48" y="436">The shim becomes the parent of the container's processes. containerd restarting, crashing, or being upgraded does NOT kill the containers — it</text>
  <text class="t-xs" x="48" y="454">reconnects to the shims and rediscovers the tasks. That is why kill -9 containerd leaves your pods running, and why a “stopped” containerd may need</text>
  <text class="t-xs" x="48" y="468">the shims stopped too: pkill -f containerd-shim is a last resort that will bring everything down.</text>

  <rect class="box-a" x="30" y="492" width="330" height="96" rx="10"/>
  <text class="t-accent" x="48" y="516" font-size="14">namespaces, all of them</text>
  <text class="t-xs" x="48" y="538">default — nerdctl and ctr</text>
  <text class="t-xs" x="48" y="556">moby — Docker's containers</text>
  <text class="t-xs" x="48" y="574">k8s.io — Kubernetes pods</text>

  <rect class="box-v" x="380" y="492" width="330" height="96" rx="10"/>
  <text class="t-violet" x="398" y="516" font-size="14">where the data actually goes</text>
  <text class="t-xs" x="398" y="538">images share blobs and snapshots</text>
  <text class="t-xs" x="398" y="556">container writable layers are deleted</text>
  <text class="t-xs" x="398" y="574">volumes do not live here — they are bind mounts</text>

  <rect class="box-b" x="730" y="492" width="340" height="96" rx="10"/>
  <text class="t-bad" x="748" y="516" font-size="14">on a small server</text>
  <text class="t-xs" x="748" y="538">/var/lib/containerd is the usual space thief:</text>
  <text class="t-xs" x="748" y="556">images + every dead container's upper layer</text>
  <text class="t-xs" x="748" y="574">prune it, or it will fill a 19 GB disk</text>

  <rect class="box-ok" x="30" y="604" width="1040" height="82" rx="10"/>
  <text class="t-ok" x="48" y="628" font-size="14">Three clients, one daemon — and this is why your tooling will disagree</text>
  <text class="t-xs" x="48" y="650">docker ps asks dockerd, which looks in the <tspan font-weight="700">moby</tspan> namespace. nerdctl ps asks containerd in the <tspan font-weight="700">default</tspan> namespace. crictl ps speaks <tspan font-weight="700">CRI</tspan> and sees the <tspan font-weight="700">k8s.io</tspan> namespace. All three are correct, and on a Kubernetes node all three can show completely different, simultaneously valid lists.</text>
  <text class="t-xs" x="48" y="672">When a Kubernetes pod will not start and docker ps shows nothing, nothing is wrong. You are looking in the wrong namespace — use crictl.</text>
</svg>`
      },
      {
        type: "prose",
        h: "CRI: the contract that lets Kubernetes stop caring about runtimes",
        p: [
          "CRI — the Container Runtime Interface — is a gRPC API that lets kubelet drive <em>any</em> runtime. CRI-O, containerd's <code>cri</code> plugin, and (historically) dockershim are all interchangeable from the kubelet's point of view. That is a bigger architectural win than it sounds: Kubernetes stopped depending on Docker in 2018, and the runtime became replaceable infrastructure.",
          "The distinction to take away is <strong>sandbox versus container</strong>. CRI has a <code>RunPodSandbox</code> call, separate from <code>CreateContainer</code>, and it is not a stylistic choice. The sandbox is the pod's shared world: it owns the network namespace, the IPC namespace, the hostname file, the cgroup parent, and it is represented by a long-lived <strong>pause container</strong> whose only job is to hold those namespaces open. Every application container is then created into that same sandbox, with its own mount namespace, its own rootfs and its own cgroup.",
          "That design is why sidecars work. Two containers in one pod share a network namespace, so a sidecar listening on <code>localhost:9000</code> is reachable by the app container and by nothing else in the cluster. It is also why a pod with a broken sidecar still has working DNS and still gets its IP — the sandbox is fine, one container inside it is not.",
          "And it is why “a Pod” is not a container. Kubernetes chose pods to model <em>co-scheduled, co-located, mutually-reachable things</em>. If you find yourself wanting three containers in one pod for no reason other than saving memory, a Deployment with three containers in one image, or a sidecar that is really just a second process, is usually the better answer."
        ]
      },
      {
        type: "diagram",
        h: "A Kubernetes pod, from kubelet to namespaces",
        caption: "Note the ordering: <b>sandbox first, then CNI, then containers.</b> The sandbox has to exist so there is a network namespace to give to CNI, and CNI has to finish before the containers start or they will have no network. The pause container is not optional and not decoration — it is what keeps the namespace alive after the last real container exits.",
        svg: `
<svg viewBox="0 0 1100 620" role="img" aria-label="Kubernetes pod startup through CRI, containerd, CNI and runc">
  <rect class="box-v" x="30" y="24" width="200" height="56" rx="9"/>
  <text class="t-violet" x="48" y="46" font-size="14.5">kubelet</text>
  <text class="t-xs" x="48" y="64">runs on the node, as root</text>
  <text class="t-xs" x="48" y="76">sees the pod assigned to it</text>

  <path class="ln-a" d="M230,52 L286,52" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="232" y="44" font-size="12.5">CRI: RunPodSandbox</text>

  <rect class="box-a" x="286" y="24" width="330" height="56" rx="9"/>
  <text class="t-accent" x="304" y="46" font-size="14.5">containerd → cri plugin → shim → runc</text>
  <text class="t-xs" x="304" y="64">creates the <tspan font-weight="700">pause</tspan> container with pid, mount, ipc, uts</text>
  <text class="t-xs" x="304" y="76">namespaces and the pod's cgroup parent</text>

  <path class="ln-v" d="M616,52 L672,52" marker-end="url(#lm-arrow)"/>

  <rect class="box-v" x="672" y="24" width="398" height="56" rx="9"/>
  <text class="t-violet" x="690" y="46" font-size="14.5">the sandbox now exists and holds namespaces open</text>
  <text class="t-xs" x="690" y="64">its netns has only lo, down. No IP yet — and nothing can</text>
  <text class="t-xs" x="690" y="76">work without one, which is why the next step must happen.</text>

  <path class="ln-w" d="M616,80 L616,124" marker-end="url(#lm-arrow-warn)"/>
  <text class="t-warn" x="624" y="106" font-size="12.5">CNI ADD</text>

  <rect class="box-w" x="286" y="124" width="784" height="96" rx="10"/>
  <text class="t-warn" x="304" y="148" font-size="14.5">CNI plugin — a binary invoked from /opt/cni/bin, configured by /etc/cni/net.d/*.conflist</text>
  <text class="t-xs" x="304" y="170">Called with CNI_COMMAND=ADD, CNI_CONTAINERID, CNI_NETNS=/proc/&lt;pid&gt;/ns/net, CNI_IFNAME, CNI_PATH. It may be a</text>
  <text class="t-xs" x="304" y="188">chained plugin list: bridge → host-local IPAM → portmap. It returns JSON; the IP it chose becomes the pod IP.</text>
  <text class="t-xs" x="304" y="208">Then kubelet calls CRI UpdatePodSandbox with that IP, and CoreDNS/ClusterIP routing becomes meaningful.</text>

  <path class="ln-a" d="M616,220 L616,258" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="624" y="244" font-size="12.5">CRI: CreateContainer × N → StartContainer × N</text>

  <rect class="box-p" x="30" y="258" width="1040" height="120" rx="10"/>
  <text class="t-bad" x="48" y="282" font-size="15">each container joins the sandbox, then diverges from it in exactly three ways</text>
  <text class="t-xs" x="48" y="306">shares: the network namespace (same localhost, same IP) · the IPC namespace · the hostname · the pod cgroup as parent</text>
  <text class="t-xs" x="48" y="326">own: a <tspan font-weight="700">mount namespace</tspan> (its own /, its own volumes, its own /proc) · its <tspan font-weight="700">own rootfs</tspan> (overlay on the image) · its <tspan font-weight="700">own cgroup</tspan> for requests and limits</text>
  <text class="t-xs" x="48" y="350">mounts from the pod spec land in every container's mount namespace — that is how a shared volume works without any process knowing about it</text>
  <text class="t-xs" x="48" y="370">the container's spec is still written by containerd to /run/containerd/io.containerd.runtime.v2.task/k8s.io/&lt;id&gt;/config.json</text>

  <path class="ln-a" d="M620,378 L620,414" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="30" y="414" width="1040" height="70" rx="10"/>
  <text class="t-ok" x="48" y="438" font-size="15">probes begin, and they are three different questions</text>
  <text class="t-xs" x="48" y="460">liveness → “is this process wedged?” failure RESTARTS the container.  readiness → “can it serve?” failure only removes it from the EndpointSlice.</text>
  <text class="t-xs" x="48" y="478">startup → “has it finished booting?” suppresses the other two until it succeeds. Liveness must never probe a dependency, or a dependency outage becomes a cluster-wide restart storm.</text>

  <rect class="box-b" x="30" y="500" width="500" height="106" rx="10"/>
  <text class="t-bad" x="48" y="524" font-size="14">the pause container is load-bearing</text>
  <text class="t-xs" x="48" y="546">It holds the namespaces open for the pod's lifetime. If the sandbox dies, every</text>
  <text class="t-xs" x="48" y="564">container in the pod loses its network and is torn down. Some runtimes replace it</text>
  <text class="t-xs" x="48" y="582">with a minimal pivot_root-only process, but the role is identical.</text>
  <text class="t-xs" x="48" y="600">Containers do not talk to each other through the pod IP; they talk over localhost.</text>

  <rect class="box-a" x="550" y="500" width="520" height="106" rx="10"/>
  <text class="t-accent" x="568" y="524" font-size="14">when a pod will not start, ask in this order</text>
  <text class="t-xs" x="568" y="546">1. crictl pods — does the sandbox exist? no → CNI or kubelet</text>
  <text class="t-xs" x="568" y="564">2. crictl ps -a — do the containers exist? no → image or config</text>
  <text class="t-xs" x="568" y="582">3. crictl inspectp &lt;sandbox&gt; — namespaces, limits, log path</text>
  <text class="t-xs" x="568" y="600">4. journalctl -u kubelet -f and journalctl -u containerd -f on the node</text>
</svg>`
      },
      {
        type: "prose",
        h: "Container networking: a bridge, a pair of cables, and a NAT rule",
        p: [
          "The default container network is a Linux bridge on the host with one end of a virtual pair plugged into it and the other end moved into the container's network namespace. A veth pair is literally a cable: one end in the host bridge, the other inside the container, where the kernel renames it to <code>eth0</code>. Nothing clever is happening — no virtual switch, no hypervisor.",
          "On the host, the bridge (traditionally <code>docker0</code>, now usually a CNI-managed bridge per network) has an address from a private range, which is why containers get addresses like <code>172.17.0.2</code> by default. The host routes to that bridge and masquerades traffic leaving it, because those addresses are not routable on the internet. Containers reaching each other over that bridge do so directly at layer 2 — no NAT, which is why it is fast.",
          "<strong>Publishing a port</strong> is the interesting one, because it is not a proxy. <code>-p 8080:80</code> installs a DNAT rule that rewrites any packet addressed to the host's port 8080 into a packet addressed to the container's IP on port 80, plus a masquerade rule for the return path. conntrack remembers the mapping, so subsequent packets of the same TCP connection are translated correctly and the container never sees the client's real address. No user-space proxy is involved, which is why published ports perform like native ports and why they also bypass most application-layer tooling.",
          "And this is the source of the single most confusing networking bug on Docker hosts. Those DNAT rules are installed in the <code>nat</code> table's <code>PREROUTING</code> and <code>OUTPUT</code> chains, in a chain called <code>DOCKER</code>, which is evaluated <strong>before</strong> your firewall's <code>INPUT</code> chain ever sees the packet. So a container's traffic can arrive at a port your ufw rules say is closed, and it is not a bug in ufw — it is the chain order. Chapter 09 draws the path and chapter 15 discusses the mitigation."
        ]
      },
      {
        type: "diagram",
        h: "A packet leaving a container",
        caption: "Follow one packet out to the internet. Container → veth → host bridge → routing decision → masquerade → host NIC. The masquerade step exists because <code>172.17.x</code> is not routable, so the source address has to become the host's. The same diagram with a published port works in reverse at the top: a DNAT rule rewrites the destination before any of this happens.",
        svg: `
<svg viewBox="0 0 1100 560" role="img" aria-label="Packet path from a container out to the internet">
  <rect class="box-p" x="30" y="24" width="250" height="76" rx="10"/>
  <text class="t-bad" x="48" y="48" font-size="14.5">container netns</text>
  <text class="t-xs" x="48" y="68">eth0 172.17.0.2/16</text>
  <text class="t-xs" x="48" y="86">default route → 172.17.0.1</text>

  <path class="ln-a" d="M280,62 L346,62" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="282" y="54">veth pair</text>

  <rect class="box" x="346" y="24" width="230" height="76" rx="10"/>
  <text x="364" y="48" font-size="14.5">host side of the veth</text>
  <text class="t-xs" x="364" y="68">one end on the bridge,</text>
  <text class="t-xs" x="364" y="86">one end inside the container</text>

  <path class="ln-a" d="M576,62 L642,62" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="642" y="24" width="230" height="76" rx="10"/>
  <text class="t-violet" x="660" y="48" font-size="14.5">docker0 / cni bridge</text>
  <text class="t-xs" x="660" y="68">layer 2 segment</text>
  <text class="t-xs" x="660" y="86">gateway 172.17.0.1</text>

  <path class="ln-a" d="M872,62 L938,62" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="874" y="54">POSTROUTING</text>

  <rect class="box-w" x="938" y="24" width="132" height="76" rx="10"/>
  <text class="t-warn" x="954" y="48" font-size="13.5">masquerade</text>
  <text class="t-xs" x="954" y="68">src becomes</text>
  <text class="t-xs" x="954" y="86">the host IP</text>

  <path class="ln-a" d="M1004,100 L1004,140" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-ok" x="700" y="140" width="370" height="66" rx="10"/>
  <text class="t-ok" x="718" y="164" font-size="14.5">out via eth0 / tailscale0 / any host interface</text>
  <text class="t-xs" x="718" y="184">policy routing decides, exactly as it does for any other host traffic</text>

  <rect class="box-b" x="30" y="140" width="640" height="66" rx="10"/>
  <text class="t-bad" x="48" y="164" font-size="14">the firewall trap — and why your rules seem to be ignored</text>
  <text class="t-xs" x="48" y="184">Container traffic crosses FORWARD, not INPUT. DNAT rules for published ports are installed in nat/PREROUTING</text>
  <text class="t-xs" x="48" y="200">before any filter rule runs, so ufw's INPUT policy never sees it. Mitigation lives in the DOCKER-USER chain (iptables) or nft's prerouting hook.</text>

  <rect class="box-w" x="30" y="226" width="1040" height="80" rx="10"/>
  <text class="t-warn" x="48" y="250" font-size="14">publishing a port: -p 8080:80 is a DNAT rule, not a proxy</text>
  <text class="t-xs" x="48" y="272">packets to host:8080 are rewritten to 172.17.0.2:80 by a rule in the nat table, and conntrack un-does the translation on the way back.</text>
  <text class="t-xs" x="48" y="292">Consequences worth knowing: the container sees the client's IP only if you use a proxy or a userspace proxy mode; nothing is filtered in userspace; and it is fast.</text>

  <rect class="box-a" x="30" y="326" width="500" height="120" rx="10"/>
  <text class="t-accent" x="48" y="350" font-size="14">How CNI actually gets invoked</text>
  <text class="t-xs" x="48" y="372">/etc/cni/net.d/10-conflist.conf — the chain, in order</text>
  <text class="t-xs" x="48" y="392">kubelet execs /opt/cni/bin/&lt;plugin&gt; with env vars:</text>
  <text class="t-xs" x="48" y="410">CNI_COMMAND=ADD, CNI_NETNS, CNI_CONTAINERID,</text>
  <text class="t-xs" x="48" y="428">CNI_IFNAME, CNI_PATH, plus stdin config JSON</text>
  <text class="t-xs" x="48" y="444">stdout must be a JSON result — kubelet reads podIP from it</text>

  <rect class="box-v" x="550" y="326" width="520" height="120" rx="10"/>
  <text class="t-violet" x="568" y="350" font-size="14">Why CNI is a plugin and not a daemon</text>
  <text class="t-xs" x="568" y="372">No long-running process, no state of its own, no port. The kubelet calls it once per</text>
  <text class="t-xs" x="568" y="392">sandbox with ADD and once per teardown with DEL, passing everything it needs in env</text>
  <text class="t-xs" x="568" y="412">vars and stdin. Consequences: swapping CNIs is a config file change plus a</text>
  <text class="t-xs" x="568" y="432">restart; different CNIs on the same cluster are entirely possible; and “the CNI is</text>
  <text class="t-xs" x="568" y="448">down” usually means a binary is missing rather than a service crashed.</text>

  <rect class="box-ok" x="30" y="466" width="1040" height="80" rx="10"/>
  <text class="t-ok" x="48" y="490" font-size="14">Storage is not part of CNI, and not part of the sandbox</text>
  <text class="t-xs" x="48" y="512">Volumes are bind mounts performed by the runtime into the container's mount namespace — a host path, a named volume, or a tmpfs. The sandbox owns</text>
  <text class="t-xs" x="48" y="532">networking and IPC; it has nothing to do with files. Which is why docker volume rm can delete data that a pod is still using.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Security: what you actually get by default",
        p: [
          "A default container is meaningfully more contained than a normal process, and the specifics are worth knowing because they are what a security review will ask about.",
          "It keeps about fourteen capabilities and drops everything else — including <code>CAP_SYS_ADMIN</code>, which is the one that matters. It applies <code>noNewPrivileges</code>, so no setuid binary inside can gain a privilege the container did not start with. It runs with the <strong>default seccomp profile</strong>, a BPF filter that blocks on the order of forty syscalls outright and blocks dangerous variants of many more — <code>mount</code>, <code>pivot_root</code>, <code>bpf</code>, <code>perf_event_open</code>, <code>userfaultfd</code>, and every architecture-specific syscall that does not exist on your CPU. And it masks dangerous paths by mounting over them empty: <code>/proc/kcore</code>, <code>/proc/sys</code>, <code>/proc/acpi</code>, <code>/sys/firmware</code>.",
          "<code>--privileged</code> disables all of that and adds the full capability set, which is functionally root on the host with a container-shaped interface. <code>CAP_SYS_ADMIN</code> alone gets you most of the way out, because with it you can create new namespaces and mount things. In Kubernetes the equivalent sins are <code>privileged: true</code>, <code>hostNetwork: true</code>, <code>hostPID: true</code>, <code>hostIPC: true</code>, and a <code>hostPath</code> volume of <code>/</code>. Each one is individually defensible in the right situation and collectively they mean “this pod is the host”.",
          "Rootless containers close the last gap: the container's uid 0 maps to an unprivileged uid on the host through a user namespace, so an escape lands as an ordinary user rather than as root. It costs you networking (a userspace stack such as slirp4netns) and some features. For running untrusted code, it changes the risk profile from “root on the node” to “a user on the node”, which is a very different conversation."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Driving containerd directly — the tool for when Docker is not there",
        code:
`# which view is this? CRI (what kubelet uses) is the right one on a Kubernetes node
crictl version
crictl pods -a
crictl ps -a
crictl images
crictl logs <container-id>
crictl inspectp <sandbox-id>          # namespaces, cgroups, log path, labels
crictl inspect <container-id>        # the OCI-ish spec the runtime was given
crictl events                         # live stream of everything happening

# containerd's own API, scoped by namespace
ctr version
ctr -n k8s.io namespaces ls
ctr -n k8s.io images ls
ctr -n k8s.io containers ls           # created
ctr -n k8s.io tasks ls                # running  ← containers without tasks explain a lot
ctr -n k8s.io snapshots ls
ctr -n k8s.io plugins ls              # which runtime/snapshotter/content plugins are loaded

# nerdctl: a Docker-compatible CLI straight on containerd, no daemon in between
nerdctl --namespace k8s.io ps -a
nerdctl run --rm -it alpine sh
nerdctl system df                    # what is using space, and where
nerdctl images prune
nerdctl system prune                 # careful: removes stopped containers and their layers

# enter a running container's namespaces without docker exec
pid=$(crictl inspectp <sandbox> | jq -r '.info.pid')
nsenter -t "$pid" -n -m -u -i -p -a -- sh
lsns -t pid,net -p "$pid"             # what namespaces the sandbox actually holds
readlink /proc/$pid/ns/net             # compare two sandboxes: different inode = isolated

# what did the runtime actually give it?
crictl inspect <container> | jq '.status.linux.resources, .config.linux.securityContext'
cat /proc/$pid/status | grep -E 'CapEff|CapBnd|Seccomp'
cat /sys/fs/cgroup/.../$pid/memory.max 2>/dev/null   # cgroup v2
cat /sys/fs/cgroup/.../$pid/memory/memory.limit_in_bytes 2>/dev/null   # cgroup v1

# space on a small machine
du -sh /var/lib/containerd/*
systemctl restart containerd          # safe: shims keep running containers alive
journalctl -u containerd -b -p warning --no-pager | tail -40`
      },
      {
        type: "callout",
        kind: "warn",
        title: "What containerd costs a 19 GB disk",
        text: "Every image layer, every stopped container's writable layer, and every extracted snapshot lives under <code>/var/lib/containerd</code>. On a small VPS the failure mode is boring and total: the disk fills with container state, writes start failing, journald cannot rotate, and suddenly nothing works — including the service you would use to fix it.<br><br>The discipline is three commands on a schedule: <code>nerdctl system df</code> to see, <code>nerdctl images prune</code> to reclaim unused images, and a monthly <code>nerdctl system prune</code> once you have verified what it will remove. On Kubernetes, the equivalent is <code>crictl rmi --prune</code> for unreferenced images — and a node with a disk-pressure condition will start evicting pods before it admits there is a problem."
      },
      {
        type: "callout",
        kind: "boss",
        title: "The five questions, in order, for anything container-related",
        text: "<b>1. Which namespace am I looking at?</b> <code>docker ps</code>, <code>nerdctl ps</code> and <code>crictl ps</code> show different, equally valid lists.<br><b>2. Does the container exist, and does the task exist?</b> A container with no task is configured but not running.<br><b>3. What did the runtime actually get?</b> <code>crictl inspect</code> and <code>/proc/&lt;pid&gt;/status</code> beat whatever the config file claims.<br><b>4. Which namespaces does it have, and which host resources did it keep?</b> <code>lsns</code> on the sandbox PID answers it in one line.<br><b>5. Where is it failing, host or runtime?</b> <code>journalctl -u containerd</code> and <code>journalctl -u kubelet</code> on the node — not <code>kubectl logs</code>, which cannot see either."
      }
    ],
    takeaways: [
      "A container is <strong>a rootfs + namespaces + a cgroup + a credential profile</strong>. Four things, no hypervisor, no fifth mechanism.",
      "<strong>Image, container, task</strong> are different objects. <code>ctr containers ls</code> versus <code>ctr tasks ls</code> settles most container confusion in one second.",
      "The content store holds blobs by digest; the snapshotter holds unpacked layers; the metadata store holds the graph. “Image exists but will not start” is a snapshot problem, not a content problem.",
      "The <strong>shim</strong> is why containers survive a containerd restart, and why killing containerd does not stop your pods.",
      "CRI separates <strong>RunPodSandbox</strong> from <code>CreateContainer</code> — that is why sidecars share a localhost, and why pods are not containers.",
      "Publishing a port is a <strong>DNAT rule plus conntrack</strong>, not a proxy — which is exactly why your firewall does not see it.",
      "Default containment is real: dropped <code>CAP_SYS_ADMIN</code>, a seccomp profile, <code>noNewPrivileges</code>, masked paths. <code>--privileged</code> removes all of it at once."
    ],
    glossary: {
      "containerd": "The container daemon that assembles rootfs, namespaces and cgroups. Used by Kubernetes and by Docker. systemd unit, gRPC on a Unix socket.",
      "runc": "The reference OCI runtime. Reads config.json, creates the namespaces, cgroup and rootfs, then execs the process.",
      "shim": "A per-task helper process that becomes the parent of a container's processes, so containers survive a containerd restart.",
      "CRI": "Container Runtime Interface — the gRPC API kubelet uses to drive any runtime, replacing a hard dependency on Docker.",
      "CRI-O": "A standalone container runtime implementing CRI. The alternative to containerd's built-in cri plugin.",
      "sandbox": "The pod-level CRI object owning the shared network and IPC namespaces, held open by a pause container.",
      "pause container": "A near-empty long-lived process whose only job is to keep the pod's namespaces from being destroyed.",
      "image / container / task": "Content (digest-addressed) / a recorded configuration / an actual running process tree. Three different objects.",
      "content store": "containerd's blob store, content-addressed by digest, deduplicated across images.",
      "snapshotter": "The pluggable filesystem driver turning content into directory trees. overlayfs is the default.",
      "overlayfs": "Multiple read-only lower layers plus one writable upper layer. Whiteouts (0:0 device nodes) record deletions.",
      "whiteout": "A character device 0:0 in an overlay upper layer, hiding a name that exists in a lower layer.",
      "veth": "A virtual ethernet pair. One end in the host bridge, one inside the container's network namespace, renamed eth0.",
      "CNI": "Container Network Interface — plugins invoked as binaries with ADD/DEL to build pod networking. No daemon, no port.",
      "conflist": "A CNI configuration file describing a chain of plugins and their settings, in /etc/cni/net.d/.",
      "IPAM": "IP Address Management — the plugin that assigns pod IPs, e.g. host-local or DHCP.",
      "containerd namespaces": "Scopes within containerd: k8s.io for Kubernetes, moby for Docker, default for nerdctl/ctr. They share stores but not containers.",
      "noNewPrivileges": "A flag making the process unable to gain privileges it did not start with — defeats setuid escalation inside the container.",
      "seccomp profile": "A BPF filter restricting which syscalls a process may make. The Docker/Kubernetes default blocks dozens outright.",
      "rootless container": "A container whose user namespace maps inside-root to an unprivileged host UID, so escapes land as a normal user.",
      "crictl": "The CRI client. What you want on a Kubernetes node instead of docker."
    }
  });
})();