/* ch14 — Kubernetes behind the scenes */
(function () {
  LX.push({
    id: "kubernetes",
    title: "Kubernetes behind the scenes",
    tagline: "A reconciliation engine over etcd, with an HTTP API in front and one agent on every node doing the actual work. Every feature you use is a loop; every bug is a loop that disagrees.",
    sections: [
      {
        type: "prose",
        h: "Strip away the marketing",
        p: [
          "Kubernetes is three things, in this order: a <strong>strongly-typed key-value store</strong> (etcd), an <strong>HTTP API</strong> in front of it that validates everything, and a <strong>set of reconciliation loops</strong> that read desired state from that API and write the world until it matches. That is the entire thing. Scheduling, self-healing, rolling updates, autoscaling and horizontal service discovery are all the same loop with a different comparison.",
          "So the mental model is: <em>someone declares intent into etcd, controllers compare intent to observed reality, and daemons on every node make reality match — then they all do it again, forever.</em> Nothing is ever “set”. Everything is being reconciled. That single sentence explains almost every Kubernetes behaviour you will find surprising: why deleting a Replica does nothing (the controller recreates it), why a pod can be <code>Running</code> and still not receive traffic, why the same YAML applied twice is fine, and why a broken cluster is always busy — every loop is retrying something.",
          "And the honest counterweight: Kubernetes is a huge amount of machinery to solve a problem that is fundamentally <em>“run this container on a machine in this cluster, and if it dies, run it again”</em>. On a single server, systemd already does the “run it again” half for free. Chapter 16 covers when a cluster is the wrong answer."
        ]
      },
      {
        type: "diagram",
        h: "The whole system on one node",
        caption: "Everything above the thick line is stateless and scalable — you can run three or five apiservers. Everything below it is per-node, runs with <b>root</b>, and is where the cluster actually touches your Linux machine. Note which components are privileged: kube-proxy, the CNI plugin, kubelet, and the runtime. That set is your real attack surface, and it is the same surface chapter 04 describes.",
        svg: `
<svg viewBox="0 0 1100 740" role="img" aria-label="Kubernetes control plane and node components">
  <text class="t-title" x="30" y="28">CONTROL PLANE — stateless, replicated, where the truth is decided</text>

  <rect class="box-v" x="30" y="40" width="240" height="76" rx="10"/>
  <text class="t-violet" x="48" y="64" font-size="14.5">kube-apiserver  :6443</text>
  <text class="t-xs" x="48" y="84">the ONLY writer to etcd</text>
  <text class="t-xs" x="48" y="102">authn (certs/tokens) · RBAC · admission</text>

  <rect class="box-a" x="290" y="40" width="240" height="76" rx="10"/>
  <text class="t-accent" x="308" y="64" font-size="14.5">kube-scheduler</text>
  <text class="t-xs" x="308" y="84">watches pods with empty</text>
  <text class="t-xs" x="308" y="102">spec.nodeName → picks one</text>

  <rect class="box-p" x="550" y="40" width="240" height="76" rx="10"/>
  <text class="t-bad" x="568" y="64" font-size="14.5">kube-controller-manager</text>
  <text class="t-xs" x="568" y="84">ReplicaSet · StatefulSet · Job</text>
  <text class="t-xs" x="568" y="102">Node · endpoints · PV · GC</text>

  <rect class="box-ok" x="810" y="40" width="260" height="76" rx="10"/>
  <text class="t-ok" x="828" y="64" font-size="14.5">etcd  :2379 / :2380</text>
  <text class="t-xs" x="828" y="84">Raft-replicated key-value store</text>
  <text class="t-xs" x="828" y="102">ALL cluster state lives here</text>

  <path class="ln-a" d="M270,78 L286,78" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M530,78 L546,78" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln-a" d="M790,78 L806,78" marker-end="url(#lm-arrow-accent)"/>
  <path class="ln dash" d="M400,116 L400,150 L840,150 L840,116" marker-end="url(#lm-arrow)"/>
  <text class="t-xs" x="600" y="164">controllers and scheduler write objects through the apiserver only — never directly to etcd</text>

  <path class="ln-a" d="M150,116 L150,190" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="160" y="160">kubectl / CI / GitOps / controllers</text>

  <line class="ln-w" x1="30" y1="196" x2="1070" y2="196" stroke-width="3"/>
  <text class="t-warn" x="30" y="218" font-size="13.5">PER NODE — runs as root, talks to the apiserver, owns the machine</text>

  <rect class="box-a" x="30" y="230" width="250" height="80" rx="10"/>
  <text class="t-accent" x="48" y="254" font-size="14.5">kubelet  :10250</text>
  <text class="t-xs" x="48" y="274">watches pods assigned to THIS node.</text>
  <text class="t-xs" x="48" y="292">Runs CNI, pulls images, asks the</text>
  <text class="t-xs" x="48" y="306">runtime to start things, streams logs,</text>
  <text class="t-xs" x="48" y="318">probes health, reports status.</text>

  <path class="ln-a" d="M150,310 L150,344" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="158" y="330">CRI (gRPC)</text>

  <rect class="box-p" x="30" y="344" width="250" height="86" rx="10"/>
  <text class="t-bad" x="48" y="368" font-size="14.5">containerd  (+ runc shims)</text>
  <text class="t-xs" x="48" y="388">the runtime: pulls images, unpacks</text>
  <text class="t-xs" x="48" y="406">layers, creates the namespaces,</text>
  <text class="t-xs" x="48" y="424">applies cgroups. See chapter 13.</text>

  <path class="ln-a" d="M280,387 L336,387" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box" x="336" y="344" width="210" height="86" rx="10"/>
  <text x="354" y="368" font-size="14.5">the containers</text>
  <text class="t-xs" x="354" y="388">each one = namespaces +</text>
  <text class="t-xs" x="354" y="406">cgroup + overlay rootfs,</text>
  <text class="t-xs" x="354" y="424">under a per-pod shim</text>

  <rect class="box-v" x="30" y="444" width="250" height="70" rx="10"/>
  <text class="t-violet" x="48" y="468" font-size="14.5">CNI plugin  (/opt/cni/bin)</text>
  <text class="t-xs" x="48" y="488">run once per pod sandbox: builds</text>
  <text class="t-xs" x="48" y="506">veth + bridge/IPAM, writes the IP</text>

  <rect class="box-w" x="300" y="444" width="250" height="70" rx="10"/>
  <text class="t-warn" x="318" y="468" font-size="14.5">kube-proxy / Cilium</text>
  <text class="t-xs" x="318" y="488">watches Services + EndpointSlices,</text>
  <text class="t-xs" x="318" y="506">programs ClusterIP → pod IP rules</text>

  <rect class="box-ok" x="570" y="444" width="250" height="70" rx="10"/>
  <text class="t-ok" x="588" y="468" font-size="14.5">CSI driver</text>
  <text class="t-xs" x="588" y="488">attach/mount the PV: NFS, local</text>
  <text class="t-xs" x="588" y="506">path, cloud disk, cephfs…</text>

  <rect class="box" x="840" y="444" width="230" height="70" rx="10"/>
  <text x="858" y="468" font-size="14.5">metrics-server</text>
  <text class="t-xs" x="858" y="488">kubelet metrics aggregated;</text>
  <text class="t-xs" x="858" y="506">backs kubectl top / HPA</text>

  <!-- pod sandbox -->
  <rect class="box-a" x="30" y="530" width="520" height="196" rx="10"/>
  <text class="t-accent" x="48" y="554" font-size="15">what a Pod actually is — one sandbox, several containers</text>
  <text class="t-xs" x="48" y="578">The <tspan font-weight="700">sandbox</tspan> (created by CRI RunPodSandbox) owns everything shared:</text>
  <text class="t-xs" x="62" y="596">the pod's network namespace, its IPC namespace, its /etc/hostname, its cgroup parent,</text>
  <text class="t-xs" x="62" y="612">and the pause container that holds those namespaces open for the pod's lifetime.</text>
  <text class="t-xs" x="48" y="638">Each container (CreateContainer) then joins those namespaces with its own</text>
  <text class="t-xs" x="62" y="656">mount namespace, its own rootfs overlay, and its own cgroup for resources.</text>
  <text class="t-xs" x="48" y="682">Sharing the network namespace is the whole reason sidecars work: a sidecar listening on</text>
  <text class="t-xs" x="62" y="700">localhost:9000 is reachable by the app container because they are the same netns —</text>
  <text class="t-xs" x="62" y="716">and unreachable from anywhere else in the cluster.</text>

  <rect class="box-b" x="570" y="530" width="500" height="196" rx="10"/>
  <text class="t-bad" x="588" y="554" font-size="15">what to remember when it breaks</text>
  <text class="t-sm" x="588" y="580">· Pods are <tspan font-weight="700">ephemeral by design</tspan>. Anything not in a PVC is deleted with the pod.</text>
  <text class="t-sm" x="588" y="604">· Pod IPs are <tspan font-weight="700">not stable</tspan>. Anything that must be found by name uses a Service.</text>
  <text class="t-sm" x="588" y="628">· Running means a container is running, <tspan font-weight="700">not</tspan> that it is healthy. Readiness is separate.</text>
  <text class="t-sm" x="588" y="652">· Restarted containers come back empty unless the state lives on a volume or in etcd.</text>
  <text class="t-sm" x="588" y="676">· The node runs the privileged half. A compromised kubelet is a compromised node.</text>
  <text class="t-xs" x="588" y="700">· Node components are usually managed by systemd on the host, not by Kubernetes itself —</text>
  <text class="t-xs" x="588" y="716">which is why journalctl -u kubelet, not kubectl logs, shows their failures.</text>
</svg>`
      },
      {
        type: "prose",
        h: "The apiserver is the only door",
        p: [
          "Every read and write in the cluster goes through <code>kube-apiserver</code>. Controllers, schedulers, kubelets, CI systems, <code>kubectl</code> — all of them. Nothing talks to etcd directly except the apiservers. This is not architectural purity for its own sake; it is what makes authorisation, validation, admission, auditing, and high availability tractable in one place instead of five.",
          "A write passes through four gates in order. <strong>Authentication</strong>: who are you — a client certificate, a bearer service-account token, or a bootstrap token. <strong>Authorisation</strong>: RBAC decides whether that identity may perform that verb on that resource type in that namespace; node authorisers add “a kubelet may only read pods bound to itself”. <strong>Admission</strong>: mutating webhooks may rewrite the object (this is how a service mesh injects its sidecar into your Deployment), and validating webhooks may reject it (OPA/Gatekeeper policy). <strong>Then persistence</strong>: written to etcd with a new <code>resourceVersion</code>.",
          "Watches are the mechanism that makes reconciliation cheap. Instead of polling, a controller says “tell me when anything under <code>/registry/pods/</code> changes” and receives a stream of events with the new resourceVersion, including deletes and the <em>bookmark</em> events that tell it its list is current after a reconnect. If you see a controller behaving irrationally, check whether its watch is broken — a dropped watch that is not re-established is a real failure mode, and it is why client libraries have periodic relist timers."
        ],
        kv: {
          h: "Ports you will eventually need",
          items: [
            { k: "6443", v: "kube-apiserver HTTPS. The only port you need to open between machines; put a load balancer in front of it for HA." },
            { k: "2379 / 2380", v: "etcd client / peer. Never expose. Back these up with <code>etcdctl snapshot save</code> — the backup of last resort, because everything else can be reconstructed from it." },
            { k: "10250", v: "kubelet HTTPS API. Needs authn+authz even inside the cluster; it exposes logs, exec and port-forward." },
            { k: "10255", v: "kubelet read-only HTTP, unauthenticated. Disable it (<code>--read-only-port=0</code>) — it leaks pod names and node state." },
            { k: "10251 / 10252", v: "scheduler / controller-manager, bound to localhost on the control-plane node by default. Leader election means only one is active at a time." },
            { k: "443 / 53 / 9153", v: "metrics-server HTTPS, CoreDNS, CoreDNS metrics. In-cluster only." }
          ]
        }
      },
      {
        type: "diagram",
        h: "One pod, from YAML to a running process",
        caption: "This is the single most useful diagram in the chapter. Note that the API server is involved at <b>every</b> step — the kubelet reports status back through it rather than talking to the scheduler directly, and the scheduler's only output is a field written into the pod object. Note also the split between <b>sandbox</b> (netns, cgroup parent, the pause container) and <b>containers</b>: it is why a pod with a broken sidecar still has working networking.",
        svg: `
<svg viewBox="0 0 1100 700" role="img" aria-label="Pod lifecycle from kubectl apply to running container">
  <rect class="box-v" x="30" y="24" width="160" height="52" rx="9"/>
  <text class="t-sm" x="110" y="46" text-anchor="middle">kubectl apply</text>
  <text class="t-xs" x="110" y="62" text-anchor="middle">or GitOps, or CI</text>
  <path class="ln-a" d="M190,50 L246,50" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="246" y="24" width="190" height="52" rx="9"/>
  <text class="t-sm" x="341" y="46" text-anchor="middle">apiserver</text>
  <text class="t-xs" x="341" y="62" text-anchor="middle">validate → admit → etcd</text>
  <text class="t-xs" x="341" y="24" font-size="1"></text>
  <text class="t-xs" x="248" y="88">pod stored with NO nodeName → status.phase = Pending</text>

  <path class="ln-a" d="M436,50 L492,50" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="440" y="42">watch</text>

  <rect class="box-a" x="492" y="24" width="190" height="52" rx="9"/>
  <text class="t-accent" x="587" y="46" text-anchor="middle">scheduler</text>
  <text class="t-xs" x="587" y="62" text-anchor="middle">filters + scores nodes</text>

  <path class="ln-a" d="M587,76 L587,118" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-accent" x="596" y="96">writes spec.nodeName (binding)</text>
  <text class="t-xs" x="596" y="112">— nothing is sent to the node directly</text>

  <rect class="box-ok" x="492" y="118" width="190" height="48" rx="9"/>
  <text class="t-sm" x="587" y="140" text-anchor="middle">node’s kubelet sees it</text>
  <text class="t-xs" x="587" y="158" text-anchor="middle">status → containersCreating</text>

  <rect class="box-p" x="30" y="118" width="420" height="48" rx="9"/>
  <text class="t-bad" x="48" y="140" font-size="14.5">replica controller watches ReplicaSet spec.replicas vs actual pods</text>
  <text class="t-xs" x="48" y="158">it does not know or care which node the scheduler picked</text>
  <path class="ln dash" d="M436,142 L488,142" marker-end="url(#lm-arrow)"/>

  <path class="ln-a" d="M340,166 L340,206" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="348" y="188">logs/events reported back up</text>

  <rect class="box-ok" x="30" y="206" width="420" height="58" rx="9"/>
  <text class="t-sm" x="48" y="228">kubelet reconciles: image pull → volumes → CRI calls</text>
  <text class="t-xs" x="48" y="248">status.phase flips Pending → Running only after StartContainer succeeds</text>

  <!-- CRI sequence -->
  <text class="t-title" x="30" y="296">CRI calls — this is where Kubernetes hands off to chapter 13</text>

  <rect class="box-p" x="30" y="310" width="300" height="66" rx="10"/>
  <text class="t-bad" x="48" y="334" font-size="14.5">① RunPodSandbox(network, cgroup, dns)</text>
  <text class="t-xs" x="48" y="354">runtime creates: netns · mount ns · IPC ns · cgroup parent</text>
  <text class="t-xs" x="48" y="370">and a pause container holding them open</text>

  <path class="ln-p" d="M330,343 L382,343" marker-end="url(#lm-arrow-bad)" stroke="var(--pink)" fill="none"/>

  <rect class="box-w" x="382" y="310" width="260" height="66" rx="10"/>
  <text class="t-warn" x="400" y="334" font-size="14.5">② CNI ADD  (kubelet → /opt/cni/bin)</text>
  <text class="t-xs" x="400" y="354">returns an IP from the node's pod CIDR</text>
  <text class="t-xs" x="400" y="370">writes it into the pod's status.podIP</text>

  <path class="ln-a" d="M642,343 L694,343" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="694" y="310" width="376" height="66" rx="10"/>
  <text class="t-bad" x="712" y="334" font-size="14.5">③ CreateContainer × N → StartContainer × N</text>
  <text class="t-xs" x="712" y="354">each joins the sandbox namespaces, gets its own mount ns + overlayfs rootfs</text>
  <text class="t-xs" x="712" y="370">and its own cgroup for limits</text>

  <path class="ln-a" d="M900,376 L900,412" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-ok" x="694" y="404" width="376" height="74" rx="9"/>
  <text class="t-ok" x="712" y="428" font-size="14.5">④ probes + kubelet status loop, forever</text>
  <text class="t-xs" x="712" y="448">liveness → restart · readiness → add/remove</text>
  <text class="t-xs" x="712" y="462">from Endpoints · startup → protect slow boots</text>
  <text class="t-xs" x="712" y="476">each result is written back to pod status</text>

  <rect class="box-a" x="30" y="412" width="620" height="58" rx="9"/>
  <text class="t-accent" x="48" y="434" font-size="14.5">Service routing becomes live only once the pod is READY and in an EndpointSlice</text>
  <text class="t-xs" x="48" y="454">kube-proxy watches EndpointSlices, not pods. <tspan font-weight="700">Running but not Ready = no traffic, no error, no log line</tspan> — by far the most</text>
  <text class="t-xs" x="48" y="466">common cause of “the service exists but nothing answers”, and the first thing kubectl describe pod will tell you.</text>

  <rect class="box-b" x="30" y="494" width="300" height="182" rx="10"/>
  <text class="t-bad" x="48" y="518" font-size="14.5">ImagePullBackOff</text>
  <text class="t-xs" x="48" y="540">image tag does not exist, registry</text>
  <text class="t-xs" x="48" y="558">auth failed, or rate limited. The</text>
  <text class="t-xs" x="48" y="576">kubelet retries with backoff, so the</text>
  <text class="t-xs" x="48" y="594">message stops changing — it is not</text>
  <text class="t-xs" x="48" y="612">stuck, it is waiting on the registry.</text>
  <text class="t-xs" x="48" y="640">Fix the tag or the pull secret; the</text>
  <text class="t-xs" x="48" y="658">retry loop will pick it up without</text>
  <text class="t-xs" x="48" y="674">a restart.</text>

  <rect class="box-w" x="350" y="494" width="300" height="182" rx="10"/>
  <text class="t-warn" x="368" y="518" font-size="14.5">CrashLoopBackOff</text>
  <text class="t-xs" x="368" y="540">the container exits non-zero, kubelet</text>
  <text class="t-xs" x="368" y="558">restarts it with growing backoff</text>
  <text class="t-xs" x="368" y="576">(10s, 20s, 40s … capped at 5 min).</text>
  <text class="t-xs" x="368" y="600">The restart count is on the</text>
  <text class="t-xs" x="368" y="618">container status; the previous</text>
  <text class="t-xs" x="368" y="636">crash's output only survives as:</text>
  <text class="t-warn" x="368" y="662">kubectl logs &lt;pod&gt; --previous</text>

  <rect class="box-p" x="670" y="494" width="400" height="182" rx="10"/>
  <text class="t-bad" x="688" y="518" font-size="14.5">Pending forever</text>
  <text class="t-xs" x="688" y="540">The scheduler never assigned it. Reasons, in the order to check:</text>
  <text class="t-xs" x="688" y="564">1. not enough CPU/memory <tspan font-weight="700">requests</tspan> on any node</text>
  <text class="t-xs" x="688" y="584">2. node taint with no matching toleration</text>
  <text class="t-xs" x="688" y="604">3. nodeSelector / affinity no longer satisfiable</text>
  <text class="t-xs" x="688" y="624">4. unbound PVC — the pod waits for the volume</text>
  <text class="t-xs" x="688" y="644">5. pod requests more than the largest node</text>
  <text class="t-xs" x="688" y="668">The scheduler writes the reason into pod conditions.</text>
</svg>`
      },
      {
        type: "diagram",
        h: "The control loops, and what each one watches",
        caption: "Every row is a loop with the same shape: watch objects of kind A, compare to objects of kind B, write a correction. The <b>owner reference</b> column is how deletion propagates — a pod owned by a ReplicaSet owned by a Deployment disappears when the Deployment does, and the garbage collector is what enforces it. It is also why deleting a pod by hand does nothing: its controller immediately makes another.",
        svg: `
<svg viewBox="0 0 1100 640" role="img" aria-label="Kubernetes reconciliation loops">
  <text class="t-title" x="30" y="28">Everything is a loop: desired → observed → correct → repeat</text>

  <g>
  <rect class="box-v" x="30" y="44" width="230" height="72" rx="9"/>
  <text class="t-violet" x="48" y="68" font-size="14">Deployment controller</text>
  <text class="t-xs" x="48" y="88">watches Deployments</text>
  <text class="t-xs" x="48" y="106">creates/rolls ReplicaSets</text>
  <path class="ln" d="M260,80 L320,80" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="320" y="44" width="230" height="72" rx="9"/>
  <text class="t-accent" x="338" y="68" font-size="14">ReplicaSet controller</text>
  <text class="t-xs" x="338" y="88">watches ReplicaSets</text>
  <text class="t-xs" x="338" y="106">keeps replicas == spec.replicas</text>
  <path class="ln" d="M550,80 L610,80" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="44" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="68" font-size="14">Pods</text>
  <text class="t-xs" x="628" y="88">the actual work</text>
  <text class="t-xs" x="628" y="106">ownerRef → ReplicaSet</text>
  </g>

  <g>
  <rect class="box-a" x="30" y="132" width="230" height="72" rx="9"/>
  <text class="t-accent" x="48" y="156" font-size="14">kubelet (per node)</text>
  <text class="t-xs" x="48" y="176">watches pods with its own</text>
  <text class="t-xs" x="48" y="194">nodeName → makes them real</text>
  <path class="ln" d="M260,168 L320,168" marker-end="url(#lm-arrow)"/>
  <rect class="box-p" x="320" y="132" width="230" height="72" rx="9"/>
  <text class="t-bad" x="338" y="156" font-size="14">runtime + kubelet probes</text>
  <text class="t-xs" x="338" y="176">CRI, CNI, health, logs</text>
  <text class="t-xs" x="338" y="194">restart / reschedule as needed</text>
  <path class="ln" d="M550,168 L610,168" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="132" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="156" font-size="14">pod.status</text>
  <text class="t-xs" x="628" y="176">phase · conditions · IPs</text>
  <text class="t-xs" x="628" y="194">containerStatuses, restarts</text>
  </g>

  <g>
  <rect class="box-v" x="30" y="220" width="230" height="72" rx="9"/>
  <text class="t-violet" x="48" y="244" font-size="14">endpoints / EndpointSlice</text>
  <text class="t-xs" x="48" y="264">controller: watches Service</text>
  <text class="t-xs" x="48" y="282">selects Ready pods by label</text>
  <path class="ln" d="M260,256 L320,256" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="320" y="220" width="230" height="72" rx="9"/>
  <text class="t-accent" x="338" y="244" font-size="14">kube-proxy / Cilium</text>
  <text class="t-xs" x="338" y="264">watches EndpointSlices,</text>
  <text class="t-xs" x="338" y="282">writes iptables / eBPF maps</text>
  <path class="ln" d="M550,256 L610,256" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="220" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="244" font-size="14">ClusterIP rules</text>
  <text class="t-xs" x="628" y="264">DNAT → one pod IP,</text>
  <text class="t-xs" x="628" y="282">chosen by conntrack</text>
  </g>

  <g>
  <rect class="box-v" x="30" y="308" width="230" height="72" rx="9"/>
  <text class="t-violet" x="48" y="332" font-size="14">PV controller / CSI</text>
  <text class="t-xs" x="48" y="352">watches PVCs, calls CSI</text>
  <text class="t-xs" x="48" y="370">CreateVolume, then binds</text>
  <path class="ln" d="M260,344 L320,344" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="320" y="308" width="230" height="72" rx="9"/>
  <text class="t-accent" x="338" y="332" font-size="14">VolumeAttachment</text>
  <text class="t-xs" x="338" y="352">attach to a specific node</text>
  <text class="t-xs" x="338" y="370">via the CSI Controller service</text>
  <path class="ln" d="M550,344 L610,344" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="308" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="332" font-size="14">kubelet mounts it</text>
  <text class="t-xs" x="628" y="352">into the container's mount ns</text>
  <text class="t-xs" x="628" y="370">as a real path</text>
  </g>

  <g>
  <rect class="box-v" x="30" y="396" width="230" height="72" rx="9"/>
  <text class="t-violet" x="48" y="420" font-size="14">Node controller</text>
  <text class="t-xs" x="48" y="440">watches kubelet heartbeats</text>
  <text class="t-xs" x="48" y="458">marks NotReady after grace period</text>
  <path class="ln" d="M260,432 L320,432" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="320" y="396" width="230" height="72" rx="9"/>
  <text class="t-accent" x="338" y="420" font-size="14">eviction / taint</text>
  <text class="t-xs" x="338" y="440">node.kubernetes.io/not-ready</text>
  <text class="t-xs" x="338" y="458">blocks new pods; old ones drain</text>
  <path class="ln" d="M550,432 L610,432" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="396" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="420" font-size="14">pods rescheduled</text>
  <text class="t-xs" x="628" y="440">elsewhere, or deleted if</text>
  <text class="t-xs" x="628" y="458">bound to the lost node</text>
  </g>

  <g>
  <rect class="box-v" x="30" y="484" width="230" height="72" rx="9"/>
  <text class="t-violet" x="48" y="508" font-size="14">StatefulSet / Job</text>
  <text class="t-xs" x="48" y="528">same loop, stricter ordering</text>
  <text class="t-xs" x="48" y="546">and stable identity per replica</text>
  <path class="ln" d="M260,520 L320,520" marker-end="url(#lm-arrow)"/>
  <rect class="box-a" x="320" y="484" width="230" height="72" rx="9"/>
  <text class="t-accent" x="338" y="508" font-size="14">headless Service</text>
  <text class="t-xs" x="338" y="528">clusterIP: None → per-pod DNS</text>
  <text class="t-xs" x="338" y="546">web-0.web-0.ns.svc…</text>
  <path class="ln" d="M550,520 L610,520" marker-end="url(#lm-arrow)"/>
  <rect class="box-ok" x="610" y="484" width="200" height="72" rx="9"/>
  <text class="t-ok" x="628" y="508" font-size="14">ordered start</text>
  <text class="t-xs" x="628" y="528">one at a time, wait for</text>
  <text class="t-xs" x="628" y="546">Ready before the next</text>
  </g>

  <rect class="box-w" x="30" y="572" width="1040" height="54" rx="9"/>
  <text class="t-warn" x="48" y="596" font-size="14">The garbage collector is the loop that makes ownership real</text>
  <text class="t-xs" x="48" y="616">An ownerReference on the pod points at the ReplicaSet. Delete the Deployment and the GC removes the ReplicaSets, which removes the pods. Delete one pod and its ReplicaSet notices the shortfall and creates a replacement — which is why “manually deleting a stuck pod” often does not help and sometimes helps exactly once.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Scheduling, requests, and the QoS rule that decides who dies first",
        p: [
          "The scheduler runs in two conceptual phases, though modern versions interleave them. <strong>Filtering</strong> removes nodes that cannot run the pod at all: not enough allocatable CPU or memory against the pod's <em>requests</em>, a taint with no matching toleration, a nodeSelector that does not match, a required pod affinity or anti-affinity that cannot be satisfied, a port already bound on hostNetwork, or a volume that cannot be attached there. <strong>Scoring</strong> ranks the survivors: least requested, least allocated, node affinity preference, spread across zones or hosts, taint toleration cost. Highest score wins. If nothing survives, the pod stays <code>Pending</code> and the scheduler writes the reason into <code>pod.status.conditions[Scheduled]</code> — which is the only place the actual answer exists, and which <code>kubectl describe pod</code> prints.",
          "<strong>Requests are the unit of accounting</strong>, and this is the single most misunderstood thing in the platform. A container's request is the CPU share and memory floor the scheduler reserves; its limit is the ceiling the kernel enforces. <code>requests: 500m / 512Mi, limits: 1 / 1Gi</code> means “reserve half a core and half a gibibyte, never exceed one core or one gibibyte”. A pod with no requests at all gets whatever is left over and, worse, is scheduled as if it needed nothing.",
          "From those two numbers the kubelet derives the <strong>QoS class</strong>, and QoS determines eviction order when a node is short of memory. This is the actual mechanism behind node-pressure evictions, and it is deterministic, not random."
        ]
      },
      {
        type: "table",
        cols: ["QoS class", "Condition", "Evicted", "Practical meaning"],
        rows: [
          ["<span class='tcol-ok'>Guaranteed</span>", "<em>Every</em> container sets requests == limits for <b>both</b> CPU and memory", "<b>Last.</b> Evicted only when the node cannot evict anything else", "Also the only class eligible for <code>systemd</code>-style CPU pinning via <code>--cpu-static-policy</code>, and the one to aim for in production"],
          ["<span class='tcol-warn'>Burstable</span>", "At least one request is set, but not all containers are Guaranteed", "<b>Second.</b> Ranked by usage above request", "The default for most real manifests, because people set limits but not requests, or the reverse"],
          ["<span class='tcol-bad'>BestEffort</span>", "<b>No</b> requests and no limits anywhere", "<b>First.</b> Always evicted first", "Guaranteed to be the first casualty of memory pressure — and it is easy to create by omission, in a batch job or a forgotten initContainer"],
          ["<code>eviction-order</code>", "—", "Guaranteed &gt; Burstable &gt; BestEffort, ties broken by how far usage exceeds request", "Which is why a memory limit you set but never request gives you no eviction protection at all"]
        ]
      },
      {
        type: "prose",
        h: "Networking: three things that are frequently confused",
        p: [
          "<strong>Pod networking</strong> is the flat, routable overlay that gives every pod an IP from its node's pod CIDR. It is not implemented by Kubernetes — it is delegated to a <strong>CNI plugin</strong>, and each CNI has its own dataplane (bridge with masquerading, routed, eBPF, macvlan). All the plugin shares is a configuration contract: <code>/etc/cni/net.d/*.conflist</code> on the node, invoked as a binary with <code>ADD</code>/<code>DEL</code> and a network namespace path, returning a JSON result. The result is what becomes <code>pod.status.podIP</code>. That is the entire Kubernetes side of pod networking, and it is why “the pod has no IP” almost always means the CNI daemon or plugin failed, not that Kubernetes misbehaved.",
          "<strong>Service networking</strong> is a virtual IP that load-balances to N pods. A normal Service gets a ClusterIP from the service CIDR (the <code>10.96.0.0/12</code> default) that nothing answers on directly — it is intercepted. <code>kube-proxy</code> watches Services and EndpointSlices and writes rules that DNAT the ClusterIP to a real pod IP, with conntrack choosing which pod per connection so a single client connection stays pinned. Return traffic is masqueraded because pod IPs are not routable from outside. That is chapters 09 and 11 again: kube-proxy is simply the author of netfilter rules.",
          "<strong>Ingress</strong> is not a fourth thing. An Ingress controller is just another controller — running as a Deployment — that watches Ingress objects and programs its own load balancer, usually by writing more netfilter rules or by being the load balancer itself. The API object is a configuration format for whatever controller you happen to run, and the differences between NGINX, Traefik and Envoy ingress controllers are as large as the differences between those proxies."
        ],
        noteTitle: "The five names every pod can resolve",
        note: "For a pod <code>web-0</code> from Service <code>web</code> in namespace <code>prod</code>, CoreDNS answers to <code>web-0.web.prod.svc.cluster.local</code>, <code>web.prod.svc.cluster.local</code>, <code>web.prod.svc</code>, <code>web.prod</code> and <code>web</code>. The cluster search domains (<code>prod.svc.cluster.local svc.cluster.local cluster.local</code>) are what make the short forms work. Plus <code>kubernetes.default.svc</code>, which resolves to the apiserver. DNS goes through <code>/etc/resolv.conf</code> in the pod, which kubelet writes from the cluster's DNS Service IP — so chapter 10 applies here too.",
        noteKind: "fact"
      },
      {
        type: "diagram",
        h: "A ClusterIP is a firewall rule, not an address",
        caption: "The kube-proxy chain, top to bottom: a packet to a Service IP matches the Service's chain, which picks a backend and rewrites the destination, then is accepted in a later chain. Because these live in the <b>nat</b> table before any of your <b>filter</b> rules run, container traffic on a host with Docker or CNI will appear to ignore your firewall — the same trap described in chapters 09 and 15, now with cluster IP ranges bolted on.",
        svg: `
<svg viewBox="0 0 1100 600" role="img" aria-label="kube-proxy iptables chain for a ClusterIP Service">
  <rect class="box-w" x="30" y="24" width="240" height="60" rx="9"/>
  <text class="t-warn" x="48" y="48">packet to 10.96.14.22:80</text>
  <text class="t-xs" x="48" y="68">the ClusterIP. Nothing owns this IP.</text>
  <path class="ln-a" d="M270,54 L326,54" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="326" y="24" width="300" height="60" rx="9"/>
  <text class="t-bad" x="344" y="48">PREROUTING → KUBE-SERVICES</text>
  <text class="t-xs" x="344" y="68">first rule matching dport 80 → jump</text>
  <path class="ln-a" d="M626,54 L682,54" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="682" y="24" width="388" height="60" rx="9"/>
  <text class="t-accent" x="700" y="48">KUBE-SVC-XXXX  (one per Service)</text>
  <text class="t-xs" x="700" y="68">statistically picks a backend, prob 0.4/0.3/0.3</text>

  <path class="ln-a" d="M876,84 L876,124" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-a" x="682" y="124" width="388" height="60" rx="9"/>
  <text class="t-accent" x="700" y="148">KUBE-SEP-YYYY  (one per ready pod)</text>
  <text class="t-xs" x="700" y="168">marks the packet for the chosen endpoint</text>

  <path class="ln-a" d="M876,184 L876,224" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-v" x="682" y="224" width="388" height="60" rx="9"/>
  <text class="t-violet" x="700" y="248">DNAT: 10.96.14.22:80 → 10.244.3.17:8080</text>
  <text class="t-xs" x="700" y="268">destination rewritten to a real pod IP</text>

  <path class="ln-a" d="M682,254 L626,254" marker-end="url(#lm-arrow-accent)"/>
  <rect class="box-ok" x="326" y="224" width="300" height="60" rx="9"/>
  <text class="t-ok" x="344" y="248">conntrack remembers the 5-tuple</text>
  <text class="t-xs" x="344" y="268">so all packets of one TCP conn follow it</text>

  <path class="ln-ok" d="M476,284 L476,326" marker-end="url(#lm-arrow-ok)"/>
  <rect class="box-ok" x="326" y="326" width="300" height="60" rx="9"/>
  <text class="t-ok" x="344" y="350">route via cni0 / veth to the pod</text>
  <text class="t-xs" x="344" y="370">the pod's netns, its own lo</text>

  <path class="ln-b" d="M876,284 L876,326" marker-end="url(#lm-arrow-bad)"/>
  <rect class="box-b" x="682" y="326" width="388" height="60" rx="9"/>
  <text class="t-bad" x="700" y="350">reply path: masquerade to the node IP</text>
  <text class="t-xs" x="700" y="370">pod IPs are not routable from the internet</text>

  <text class="t-title" x="30" y="426">verify it yourself on a node</text>
  <rect class="box" x="30" y="438" width="510" height="148" rx="9"/>
  <text class="t-sm" x="48" y="462">iptables -t nat -L KUBE-SERVICES -n -v | head</text>
  <text class="t-sm" x="48" y="484">iptables -t nat -L KUBE-SVC-XXXXXX -n</text>
  <text class="t-sm" x="48" y="506">conntrack -L -p tcp --dport 80</text>
  <text class="t-sm" x="48" y="528">kubectl -n prod get endpointslices -l kubernetes.io/service-name=web</text>
  <text class="t-xs" x="48" y="552">the EndpointSlice is the source of truth; the rules are a compiled cache of it. If the slice is right and the rules are not,</text>
  <text class="t-xs" x="48" y="572">restart kube-proxy. If the slice is wrong, the problem is readiness or the Service selector.</text>

  <rect class="box-b" x="565" y="438" width="505" height="148" rx="9"/>
  <text class="t-bad" x="583" y="462" font-size="14.5">The three Service types, and what each costs</text>
  <text class="t-sm" x="583" y="488"><tspan font-weight="700">ClusterIP</tspan> — cluster-internal only. Free. The default.</text>
  <text class="t-sm" x="583" y="512"><tspan font-weight="700">NodePort</tspan> — one listener per node on a port 30000-32767. Reaches every node, so the port is open everywhere and the source IP survives (useful for L4, awkward for HTTP).</text>
  <text class="t-sm" x="583" y="544"><tspan font-weight="700">LoadBalancer</tspan> — a request to the cloud provider (or MetalLB, or an operator); it provisions a public IP or a load balancer pointing at nodes or NodePorts.</text>
  <text class="t-xs" x="583" y="570">None of these terminates TLS. That is the Ingress controller's job, and it is a separate Deployment you install and maintain.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Storage: claims, promises, and a three-party handshake",
        p: [
          "Kubernetes storage has three nouns that describe three different things. A <strong>PV</strong> (PersistentVolume) is a piece of storage that exists — a disk, an NFS export, a directory on a node. A <strong>PVC</strong> (PersistentClaim) is a request: “I want this much space, with these access modes, in this StorageClass, and it must survive my pod.” A <strong>StorageClass</strong> is a named provisioning policy: <code>standard</code>, <code>fast-ssd</code>, <code>nfs-client</code> — it says which CSI driver to ask and what parameters to pass.",
          "The binding is a handshake with three parties. Your PVC asks for a volume; the <strong>PV controller</strong> watches for unbound claims and either finds a matching pre-provisioned PV or asks the StorageClass's CSI driver (<code>external-provisioner</code>) to <code>CreateVolume</code>, then writes a PV object bound to your claim. When a pod needs it, the <strong>attach/detach controller</strong> calls the CSI driver's <code>ControllerPublishVolume</code> so the volume is attached to the chosen node, and finally the <strong>kubelet</strong> calls the node-side <code>NodePublishVolume</code> — which is the call that actually bind-mounts something into the container's mount namespace. Access mode <code>ReadWriteOnce</code> means one node at a time, <code>ReadWriteMany</code> means many, and only some CSI drivers can actually do that.",
          "Two volumes need no storage system at all and are worth knowing because they answer different questions. <code>emptyDir</code> is a tmpfs or disk-backed directory created when the pod starts and deleted with the pod — perfect for scratch space and for sharing data between containers in the same pod. <code>hostPath</code> mounts a path from the node, which means the pod's data survives the pod but <em>not</em> a node failure, a reschedule, or a cluster rebuild — and it gives the container a path into the host filesystem, which is a security decision as much as a storage one. Anything you genuinely care about belongs in a real PVC with a real driver and a real backup."
        ]
      },
      {
        type: "prose",
        h: "Workloads: which controller, and why",
        p: [
          "<strong>Deployment</strong> is stateless replicas behind a selector. It owns ReplicaSets and performs rolling updates with <code>maxSurge</code> (how many extra pods you may create) and <code>maxUnavailable</code> (how many may be down) — both default to 25%, rounded up to at least one pod, which is a detail that surprises people running single-replica workloads. <strong>StatefulSet</strong> adds a stable identity per replica: ordinal names (<code>web-0</code>, <code>web-1</code>), ordered start (one at a time, each waiting for Ready), ordered stop in reverse, and a stable volume claim per pod. That is what makes databases and anything with on-disk identity possible. <strong>DaemonSet</strong> is exactly one pod per eligible node — log shippers, metrics agents, CNI components. <strong>Job</strong> runs to completion; <strong>CronJob</strong> schedules Jobs and, since 1.21, has a <code>concurrencyPolicy</code> and a <code>startingDeadlineSeconds</code> that stops a backlog of missed runs from firing at once.",
          "The three probes are different and mixing them up is a classic self-inflicted outage. <strong>liveness</strong> asks “is this process wedged?” and a failure <em>restarts the container</em>. <strong>readiness</strong> asks “can this pod serve traffic right now?” and a failure only <em>removes it from endpoints</em> — no restart. <strong>startup</strong> asks “has it finished booting?” and suppresses the other two until it succeeds. The failure mode to remember: a liveness probe that checks a dependency will restart perfectly healthy containers during that dependency's outage, turning a degraded service into an outage. Liveness should probe the process itself, and nothing else, ever."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "kubectl, ordered by how often you will actually use each command",
        code:
`# ---- read: state, in the order that answers "what is wrong?" ----
kubectl get pods -o wide
kubectl get pods -o wide --field-selector=status.phase=Pending   # server-side, not grep
kubectl describe pod web-7d9f-abcde                 # Events at the bottom are the answer
kubectl get pod web-7d9f-abcde -o yaml             # spec + status as stored in etcd
kubectl get events --sort-by=.lastTimestamp | tail -30
kubectl get deploy,rs,pod -l app=web -o wide         # follow the ownership chain
kubectl explain pod.spec.containers.resources        # API docs, from the server

# ---- the three that matter most ----
kubectl logs -f deploy/web                          # follow a workload, any replica
kubectl logs pod/web-7d9f-abcde --previous          # the crash that caused CrashLoopBackOff
kubectl logs -l app=web --all-containers --since=1h --prefix   # across every pod, one stream

# ---- live inspection ----
kubectl exec -it web-7d9f-abcde -- sh                # into the pod (shell may not exist)
kubectl debug -it web-7d9f-abcde --image=nicolaka/netshoot --target=web
                                                 # ephemeral container: attach tools without
                                                 # changing the image or restarting anything
kubectl port-forward svc/web 8080:80
kubectl cp pod/web-7d9f-abcde:/var/log/app.log ./app.log

# ---- resource usage ----
kubectl top pods --sort-by=memory
kubectl top nodes
kubectl describe node worker-3            # Conditions + Capacity + Allocated resources

# ---- rollout, done safely ----
kubectl rollout status deploy/web -w
kubectl rollout history deploy/web
kubectl rollout undo deploy/web
kubectl rollout pause deploy/web ; kubectl rollout resume deploy/web
kubectl set image deploy/web web=registry/app:v1.4.2
kubectl diff -f ./manifests/ -R          # what would change, before it changes
kubectl apply --server-side -f dir/      # the field-manager-based apply, for GitOps

# ---- node-level truth that kubectl hides ----
kubectl get --raw '/api/v1/nodes/worker-3/proxy/logs/' | tail -50
kubectl get --raw /metrics | head
# on the node itself, as root:
journalctl -u kubelet -f ; journalctl -u containerd -f
crictl ps -a ; crictl images ; crictl logs <container-id>
crictl inspectp <pod-sandbox-id>          # the exact namespaces + limits the runtime was given`
      },
      {
        type: "callout",
        kind: "tip",
        title: "The one-paragraph mental model to keep",
        text: "etcd holds <b>what you asked for</b>. The apiserver is the only thing that validates and writes it. Controllers turn <b>object graphs</b> into other objects (Deployment → ReplicaSet → Pod). The scheduler writes <b>one field</b> into a pod. The kubelet is the <b>executor</b>, and it talks to containerd through CRI, never to the scheduler. kube-proxy and CNI are the <b>networking</b> layer, and they work by writing netfilter rules or eBPF maps. Every one of those is a loop with a timer and a retry. <b>Debug Kubernetes by asking which loop is wrong, not which object is wrong</b> — and the answer is almost always in <code>kubectl describe</code>, in the Events section at the bottom, which is the first thing people scroll past."
      }
    ],
    takeaways: [
      "Kubernetes is <strong>reconciliation loops over etcd</strong> behind an API server. Every feature is the same loop with a different comparison.",
      "The apiserver is the only writer to etcd, and the scheduler's only output is <code>spec.nodeName</code> on a pod. Nothing is sent to a node directly.",
      "<strong>Sandbox vs container</strong> is the concept that makes pods click: the sandbox owns the netns/IPC/cgroup and the pause container; containers join it with their own rootfs and limits.",
      "Running ≠ Ready ≠ serving traffic. Traffic follows EndpointSlices, so a Running-but-not-Ready pod is invisible with no error anywhere.",
      "A Service is <strong>netfilter rules written by kube-proxy</strong>. Delete kube-proxy and the ClusterIP becomes a dead address. Inspect the rules, do not theorise.",
      "Requests determine scheduling and QoS; QoS determines eviction order: Guaranteed survives, BestEffort dies first.",
      "Liveness probes your process. Readiness probes your dependencies. Conflating them converts a dependency outage into a restart storm."
    ],
    glossary: {
      "apiserver": "The only component that writes to etcd. Every component and client talks to it over HTTPS on :6443.",
      "etcd": "Raft-replicated key-value store holding all cluster state. Back it up with etcdctl snapshot save; everything else can be rebuilt from it.",
      "resourceVersion": "An etcd revision stamped on every object. How watch streams and optimistic concurrency work.",
      "watch / informer": "The client pattern that turns a list into a live event stream. Every controller uses one; a broken watch is a common silent failure.",
      "admission webhook": "An HTTPS callback the apiserver makes on every write. Mutating ones add sidecars; validating ones enforce policy (OPA).",
      "RBAC": "Role/ClusterRole plus a binding: verb on resource, optionally scoped to a namespace. The default authorisation mode.",
      "kubelet": "The per-node agent. Reconciles pods assigned to its node into real containers, runs probes, mounts volumes, reports status.",
      "CRI": "Container Runtime Interface — the gRPC contract between kubelet and containerd. RunPodSandbox / CreateContainer / StartContainer.",
      "pod sandbox": "The shared namespaces for a pod: netns, IPC, mount of /etc/hosts, cgroup parent, and a pause container keeping them alive.",
      "CNI": "Container Network Interface — a plugin contract invoked as a binary with ADD/DEL. Kubernetes does not implement pod networking itself.",
      "pod CIDR": "The per-node range CNI allocates pod IPs from. Routed or bridged depending on the CNI dataplane.",
      "kube-proxy": "Watches Services and EndpointSlices and programs iptables/IPVS/eBPF so a ClusterIP load-balances to ready pods.",
      "EndpointSlice": "The current list of ready pod IPs per Service. The source kube-proxy actually watches; deprecated Endpoints is the older form.",
      "ClusterIP": "A virtual IP from the service CIDR that nothing answers on — it is intercepted by rules and DNATed to a pod.",
      "QoS class": "Guaranteed / Burstable / BestEffort, derived from requests vs limits. Decides eviction order under memory pressure.",
      "ownerReference": "The parent link between objects. The garbage collector uses it so deleting a Deployment removes its ReplicaSets and pods.",
      "finalizer": "A field that blocks deletion until something external confirms cleanup. A stuck finalizer is why a namespace hangs in Terminating.",
      "CSI": "Container Storage Interface — the pluggable contract behind StorageClass, PV binding and attach/mount on the node.",
      "liveness / readiness / startup probe": "Restart the container / remove from endpoints / protect slow-starting containers. Distinct jobs with distinct blast radius."
    }
  });
})();