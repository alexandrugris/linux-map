/* ch15 — Hardening a Linux box */
(function () {
  LX.push({
    id: "security",
    title: "Hardening a Linux box",
    tagline: "Security is not a list of switches you flip once. It is the answer to one question: for each way in, which layer stops it, and what does that layer break?",
    sections: [
      {
        type: "prose",
        h: "Start with the attacker, not the checklist",
        p: [
          "Every hardening guide ever written begins with settings. That is backwards, because settings without a threat are decoration. The first question is not \"did I set <code>net.ipv4.conf.all.rp_filter</code>\" but <strong>who is going to try to get in, in what order, and what stops them at each step</strong>. On a public IPv4 box, the answer is entirely predictable, and it is boring — which is good.",
          "The order matters because almost every incident on a small server is a failure of the <em>first</em> layer, not a subtle bypass of the fifth. Nobody brute-forces an <code>AllowUsers</code>-restricted, key-only, Tailscale-reachable sshd after spending 30&nbsp;minutes in; they try 22,143,3306,6379,27017 against every IPv4 on the planet within seconds after the address is announced. The realistic sequence is: <strong>opportunistic mass scanning</strong> → <strong>credential replay against any human-facing service</strong> → <strong>known-CVE exploitation of whatever is listening</strong> → <strong>targeted, human-driven intrusion</strong>, which is rare and usually arrives through something else entirely (a leaked key, a compromised laptop, a CI pipeline, a supply-chain package).",
          "That last one is why \"I am behind a firewall\" and \"nobody knows I exist\" are both weak answers, and why the controls that survive a real attacker are the boring ones: <em>the release is still supported, the service is unprivileged, the surface is small, and you would notice if something changed</em>. Note what is absent from that list: no cipher suite, no perfect intrusion detection, no clever honeypot. Nobody has ever SSH'd into a hardened box because of a cipher suite."
        ],
        ul: [
          "<strong>Nobody</strong> is attacking you for the first week after you set the box up. They arrive when the address lands in a scan list — which is minutes, not weeks.",
          "<strong>Everyone</strong> is attacking the moment you open a port to the internet, whether you asked for it or a package opened it for you.",
          "<strong>Somebody specific</strong> attacks when there is a reason to want <em>your</em> data, and at that point your firewall is irrelevant — you are already past it via a credential."
        ],
        noteTitle: "The question that decides your priorities",
        note: "For this box — Ubuntu 18.04.6 LTS on a 2&nbsp;GB VPS with nginx on 80/443, BIND authoritative on 53, and SSH reachable <em>only</em> over Tailscale — the ranked answer is: (1) is the release still patched, (2) what is listening on a public address right now, (3) who can become root, (4) what would I see if any of it changed. Everything else is a rounding error next to those four.",
        noteKind: "boss"
      },
      {
        type: "diagram",
        h: "The attacker ladder, and which rung each control meets",
        caption: "Read it bottom-up: almost all real attempts die at rung 1 or 2, where the cost to the attacker is near zero and the cost to you is a config line. The controls are <em>not</em> equally valuable — the top of the ladder is where you have already lost, and no amount of kernel tuning recovers it.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Ascending ladder of attacker skill levels with the control that meets each level">
  <!-- rungs -->
  <g>
  <rect class="box-b" x="30" y="30" width="700" height="76" rx="10"/>
  <text class="t-bad" x="48" y="56" font-size="15.5">rung 5 — a person, with a goal, and your data</text>
  <text class="t-sm" x="48" y="76">stolen key · leaked password · poisoned dependency · compromised laptop · CI token</text>
  <text class="t-xs" x="48" y="96">nothing on this box stops it. Controls that help: key rotation, off-host backups, audit rules on ~/.ssh, file ACLs on secrets.</text>

  <rect class="box-w" x="112" y="118" width="618" height="76" rx="10"/>
  <text class="t-warn" x="130" y="144" font-size="15.5">rung 4 — exploit a known CVE in something listening</text>
  <text class="t-sm" x="130" y="164">nginx, openssh, named, glibc, a library in a web app</text>
  <text class="t-xs" x="130" y="184">stopped by: <tspan class="t-ok">unattended-upgrades + ESM</tspan>, removing the listener, and unprivileged daemons that cap the blast radius.</text>

  <rect class="box-p" x="194" y="206" width="536" height="76" rx="10"/>
  <text class="t-bad" x="212" y="232" font-size="15.5">rung 3 — automated exploit kit against a service</text>
  <text class="t-sm" x="212" y="252">webshell upload, RCE in a CMS, admin panel brute force</text>
  <text class="t-xs" x="212" y="272">stopped by: nothing on this box is dynamic, so the honest control is <tspan class="t-ok">surface</tspan> — no CMS, no panel, no public SSH.</text>

  <rect class="box-v" x="276" y="294" width="454" height="76" rx="10"/>
  <text class="t-violet" x="294" y="320" font-size="15.5">rung 2 — credential replay / password spray</text>
  <text class="t-sm" x="294" y="340">your login name against every service you expose, plus every other login name</text>
  <text class="t-xs" x="294" y="360">stopped by: <tspan class="t-ok">PasswordAuthentication no</tspan>, locked account passwords, no web login, no database on 0.0.0.0.</text>

  <rect class="box-ok" x="358" y="382" width="372" height="76" rx="10"/>
  <text class="t-ok" x="376" y="408" font-size="15.5">rung 1 — mass internet scanning</text>
  <text class="t-sm" x="376" y="428">SYN scans every IPv4, minutes after your IP appears</text>
  <text class="t-xs" x="376" y="448">stopped by: <tspan class="t-dim">least listeners</tspan>, ufw default deny, sshd on the tailnet only.</text>
  </g>

  <!-- the one thing that dominates -->
  <rect class="box-a" x="756" y="30" width="314" height="190" rx="10"/>
  <text class="t-accent" x="774" y="56" font-size="15">the multiplier</text>
  <text class="t-sm" x="774" y="80">an IPv4 address on the</text>
  <text class="t-sm" x="774" y="98">internet is scanned within</text>
  <text class="t-sm" x="774" y="116">minutes. A Tailscale</text>
  <text class="t-sm" x="774" y="134">address is not on any</text>
  <text class="t-sm" x="774" y="152">scan list, because it is</text>
  <text class="t-sm" x="774" y="170">RFC1918 and routed</text>
  <text class="t-sm" x="774" y="188">by WireGuard.</text>
  <text class="t-xs" x="774" y="210">removing the listener is a</text>
  <text class="t-xs" x="774" y="226">stronger control than any</text>
  <text class="t-xs" x="774" y="242">rule that filters it.</text>

  <rect class="box" x="756" y="238" width="314" height="220" rx="10"/>
  <text class="t-title" x="774" y="264" font-size="14.5">what rungs 1–3 assume</text>
  <text class="t-sm" x="774" y="290">1. the address is routable</text>
  <text class="t-sm" x="774" y="308">2. something accepts TCP</text>
  <text class="t-sm" x="774" y="326">3. the first protocol it</text>
  <text class="t-sm" x="774" y="344">   speaks is ssh or http</text>
  <line class="ln" x1="774" y1="360" x2="1052" y2="360"/>
  <text class="t-sm" x="774" y="384">Break any one of those three</text>
  <text class="t-sm" x="774" y="402">assumptions and four rungs</text>
  <text class="t-sm" x="774" y="420">disappear at once.</text>
  <text class="t-xs" x="774" y="446">rungs 4 and 5 do not care</text>
  <text class="t-xs" x="774" y="462">about assumptions — they</text>
  <text class="t-xs" x="774" y="478">arrive from inside.</text>
</svg>`
      },
      {
        type: "table",
        cols: ["Attack", "What it actually is", "Control that stops it", "Why the obvious control fails"],
        rows: [
          ["<code>port scan</code>", "A TCP SYN to every port on your address, automated, always.", "<strong>Not listening.</strong> ufw default deny incoming + sshd bound to the tailnet.", "A firewall rule that allows 22 from 0.0.0.0/0 with <code>PasswordAuthentication no</code> is a good config that still gets logged and probed forever. The rule filters; it does not remove the surface."],
          ["<code>ssh brute force</code>", "Thousands of username/password attempts, plus the public-key equivalent via <code>ssh-</code> agent tricks.", "<code>PasswordAuthentication no</code>, <code>KbdInteractiveAuthentication no</code>, locked account passwords.", "<code>PermitRootLogin no</code> alone is not enough — <code>ubuntu</code>, <code>deploy</code>, <code>git</code> and <code>admin</code> are the usual usernames, and they are real accounts on your box."],
          ["<code>known CVE</code>", "A public exploit for the exact version you are running.", "Being current. unattended-upgrades + ESM, not a config option.", "Hardening reduces what an exploit reaches; it does not remove the bug. nginx 1.14 has had RCE and cache-poisoning CVEs; the fix is a package upgrade."],
          ["<code>leaked SSH key</code>", "An attacker with a valid <code>id_ed25519.pub</code> line in your <code>authorized_keys</code>.", "Key rotation, <code>from=</code> source restriction, <code>restrict</code>, off-host copies of the repo history.", "<code>authorized_keys</code> is append-only in practice. Nobody notices the extra line. A key shared across two accounts doubles the blast radius — that is this box."],
          ["<code>credential reuse</code>", "A password you used elsewhere, tried against your mail, git, or admin panel.", "No password logins at all; a password manager with unique entries where a password is unavoidable.", "Fail2ban and lockout delay the same attack by hours. They do not remove it, and they will lock out your own laptop."],
          ["<code>supply chain</code>", "A malicious or typosquatted package in a build, or a compromised maintainer.", "Pinning, provenance, fewer dependencies, review of what <code>rsync</code> and CI publish.", "Nothing on the running host detects this. It happens before the code gets there — which is why the publish path is a security boundary."],
          ["<code>post-exploitation</code>", "Already inside; now enumerating, pivoting, establishing persistence.", "Audit rules, log review, unprivileged daemons, AppArmor, off-host backups.", "By definition the perimeter controls have already failed. Detection and containment are the only remaining controls, and only if someone reads the logs."]
        ]
      },
      {
        type: "prose",
        h: "Layers, in the order they actually apply to a packet",
        p: [
          "Defence in depth is usually drawn as concentric rings, which is misleading: on a real host the layers are <em>ordered</em>, and a packet meets them in a fixed sequence until one drops it. It is worth drawing that sequence because it tells you which layer you can still change after something has already started failing.",
          "For this box, the sequence is: <strong>Tailscale (WireGuard) — is this peer even on my tailnet</strong> → <strong>ufw / netfilter — does a rule permit the interface, address and port</strong> → <strong>the listener's own admission policy — sshd's <code>AllowUsers</code>, nginx's <code>server_name</code> / TLS SNI, named's query ACLs</strong> → <strong>authentication — the key, the password, the token</strong> → <strong>authorisation — which uid, which capabilities, which files</strong> → <strong>mandatory access control — AppArmor's profile for that binary</strong> → <strong>the code itself — the patch level</strong>.",
          "Note what is <em>not</em> in that list: TLS cipher configuration, HSTS, rate limiting. Those matter for the browser-to-nginx edge, and they are application concerns, not host concerns. On a box that serves four static sites, the interesting decisions are the ones in the first six rows."
        ],
        noteTitle: "The useful consequence of the ordering",
        note: "Because WireGuard comes first, SSH on the tailnet is <em>unfiltered by ufw</em> on this machine — packets arrive on <code>tailscale0</code> and are accepted there. That means ufw's SSH rules are not what protects you, and it also means <code>ufw status</code> is not a complete picture of who can reach sshd. Do not conclude \"no ufw rule for SSH, therefore SSH is open\" from <code>ufw status numbered</code>; check <code>ss -ltnp</code> and the actual <code>ListenAddress</code> instead.",
        noteKind: "fact"
      },
      {
        type: "diagram",
        h: "The stack a packet actually walks",
        caption: "Each layer can only say yes or no to what the layer below already approved. Note the two honest gaps drawn in red at the bottom: the container forwarding path that bypasses layer 2 entirely, and the fact that layers 1 and 2 protect <em>reachability</em>, not <em>content</em> — the only thing that makes code correct is layer 7.",
        svg: `
<svg viewBox="0 0 1100 540" role="img" aria-label="Ordered stack of security layers from network reachability down to patching">
  <g>
  <rect class="box-a" x="30" y="30" width="800" height="62" rx="10"/>
  <text class="t-accent" x="48" y="54" font-size="15">layer 1 — reachability: Tailscale / WireGuard overlay</text>
  <text class="t-sm" x="48" y="74">peers must be authenticated with a node key, then allowed by an ACL. The tailnet is RFC1918 space that no scanner can route to.</text>
  <text class="t-xs" x="48" y="90" text-anchor="end" transform="translate(1090,0)"></text>
  <text class="t-dim" x="846" y="54" font-size="13.5">removes the listener</text>
  <text class="t-dim" x="846" y="74" font-size="13.5">from public space</text>

  <rect class="box-v" x="30" y="102" width="800" height="62" rx="10"/>
  <text class="t-violet" x="48" y="126" font-size="15">layer 2 — netfilter: ufw over iptables, per-interface rules</text>
  <text class="t-sm" x="48" y="146">INPUT / OUTPUT / FORWARD chains, conntrack for return traffic, policies per hook. ufw is a rule generator, not a kernel feature.</text>
  <text class="t-dim" x="846" y="126" font-size="13.5">filters what got</text>
  <text class="t-dim" x="846" y="146" font-size="13.5">through layer 1</text>

  <rect class="box-p" x="30" y="174" width="800" height="62" rx="10"/>
  <text class="t-bad" x="48" y="198" font-size="15">layer 3 — admission: what the listening program accepts</text>
  <text class="t-sm" x="48" y="218">sshd AllowUsers + Match blocks · nginx server_name + TLS SNI + client_max_body_size · named query ACLs · 127.0.0.53 for resolver access</text>
  <text class="t-dim" x="846" y="198" font-size="13.5">applies even to</text>
  <text class="t-dim" x="846" y="218" font-size="13.5">layer-1 peers</text>

  <rect class="box-w" x="30" y="246" width="800" height="62" rx="10"/>
  <text class="t-warn" x="48" y="270" font-size="15">layer 4 — authentication: the key, the password, the token</text>
  <text class="t-sm" x="48" y="290">sshd: pubkey only, ED25519, MaxAuthTries, authorized_keys options. TLS: certificate chain. Nothing else on this box has a login.</text>
  <text class="t-dim" x="846" y="270" font-size="13.5">the layer attackers</text>
  <text class="t-dim" x="846" y="290" font-size="13.5">actually grind on</text>

  <rect class="box-b" x="30" y="318" width="800" height="62" rx="10"/>
  <text class="t-bad" x="48" y="342" font-size="15">layer 5 — authorisation: uid, groups, capabilities, file modes</text>
  <text class="t-sm" x="48" y="362">nginx workers as www-data · named as bind · CapBnd on /proc/PID/status · authorized_keys 600 and ~/.ssh 700</text>
  <text class="t-dim" x="846" y="342" font-size="13.5">decides the blast</text>
  <text class="t-dim" x="846" y="362" font-size="13.5">radius of a bug</text>

  <rect class="box-ok" x="30" y="390" width="800" height="62" rx="10"/>
  <text class="t-ok" x="48" y="414" font-size="15">layer 6 — mandatory access control: AppArmor (Ubuntu) / SELinux (RHEL)</text>
  <text class="t-sm" x="48" y="434">path and capability rules attached to the <tspan font-style="italic">binary</tspan>, applied on every open, exec, link and signal. Not affected by the caller's uid.</text>
  <text class="t-dim" x="846" y="414" font-size="13.5">survives a bad</text>
  <text class="t-dim" x="846" y="434" font-size="13.5">file mode</text>

  <rect class="box" x="30" y="462" width="800" height="62" rx="10"/>
  <text class="t-title" x="48" y="486" font-size="15">layer 7 — is the code itself correct?</text>
  <text class="t-sm" x="48" y="506">unattended-upgrades, Ubuntu Pro / ESM to May 2028, reboot onto 4.15.0-260. This is the only layer that fixes rungs 4 and 5 of the ladder.</text>
  </g>

  <!-- right column: the gaps -->
  <rect class="box-b" x="860" y="102" width="210" height="180" rx="10"/>
  <text class="t-bad" x="876" y="126" font-size="14">known gap</text>
  <text class="t-sm" x="876" y="150">container traffic</text>
  <text class="t-sm" x="876" y="168">forwarded to a</text>
  <text class="t-sm" x="876" y="186">published port is</text>
  <text class="t-sm" x="876" y="204">evaluated in the</text>
  <text class="t-sm" x="876" y="222">FORWARD hook, where</text>
  <text class="t-sm" x="876" y="240">Docker / CNI</text>
  <text class="t-sm" x="876" y="258">insert their own rules</text>
  <text class="t-xs" x="876" y="280">ufw's INPUT policy is</text>
  <text class="t-xs" x="876" y="296">not consulted for it.</text>
  <text class="t-xs" x="876" y="316">see the next figure.</text>

  <rect class="box-w" x="860" y="294" width="210" height="230" rx="10"/>
  <text class="t-warn" x="876" y="318" font-size="14">the limit of all six</text>
  <text class="t-sm" x="876" y="342">Layers 1–6 decide</text>
  <text class="t-sm" x="876" y="360"><tspan font-style="italic">whether</tspan> a peer, a</text>
  <text class="t-sm" x="876" y="378">user or a process may</text>
  <text class="t-sm" x="876" y="396">do something.</text>
  <text class="t-sm" x="876" y="422">They never decide</text>
  <text class="t-sm" x="876" y="440"><tspan font-style="italic">whether the request</tspan></text>
  <text class="t-sm" x="876" y="458"><tspan font-style="italic">is legitimate</tspan>.</text>
  <text class="t-xs" x="876" y="484">A perfectly configured</text>
  <text class="t-xs" x="876" y="500">host happily serves a</text>
  <text class="t-xs" x="876" y="516">request that destroys</text>
  <text class="t-xs" x="876" y="532">your data.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Layer 4 in detail: sshd, which is the only login on this machine",
        p: [
          "There is exactly one authentication surface on a server like this, so it deserves disproportionate attention. The first rule is that <strong>you must read the effective configuration, not the file</strong>. <code>/etc/ssh/sshd_config</code> is only the first match: <code>Include /etc/ssh/sshd_config.d/*.conf</code> at the top is evaluated <em>first</em>, so a drop-in file silently overrides your main-file edit, and the first value the parser sees for a keyword wins.",
          "<code>sshd -T</code> prints the resolved configuration exactly as the running daemon sees it — every keyword, every default, after includes and <code>Match</code> blocks. <code>sshd -t</code> only validates syntax and file permissions and prints nothing on success. Use the first for questions and the second before every reload, because a typo in <code>sshd_config</code> that fails to parse leaves the running daemon untouched — while a typo that parses but disables your key leaves you locked out on the next reload.",
          "The effective values that matter on this box, and what they are set to: <code>passwordauthentication no</code>, <code>kbdinteractiveauthentication no</code> (printed under this name by modern OpenSSH; the 7.6 on 18.04 spells the same option <code>ChallengeResponseAuthentication</code>), <code>permitrootlogin prohibit-password</code>, <code>pubkeyauthentication yes</code>, <code>permitemptypasswords no</code>, <code>x11forwarding no</code>, <code>allowtcpforwarding</code> — check this one, it defaults to <code>yes</code> and is the quietest hole on the box."
        ],
        noteTitle: "prohibit-password is not no",
        note: "<code>PermitRootLogin prohibit-password</code> means \"root may log in with a key, never with a password\". That is a genuine improvement over <code>yes</code>, and it is still root: an SSH key in root's <code>authorized_keys</code> is a key with <code>CAP_SYS_ADMIN</code>, <code>CAP_SYS_MODULE</code> and every other capability in the kernel, from which nothing is meaningfully contained. The reason the account's password is also locked (<code>passwd -S root</code> → <code>L</code>) is that it stops password auth from succeeding on the <em>account</em> path even if the daemon config regresses.",
        noteKind: "warn"
      },
      {
        type: "code",
        lang: "bash",
        what: "Read, test, then reload sshd without ever locking yourself out",
        code:
`# 1. what is actually in force — this, never the file
sudo sshd -T | grep -E '^(port|listenaddress|addressfamily|permitrootlogin|
  passwordauthentication|kbdinteractiveauthentication|challengeresponseauthentication|
  pubkeyauthentication|permitemptypasswords|maxauthtries|allowtcpforwarding|
  gatewayports|permittunnel|clientaliveinterval|clientalivecountmax|
  x11forwarding|allowusers|allowgroups|maxsessions|maxstartups|xauthloc)'
sudo sshd -T -C user=deploy,addr=100.64.0.7,host=ubuntu-2gb-hel1-1   # Match blocks need -C

# 2. syntax + file modes only; silent means OK
sudo sshd -t && echo "config parses"

# 3. reload without dropping the sessions you are sitting in
sudo systemctl reload ssh          # SIGHUP: re-reads config, keeps established connections
# NOT 'restart' — a restart on a bad config is how you lose the box

# 4. prove it from a second terminal before you close the first
ssh -o PasswordAuthentication=no -i ~/.ssh/id_ed25519 user@100.x.y.z true && echo "key path works"

# 5. where sshd is listening, and who is connected
sudo ss -ltnp 'sport = :22'
sudo ss -tnp state established '( sport = :22 )'
sudo journalctl -u ssh -b --no-pager | tail -20

# 6. verify a key fingerprint before you trust a file someone sent you
ssh-keygen -lf ~/.ssh/id_ed25519.pub
# 256 SHA256:1nQ3… ubuntu@MacBook (ED25519)`
      },
      {
        type: "table",
        cols: ["sshd_config keyword", "Default / this box", "What it really controls", "How it gets you locked out"],
        rows: [
          ["<code>PasswordAuthentication</code>", "<code>no</code> (Ubuntu cloud images ship this already; cloud-init also writes it)", "Whether the <code>password</code> auth method is offered at all. <code>no</code> means the server never prompts for a password, so no password is ever transmitted or rate-limited.", "If your only key is unreadable you have no second way in. Pair it with a console-capable path — the provider's serial console — before touching anything."],
          ["<code>KbdInteractiveAuthentication</code> / <code>ChallengeResponseAuthentication</code>", "<code>no</code>", "The keyboard-interactive method. PAM-backed (2FA, LDAP, SSSD) on most builds, and it counts as a password method — many guides that set only <code>PasswordAuthentication no</code> are still reachable via keyboard-interactive.", "With PAM in play this is the setting that decides whether your 2FA actually engages. Check <code>PAM yes</code> and <code>UsePAM yes</code> in the same output."],
          ["<code>PermitRootLogin</code>", "<code>prohibit-password</code> (18.04 default); <code>no</code> is strictly better", "Whether a login whose <em>name</em> resolves to uid 0 is permitted, and by which method. <code>prohibit-password</code> still allows keys.", "You cannot break a working session by editing this, but you can prevent yourself from using root+key as your only path during an emergency."],
          ["<code>AllowUsers</code> / <code>AllowGroups</code>", "unset here — the whole uid list is eligible", "A whitelist evaluated after the name resolves to a uid. The single most valuable line you can add, because it survives a future package creating an account.", "A typo in the pattern locks out <em>everyone</em>. Use a full username, and test with <code>sshd -T -C user=thatname</code> before reloading."],
          ["<code>MaxAuthTries</code>", "<code>6</code> (OpenSSH default; <code>sshd -T</code> is authoritative)", "Failed authentication attempts <em>per TCP connection</em>, counted across all methods. Lowering it to 3 costs one reconnect attempt and cuts a brute-forcer's per-connection throughput.", "If your agent offers several keys before the right one, the count includes each <em>offer</em>. Three loaded keys plus one wrong prompt can hit a low limit."],
          ["<code>AllowTcpForwarding</code>", "<code>yes</code> unless changed — <strong>check this</strong>", "Permission for <code>-L</code> local and <code>-R</code> remote forwarding. This is how a legitimate user publishes a port on a server that has no public listener for it.", "<code>no</code> also breaks <code>git clone</code> over <code>ssh://</code>, tunnels, and most VS Code remote workflows. Pair it with <code>AllowStreamLocalForwarding no</code>."],
          ["<code>GatewayPorts</code>", "<code>no</code> (default)", "Whether a <code>-R</code> remote forward binds the <em>server's</em> public interface or only loopback. <code>no</code> means <code>ssh -R 8080:…</code> is reachable only from the server itself.", "Setting <code>yes</code> (or <code>clientspecified</code>) is how an SSH-only box ends up serving the internet — see the figure below. This is a real incident pattern, not a hypothetical."],
          ["<code>ClientAliveInterval</code> / <code>ClientAliveCountMax</code>", "<code>0</code> / <code>3</code> (disabled)", "How often sshd sends a keepalive, and how many unanswered probes kill the session. <code>120</code> + <code>3</code> reaps half-dead sessions in about 6 minutes and closes the file-descriptor leak.", "It kills long idle interactive sessions, and a long <code>rsync</code> over a flaky link can be reaped mid-transfer. Tune it against your real sessions, not against theory."],
          ["<code>Match</code> blocks", "none on this box", "Per-user, per-address, per-port, even per-command <em>overrides</em> of everything above. Place them last; the first value obtained for a keyword wins, so a keyword set before a <code>Match</code> block cannot be changed inside it.", "<code>Match all</code> ends the block. Quoting rules differ inside <code>Match exec</code> and inside <code>AuthorizedKeysCommand</code> — where the arguments of the user's key are concatenated."],
          ["<code>PubkeyAcceptedKeyTypes</code> / <code>CASignatureAlgorithms</code>", "OpenSSH 7.6 here; 8.8+ disabled <code>ssh-rsa</code> by default", "Which key and signature algorithms the server will accept. RSA keys keep working via <code>rsa-sha2-256/512</code>; only the SHA-1 <code>ssh-rsa</code> signature is gone.", "An old CentOS 6 client or a hardware token with SHA-1 signatures will fail with <code>no matching host key type</code>. Prefer ECDSA P-256 or ED25519 rather than a 4096-bit RSA."],
          ["<code>StrictModes</code>", "<code>yes</code> (default, leave it)", "Requires <code>~/.ssh</code> to be owned by its owner with no group/other write, and <code>authorized_keys</code> to be 600/400. This is the enforcement behind the permissions rule.", "Turning it off to make a broken key work disables a real check. Fix the modes instead."],
          ["<code>LogLevel</code> / <code>SyslogFacility AUTH</code>", "<code>INFO</code> / <code>AUTH</code>", "How much detail reaches the journal or <code>/var/log/auth.log</code>: <code>VERBOSE</code> records each key offer and the fingerprint, which is exactly what you want while rotating keys.", "Passwords are never logged. The only real leak is <code>LogLevel DEBUG3</code>, which logs the traffic itself — never enable that on a live host."]
        ]
      },
      {
        type: "prose",
        h: "authorized_keys: a plain text file that is an execution policy",
        p: [
          "Each line of <code>~/.ssh/authorized_keys</code> is a key <em>and a set of restrictions</em>. Modern OpenSSH (7.2+, 2016) supports the prefix options, which turn one key file into a small access-control language — and they are almost never used, which is why a key that was pasted once in 2021 for a deploy script still grants an interactive shell five years later.",
          "<code>restrict</code> is the umbrella that disables port forwarding, agent forwarding, X11 forwarding, PTY allocation and <code>~/.ssh/rc</code> in one word; its negation <code>no-restrict</code> exists but defeats the purpose. <code>from=\"100.64.0.0/10,192.168.1.0/24\"</code> restricts the source address — and because Tailscale allocates from <code>100.64.0.0/10</code>, this is a per-peer allowlist written on the server. <code>command=\"…\"</code> runs a forced command regardless of what the client asked for, which is the mechanism behind restricted <code>scp</code>/<code>rsync</code> push accounts — but note that it must be combined with a wrapper that reconstructs the real arguments, or <code>rsync</code> fails with <code>command-line: unexpected argument</code>. <code>permitopen=\"127.0.0.1:5432\"</code> limits which destinations a forwarded port may reach.",
          "The permissions are not a style preference: <code>StrictModes yes</code> makes sshd silently ignore a key file that is group- or world-writable, and the diagnostic is a <code>WARNING: BAD OWNER OR PERMISSIONS</code> line in the journal that most people never read. <code>chmod 700 ~/.ssh</code> and <code>chmod 600 ~/.ssh/authorized_keys</code>, both owned by the account, is the floor."
        ]
      },
      {
        type: "code",
        lang: "bash",
        what: "Key hygiene: inspect, restrict, rotate, verify — the whole lifecycle",
        code:
`# --- inspect what is currently authorised (one file per account) ---
for u in root ubuntu deploy alex; do
  [ -f /home/$u/.ssh/authorized_keys ] && {
    echo "== $u"; sudo stat -c '%a %U:%G %n' /home/$u/.ssh /home/$u/.ssh/authorized_keys
    sudo ssh-keygen -l -f /home/$u/.ssh/authorized_keys      # one line per key, SHA256 fingerprint
  }
done

# --- a restricted key: a publish-only account for rsync from your laptop ---
# "restrict" = no port/agent/X11 forwarding, no PTY, no ~/.ssh/rc
# "from="    = only accept from the Tailscale range (per-device, tighten to /32)
# "command=" = forced command; the client can lie about args, the server does not care
sudo install -d -m 700 -o alex -g alex /home/alex/.ssh
printf '%s\n' \
  'restrict,from="100.64.0.0/10",command="/usr/local/bin/publish-check" ssh-ed25519 AAAAC3Nz... alex@MacBook' \
  | sudo tee -a /home/alex/.ssh/authorized_keys >/dev/null
sudo chmod 600 /home/alex/.ssh/authorized_keys
sudo chown alex:alex /home/alex/.ssh/authorized_keys
sudo -u alex ssh-keygen -l -f /home/alex/.ssh/authorized_keys

# --- the mode check, exactly as sshd sees it ---
sudo install -d -m 700 -o alex -g alex /home/alex/.ssh && \
  stat -c '%a %U:%G %n' /home/alex/.ssh /home/alex/.ssh/authorized_keys
# sshd refuses anything group/other-writable and logs it, it does not print it to your tty

# --- key rotation without a lockout window ---
# 1 generate the new key on the client
ssh-keygen -t ed25519 -a 100 -C "alex@MacBook-2026" -f ~/.ssh/id_ed25519_2026
# 2 add it alongside the old one, then VERIFY the new key works end to end
ssh -i ~/.ssh/id_ed25519_2026 alex@100.x.y.z 'hostname; uname -r'
# 3 only now remove the old line, from the exact fingerprint you printed above
sudo sed -i '/SSH-ED25519-AAAA…OLD-FINGERPRINT…/d' /home/alex/.ssh/authorized_keys
# 4 because one ED25519 key is shared by two accounts here, grep BOTH and rotate both
sudo grep -Rl "AAAAC3NzaC1lZDI1NTE5AAAA" /home/*/.ssh/ /root/.ssh/ 2>/dev/null

# --- verify a fingerprint out of band before trusting it ---
ssh-keygen -lf /home/alex/.ssh/authorized_keys          # server side: what is authorised
ssh-keyscan -t ed25519 100.x.y.z 2>/dev/null | ssh-keygen -lf -   # from the wire, compare by eye
# If the two differ, you are talking to something else — stop and investigate.`
      },
      {
        type: "diagram",
        h: "How a reverse tunnel silently becomes a public service",
        caption: "The mechanism is <code>GatewayPorts</code>, not a firewall rule. With the default <code>no</code>, the forwarded listener is created on the server's <em>loopback</em> and only the server itself can connect. Set it to <code>yes</code> (or <code>clientspecified</code>) and the very same command binds <code>0.0.0.0</code> — a public service that no ufw rule mentions, created by an authenticated user, invisible to <code>ufw status</code>.",
        svg: `
<svg viewBox="0 0 1100 440" role="img" aria-label="Diagram of SSH remote port forwarding and the GatewayPorts setting deciding loopback or public binding">
  <rect class="box-a" x="30" y="30" width="210" height="110" rx="10"/>
  <text class="t-accent" x="46" y="56" font-size="15">your laptop</text>
  <text class="t-sm" x="46" y="80">ssh -R 8080:localhost:3000</text>
  <text class="t-sm" x="46" y="100">-R 0.0.0.0:8080:localhost:3000</text>
  <text class="t-xs" x="46" y="122">the second form binds a</text>
  <text class="t-xs" x="46" y="136">specific address</text>

  <rect class="box-v" x="300" y="30" width="200" height="110" rx="10"/>
  <text class="t-violet" x="316" y="56" font-size="15">sshd on the server</text>
  <text class="t-sm" x="316" y="80">authenticated, so allowed</text>
  <text class="t-sm" x="316" y="100">to forward</text>
  <text class="t-xs" x="316" y="122">AllowTcpForwarding yes</text>

  <path class="ln-a" d="M240,80 L296,80" marker-end="url(#lm-arrow-accent)"/>
  <text class="t-xs" x="246" y="68">tunnels</text>

  <!-- GatewayPorts decision -->
  <rect class="box-w" x="560" y="26" width="200" height="118" rx="10"/>
  <text class="t-warn" x="576" y="52" font-size="15">GatewayPorts</text>
  <text class="t-sm" x="576" y="78">no  (default)</text>
  <text class="t-sm" x="576" y="98">yes / clientspecified</text>
  <text class="t-xs" x="576" y="120">sshd_config keyword,</text>
  <text class="t-xs" x="576" y="136">applied per session</text>
  <path class="ln-a" d="M500,80 L556,60" marker-end="url(#lm-arrow-accent)"/>

  <!-- outcome left -->
  <rect class="box-ok" x="560" y="168" width="250" height="120" rx="10"/>
  <text class="t-ok" x="578" y="194" font-size="15">binds 127.0.0.1:8080</text>
  <text class="t-sm" x="578" y="218">only the server itself,</text>
  <text class="t-sm" x="578" y="238">or another user over the</text>
  <text class="t-sm" x="578" y="258">same host, can reach it</text>
  <text class="t-xs" x="578" y="280">not in ss -ltnp from</text>
  <text class="t-xs" x="578" y="294">outside — this is safe</text>
  <path class="ln-ok" d="M660,148 L660,164" marker-end="url(#lm-arrow-ok)"/>

  <!-- outcome right -->
  <rect class="box-b" x="830" y="168" width="240" height="120" rx="10"/>
  <text class="t-bad" x="846" y="194" font-size="15">binds 0.0.0.0:8080</text>
  <text class="t-sm" x="846" y="218">a public HTTP service</text>
  <text class="t-sm" x="846" y="238">created by a normal user</text>
  <text class="t-sm" x="846" y="258">with a normal key</text>
  <text class="t-xs" x="846" y="280">ufw was never consulted;</text>
  <text class="t-xs" x="846" y="294">you did not write a rule</text>
  <path class="ln-b" d="M720,148 L900,164" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box" x="30" y="312" width="1040" height="108" rx="10"/>
  <text class="t-title" x="48" y="338" font-size="14.5">how to see it, and how to stop it</text>
  <text class="t-sm" x="48" y="362">Evidence: <tspan class="t-mono">ss -ltnp</tspan> shows a listener owned by <tspan class="t-mono">sshd</tspan>, not by nginx — an SSH forward is a listening socket in sshd's process, which is why it looks like a mystery service and not like SSH.</text>
  <text class="t-sm" x="48" y="386">Prevention: <tspan class="t-mono">AllowTcpForwarding no</tspan> for ordinary accounts, and put forced-command, restrict-only keys on any account that genuinely needs to push files.</text>
  <text class="t-sm" x="48" y="410">Also check <tspan class="t-mono">ss -tnp 'sport = :22'</tspan> for established sessions you do not recognise — each one is somebody's tunnel right now.</text>
</svg>`
      },
      {
        type: "prose",
        h: "Why Tailscale-only SSH is a different kind of control",
        p: [
          "A firewall rule and a VPN are both \"only my machines can connect\". They are not the same control, and the difference shows up in the first five minutes of an incident.",
          "A firewall rule protects a <strong>port</strong>. The port still listens, still exists, still answers SYN probes with RST, still appears in every scanner's results, still generates log volume, and still has 30 years of sshd CVEs pointed at it. You are trusting one netfilter rule chain, in a file managed by ufw, on a host where Docker may rewrite the FORWARD chain behind your back.",
          "A VPN protects a <strong>network</strong>. With SSH reachable only over the tailnet, <code>sshd</code> binds an RFC1918 address on <code>tailscale0</code>; no scanner on earth can route a packet there, because the address is not globally routable. The control is cryptographic — WireGuard authenticates each peer with a node key — and policy lives centrally in the tailnet ACL, where you can revoke a device identity without touching the machine. If the host is compromised, revoking the node key in the admin console is a genuine incident-response action, not just a config change on a box the attacker now owns.",
          "There are honest caveats. <code>tailscale ssh</code> (Tailscale's own SSH implementation, replacing OpenSSH entirely, identity from tailnet SSO and session recording in the control plane) is a different feature from \"SSH over the tailnet with OpenSSH\", and they can coexist — check which one is actually serving, because <code>ss -ltnp</code> will show you. ACLs are only as good as the identity provider feeding them: a node in an authenticated tailnet that you share with others, or a laptop with a stolen session cookie, inherits everything that tailnet identity can reach. And if you ever disable Tailscale for debugging, the box becomes public on port 22 unless sshd is separately bound — which is precisely why the safe configuration is <em>both</em>: Tailscale-only reachability <em>and</em> a ufw rule that permits 22 on <code>tailscale0</code> and nowhere else."
        ],
        noteTitle: "The defence-in-depth point",
        note: "If SSH is only on the tailnet, then any ufw outage, Docker chain rewrite, or accidental interface change exposes nothing. That is the difference between one control and two independent ones. Both of these are already true on this box: key-only sshd, and SSH reachable over Tailscale only.",
        noteKind: "tip"
      },
      {
        type: "prose",
        h: "Least privilege: three ways to be less than root, and the trap in the middle",
        p: [
          "On this host the daemons that matter already run unprivileged: nginx workers as <code>www-data</code>, named as <code>bind</code>, which means a compromise of one of them starts with a uid that cannot read <code>/etc/shadow</code>, cannot open a raw socket, and cannot load a kernel module. That is the single most valuable property of the whole machine, and it is free — it comes from the package layout, not from your effort. Preserve it: if you set <code>user root</code> in a systemd unit for convenience, you have removed it.",
          "Between \"unprivileged uid\" and \"root\" there are three intermediate mechanisms, and they behave very differently. A <strong>setuid binary</strong> starts as one user and transitions to another when executed; it is all-or-nothing, and it is why a kernel-local-root escalation matters so much. <strong>File capabilities</strong> (<code>setcap</code>) attach a specific set of capabilities to a specific binary, which is a genuine improvement — but they are <em>lost</em> across some filesystems that do not support <code>xattr</code>, they do not survive a package upgrade that replaces the file (the <code>setcap</code> must be reapplied), and they are silently incompatible with <code>NoNewPrivileges=yes</code>.",
          "The trap is <code>CAP_SYS_ADMIN</code>. It is called \"the new root\" for good reason: it lets a process mount filesystems, create user namespaces, manipulate cgroups, override most capability and LSM checks, and read physical memory. Granting <code>CAP_SYS_ADMIN</code> to \"fix\" a permission problem is a strictly worse version of running as root, because you lose the visibility without losing the power. If a daemon genuinely needs <code>CAP_SYS_ADMIN</code>, it is a daemon that should be in a container or on its own host.",
          "One last free win on ports below 1024: <code>net.ipv4.ip_unprivileged_port_start=0</code> lets any uid bind port 80 with no setuid and no file capabilities at all. The real permission check (the DAC check in <code>inode_permission</code>) happens before any <code>CAP_NET_BIND_SERVICE</code> override, which is why it works on a plain unprivileged binary."
        ],
        noteTitle: "The rule to remember",
        note: "Capabilities reduce <em>what a process can touch</em>, not <em>what a bug can reach</em>. Removing a daemon's root bits reduces the damage of an arbitrary-code-execution bug by roughly two orders of magnitude; adding <code>CAP_SYS_ADMIN</code> removes most of that benefit back again.",
        noteKind: "boss"
      },
      {
        type: "diagram",
        h: "Five privilege models, ranked by how much they actually grant",
        caption: "The right-hand column is the part people get wrong: a mechanism that <em>looks</em> narrow can be wide. <code>CAP_SYS_ADMIN</code> is the canonical example — it is not \"one capability\", it is most of what makes root root. Order these by the blast radius of a remote code execution bug in the process, not by how elegant the mechanism is.",
        svg: `
<svg viewBox="0 0 1100 470" role="img" aria-label="Comparison of root, sudo, setuid binary, file capability and restricted service privilege">
  <g>
  <rect class="box-b" x="30" y="30" width="200" height="370" rx="10"/>
  <text class="t-bad" x="46" y="56" font-size="15">uid 0</text>
  <text class="t-sm" x="46" y="84">everything, and</text>
  <text class="t-sm" x="46" y="102">nothing between you</text>
  <text class="t-sm" x="46" y="120">and a shell as root</text>
  <line class="ln-b" x1="46" y1="140" x2="214" y2="140"/>
  <text class="t-xs" x="46" y="162">can read /etc/shadow,</text>
  <text class="t-xs" x="46" y="178">load modules, open raw</text>
  <text class="t-xs" x="46" y="194">sockets, mount, ptrace</text>
  <text class="t-xs" x="46" y="210">anything</text>
  <text class="t-xs" x="46" y="240">on this box: root</text>
  <text class="t-xs" x="46" y="256">is used for sshd's</text>
  <text class="t-xs" x="46" y="272">privilege separation and</text>
  <text class="t-xs" x="46" y="288">nothing else</text>
  <text class="t-bad" x="46" y="330" font-size="13.5">blast radius</text>
  <text class="t-bad" x="46" y="352" font-size="15">total</text>

  <rect class="box-w" x="240" y="30" width="200" height="370" rx="10"/>
  <text class="t-warn" x="256" y="56" font-size="15">setuid binary</text>
  <text class="t-sm" x="256" y="84">full uid 0 for the</text>
  <text class="t-sm" x="256" y="102">duration of the call</text>
  <text class="t-xs" x="256" y="128">chown, passwd, mount,</text>
  <text class="t-xs" x="256" y="144">su, sudo, newgrp,</text>
  <text class="t-xs" x="256" y="160">pkexec + anything with</text>
  <text class="t-xs" x="256" y="176">futexes</text>
  <text class="t-xs" x="256" y="206">audit what is there:</text>
  <text class="t-mono" x="256" y="224">find / -perm -4000</text>
  <text class="t-warn" x="256" y="266" font-size="13.5">blast radius</text>
  <text class="t-warn" x="256" y="288" font-size="15">total, briefly</text>

  <rect class="box-v" x="450" y="30" width="200" height="370" rx="10"/>
  <text class="t-violet" x="466" y="56" font-size="15">file capability</text>
  <text class="t-sm" x="466" y="84">setcap cap_net_bind</text>
  <text class="t-sm" x="466" y="102">_service=+ep /path</text>
  <text class="t-xs" x="466" y="128">only that capability,</text>
  <text class="t-xs" x="466" y="144">only that binary, and</text>
  <text class="t-xs" x="466" y="160">you can read it back:</text>
  <text class="t-mono" x="466" y="180">getcap /path</text>
  <text class="t-xs" x="466" y="204">lost on: fs without</text>
  <text class="t-xs" x="466" y="220">xattr, package upgrade,</text>
  <text class="t-xs" x="466" y="236">NoNewPrivileges=yes</text>
  <text class="t-vio" x="466" y="272" font-size="13.5" fill="var(--violet)">blast radius</text>
  <text class="t-sm" x="466" y="294">one sysctl class</text>

  <rect class="box-ok" x="660" y="30" width="200" height="370" rx="10"/>
  <text class="t-ok" x="676" y="56" font-size="15">capability-bounded</text>
  <text class="t-sm" x="676" y="84">service</text>
  <text class="t-sm" x="676" y="108">User=www-data</text>
  <text class="t-sm" x="676" y="126">CapabilityBoundingSet=</text>
  <text class="t-sm" x="676" y="142">CAP_NET_BIND_SERVICE</text>
  <text class="t-xs" x="676" y="170">a uid and an explicit</text>
  <text class="t-xs" x="676" y="186">cap list, enforced by</text>
  <text class="t-xs" x="676" y="202">the kernel at exec</text>
  <text class="t-xs" x="676" y="230">read it back:</text>
  <text class="t-mono" x="676" y="250">CapEff in</text>
  <text class="t-mono" x="676" y="266">/proc/PID/status</text>
  <text class="t-ok" x="676" y="300" font-size="13.5">blast radius</text>
  <text class="t-sm" x="676" y="322">exactly what you typed</text>

  <rect class="box-a" x="870" y="30" width="200" height="370" rx="10"/>
  <text class="t-accent" x="886" y="56" font-size="15">unprivileged uid</text>
  <text class="t-sm" x="886" y="84">www-data, bind,</text>
  <text class="t-sm" x="886" y="102">nobody, your own</text>
  <text class="t-xs" x="886" y="128">no shadow, no raw</text>
  <text class="t-xs" x="886" y="144">sockets, no module</text>
  <text class="t-xs" x="886" y="160">load, no ptrace of</text>
  <text class="t-xs" x="886" y="176">other users' processes</text>
  <text class="t-xs" x="886" y="206">plus ip_unprivileged</text>
  <text class="t-xs" x="886" y="222">_port_start=0 for</text>
  <text class="t-xs" x="886" y="238">ports &lt; 1024</text>
  <text class="t-ok" x="886" y="276" font-size="13.5">blast radius</text>
  <text class="t-sm" x="886" y="298">one account's files</text>
  <text class="t-xs" x="886" y="332">this is the default</text>
  <text class="t-xs" x="886" y="348">state of nginx and</text>
  <text class="t-xs" x="886" y="364">named on this box</text>
  </g>
  <line class="ln" x1="820" y1="414" x2="820" y2="430"/>
  <text class="t-dim" x="820" y="448" text-anchor="middle" font-size="14">narrower blast radius ←————— you want to be on this end ——————→ wider</text>
  <text class="t-dim" x="130" y="448" font-size="14"></text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Least-privilege audit: who is root, what is setuid, what capabilities exist, what does the process actually hold",
        code:
`# who is running as root right now — a normal daemon in this list is a finding
ps -eo user:16,pid,ppid,stat,comm --sort=user | awk '$1 ~ /root/'
# expect: sshd (privilege separation), systemd-journald, the odd one-shot unit.
# nginx master on Debian/Ubuntu starts as root to bind :80 then drops to www-data in workers.

# setuid + setgid inventory, and what each binary is
find / -xdev -perm -4000 -o -xdev -perm -2000 2>/dev/null | sort
# expect roughly: /usr/bin/passwd /usr/bin/sudo /usr/bin/su /usr/bin/mount
#               /usr/bin/umount /usr/bin/chsh /usr/bin/chfn /usr/bin/gpasswd
#               /usr/bin/newgrp /usr/bin/pkexec /usr/lib/dbus-1.0/dbus-daemon-launch-helper
#               /usr/lib/policykit-1/polkit-agent-helper-1 /usr/bin/newuidmap /usr/bin/newgidmap
# anything ELSE setuid on your box is an answer you should be able to give

# file capabilities already attached anywhere on the system
getcap -r / 2>/dev/null
# CapEff is what the process holds RIGHT NOW, in hex; CapBnd is the ceiling it was given
grep -E '^Cap(Inh|Prm|Eff|Bnd|Amb)' /proc/$(pgrep -o nginx)/status
capsh --decode=00000000a80425fb        # decode the hex into names
# on this box nginx workers show no capabilities at all — port 80 is bound by the
# root master before setuid(www-data), which is the classic, correct arrangement

# let an unprivileged binary bind :80 with no setuid and no file capability
sysctl net.ipv4.ip_unprivileged_port_start=0     # kernel >= 4.11; persist in /etc/sysctl.d/

# what a systemd unit may become — this is the file you actually edit
systemd-analyze security nginx.service
systemctl show nginx.service -p User -p Group -p CapabilityBoundingSet \
  -p NoNewPrivileges -p ProtectSystem -p PrivateTmp -p RestrictAddressFamilies
systemctl cat nginx.service                      # unit + every drop-in, in order`
      },
      {
        type: "prose",
        h: "systemd hardening directives, and the daemon each one will break",
        p: [
          "systemd is the cheapest place to apply least privilege, because the unit file is already the authoritative statement of how a daemon runs. The directives below are not a checklist — each has a specific failure mode, and the useful question is always \"what does this break?\" rather than \"is this on?\".",
          "Start with the two that are nearly free and then verify: <code>NoNewPrivileges=yes</code> (the process can never gain privilege via setuid, setgid or file capabilities) and <code>ProtectSystem=strict</code> (the unit gets <code>/usr</code>, <code>/boot</code> and <code>/etc</code> mounted read-only). Those two already remove the classic persistence locations — a dropped <code>/etc/cron.d</code> job, a replaced <code>/usr/bin</code> binary — from a compromised web worker. Then <code>ProtectHome=yes</code> hides <code>/home</code>, <code>/root</code> and <code>/run/user</code>, which stops the “read the deploy user's private key” step of most post-exploitation playbooks.",
          "The ones that break things are worth memorising, because you will hit them. <code>PrivateTmp=yes</code> gives the unit its own <code>/tmp</code> mount namespace, so a file written to <code>/tmp</code> by that service is invisible to every other service — any workflow that passes files through <code>/tmp</code> between units silently stops working. <code>MemoryDenyWriteExecute=yes</code> makes writable-then-executable memory impossible, which breaks every JIT: Java, .NET, some JavaScript engines, and anything using <code>libffi</code>. <code>RestrictNamespaces=yes</code> breaks bubblewrap, <code>unshare</code>-based tooling, and Docker-in-Docker. <code>PrivateDevices=yes</code> removes everything from <code>/dev</code> except the basics, which breaks anything needing <code>/dev/kmsg</code>, <code>/dev/net/tun</code>, <code>/dev/kvm</code> or a real block device.",
          "Finally, <code>systemd-analyze security &lt;unit&gt;</code> gives you a score out of 10 per exposure and explains each one. It is not a target — a service that reads <code>/proc/sys</code> and one that does not have identical profiles — but the diff between two versions of the same unit tells you exactly what you changed and why."
        ]
      },
      {
        type: "table",
        cols: ["Directive", "What it blocks", "What it breaks — read this before using it"],
        rows: [
          ["<code>NoNewPrivileges=yes</code>", "Any gain of privilege through execve of a setuid/setgid binary or a file capability. Nothing that is already privileged is affected, and a normal <code>setuid(2)</code> to a <em>lower</em>-privilege uid still works.", "Any daemon that legitimately relies on a helper binary being setuid. It is also mutually exclusive with file capabilities: if you gave nginx <code>CAP_NET_BIND_SERVICE</code> with <code>setcap</code>, this directive makes it fail to bind. Pick one mechanism."],
          ["<code>ProtectSystem=strict</code>", "Writes to <code>/usr</code>, <code>/boot</code>, <code>/efi</code>, <code>/etc</code>. Persistence via a modified binary or config becomes impossible.", "Any package-conformant daemon that writes a cache or a pid file outside <code>StateDirectory=</code>/<code>LogsDirectory=</code>. Fix with <code>ReadWritePaths=/var/lib/thing</code>, and prefer the directory directives over raw paths."],
          ["<code>ProtectHome=yes</code>", "All access to <code>/home</code>, <code>/root</code>, <code>/run/user</code>. <code>read-only</code> keeps them visible but immutable; <code>tmpfs</code> replaces them with empty writable tmpfs.", "Anything that legitimately serves or processes user files — a file-sync daemon, a backup agent, a static generator that reads a home directory. On this box, an rsync publish unit must not read <code>/home/alex</code> as root; give it a real service user and a <code>ReadOnlyPaths</code>-shaped design."],
          ["<code>PrivateTmp=yes</code>", "Cross-service visibility of <code>/tmp</code> and <code>/var/tmp</code>; also stops a tmpfs-exhaustion DoS by another unit.", "Cross-unit <code>/tmp</code> file passing. Also breaks tools that assume <code>/tmp</code> is shared with the host, like some container runtimes and most ad-hoc <code>nginx</code> upload workflows."],
          ["<code>ReadWritePaths=</code>", "Nothing — this is the escape hatch for <code>ProtectSystem=strict</code>. Paths given here are remounted writable for this unit only.", "A typo does not fail loudly; the mount simply stays read-only and the daemon logs EROFS. Check with <code>systemctl show unit -p ReadWritePaths</code> and read the journal for <code>Read-only file system</code>."],
          ["<code>PrivateDevices=yes</code>", "Access to physical devices: block devices, /dev/kmsg, /dev/mem, /dev/net/tun, USB. Provides <code>/dev/null</code>, <code>/dev/zero</code>, <code>/dev/random</code>, <code>/dev/urandom</code>, <code>/dev/shm</code>.", "WireGuard (<code>/dev/net/tun</code>), <code>dmesg</code>-style tools, VM daemons, anything that opens a raw block device, and Docker/containerd if you tried to run them in a unit."],
          ["<code>CapabilityBoundingSet=</code>", "Every capability not listed, at and above exec. Works together with the uid: the kernel intersects what the process may have with what it <em>did</em> have.", "Set it to a name the daemon actually needs. An empty set plus <code>AmbientCapabilities=</code> for the one capability is the correct shape. <code>CAP_SYS_ADMIN</code> in a bounding set means the unit is root with extra steps."],
          ["<code>SystemCallFilter=~@privileged @resources @obsolete</code>", "Whole syscall families: <code>@mount</code>, <code>@reboot</code>, <code>@module</code>, <code>@swap</code>, <code>@clock</code>, <code>@cpu-emulation</code>, <code>@debug</code>, <code>@obsolete</code>.", "Anything using <code>ptrace</code>, <code>bpf()</code>, <code>perf_event_open</code>, <code>io_uring</code>, <code>clone3</code> or unusual namespaces. Test the service, do not assume — the failure is <code>EPERM</code> at an arbitrary point in startup, which looks nothing like a filter."],
          ["<code>MemoryDenyWriteExecute=yes</code>", "Writable-then-executable memory, defeating a whole class of shellcode-injection exploits.", "Every JIT: Java, .NET, some JavaScript engines, LuaJIT, anything using <code>libffi</code> to call generated trampolines. Also some <code>gcc</code>/<code>ld</code> plugin mechanisms."],
          ["<code>RestrictNamespaces=yes</code>", "Process creation of any namespace except the ones you name.", "bubblewrap, flatpak, <code>unshare</code>-based tooling, rootless podman, Docker-in-Docker, anything that is <em>itself</em> a sandbox. This directive is for leaf services, not for platforms."],
          ["<code>LockPersonality=yes</code>", "<code>personality(2)</code>, which changes execution domain/ABI flags.", "Old JVM crash handlers, software that changes its code model, some static analysers. Rarely a real break, but it is also rarely a real risk, which is why it is a fine default."],
          ["<code>ProtectKernelTunables=yes</code>, <code>ProtectControlGroups=yes</code>", "Writes to <code>/proc/sys</code>, <code>/sys</code>, and <code>/sys/fs/cgroup</code> — i.e. a service cannot reconfigure the kernel or its own limits.", "On cgroups <strong>v1</strong> this is what stops a service raising its own memory limit; on <strong>v2</strong> the same policy is expressed by making the cgroup tree read-only. Be careful with anything that legitimately tunes itself (some agents, some network daemons)."],
          ["<code>IPAddressAllow=/Deny=</code>", "Applies a BPF cgroup filter to which addresses the unit's sockets may talk to.", "Needs <code>CONFIG_CGROUP_BPF</code> and a BPF-capable kernel; on 4.15 it exists but is slow and occasionally buggy. Fine as a lockdown for a DNS-forwarding resolver, a bad idea to add broadly on an old kernel."],
          ["<code>StateDirectory=</code> / <code>LogsDirectory=</code> / <code>RuntimeDirectory=</code>", "Nothing — these create <code>/var/lib/&lt;name&gt;</code>, <code>/var/log/&lt;name&gt;</code>, <code>/run/&lt;name&gt;</code> with the right ownership and lifecycle, and give you <code>ProtectSystem=strict</code>-compatible paths.", "Nothing, and they are the reason to prefer them over hand-rolled <code>ExecStartPre=mkdir</code> plus <code>ReadWritePaths</code>. Available since systemd 235; this box runs 237."]
        ]
      },
      {
        type: "prose",
        h: "Firewall: what ufw is, and the two traps everyone falls into",
        p: [
          "ufw is not a firewall. It is a script generator that writes iptables rules into <code>/etc/ufw/user.rules</code> plus a handful of hook chains (<code>ufw-before-input</code>, <code>ufw-after-input</code>, and the same for forward and output), and then calls <code>iptables-restore</code> to load them atomically. That design has one enormous advantage — <code>ufw reload</code> is all-or-nothing, so you never leave a host with a half-applied ruleset — and one enormous trap, because the rules it owns are only the ones it wrote.",
          "Trap one is the <strong>OUTPUT policy debate</strong>. <code>ufw default deny outgoing</code> is genuinely valuable: it stops a compromised process from calling home to a command-and-control server, exfiltrating to an arbitrary host, or fetching a payload, and it is the only control that survives the attacker already having code execution. It is also the setting most likely to take down a package update, a DNS resolution to a new server, or a monitoring agent, and when it does, the recovery path is a console. The pragmatic middle ground is to allow outbound generally and deny only the address space that has no business being talked to on a web server: <code>127.0.0.0/8</code> exceptions, RFC1918, link-local (which is where <code>169.254.169.254</code>, the cloud metadata endpoint, lives — the single most valuable egress rule on any cloud host), and multicast.",
          "Trap two is that <strong>ufw and iptables do not reliably police forwarded traffic</strong>, and therefore do not police containers. A packet sent to a Docker-published port or a Kubernetes service IP never traverses the host's <code>INPUT</code> chain at all — it goes through <code>FORWARD</code>, and Docker inserts its own accept rules at the top of that chain before ufw's <code>ufw-before-forward</code> gets a say. The documented workaround is to put your rules in the <code>DOCKER-USER</code> chain, which is evaluated before Docker's accepts. This is not a theory: \"my container port is not reachable from outside but my firewall says it is\" is one of the most common server-security surprises there is, and it is why <code>-p 0.0.0.0:8080:80</code> publishes to the world regardless of ufw."
        ],
        noteTitle: "legacy vs nft, the third trap",
        note: "This box runs iptables 1.6.1 with the <em>legacy</em> backend (<code>iptables -V</code> prints <code>legacy</code>). Ubuntu 18.10+ ships iptables 1.8.x with two separate binaries — <code>iptables-legacy</code> and <code>iptables-nft</code> — selected by <code>update-alternatives</code>. The failure is silent and total: apply a rule with the nft binary while your tooling reads the legacy tables (or vice versa) and the command succeeds, the rule is not in the table the other binary shows, and you conclude your firewall is broken when it is simply a different ruleset. Check <code>update-alternatives --query iptables</code> and match the binary to the backend you actually intend. nftables on modern systems is the better answer: one tool for IPv4 and IPv6, sets and maps, and transactional <code>nft -f</code> replacement of an entire ruleset.",
        noteKind: "danger"
      },
      {
        type: "diagram",
        h: "Why your firewall does not see the container's port",
        caption: "Trace one packet to a published container port. It is <em>not</em> addressed to the host's IP stack — DNAT rewrites it in <code>nat/PREROUTING</code> — so it goes to <code>FORWARD</code>, not <code>INPUT</code>. ufw's <code>default deny incoming</code> is an <code>INPUT</code> policy. Docker's chain sits above ufw's forwarding hooks and <code>ACCEPT</code>s it. <code>DOCKER-USER</code> is the only chain evaluated early enough for your own rules to matter.",
        svg: `
<svg viewBox="0 0 1100 520" role="img" aria-label="Packet path to a published container port showing nat PREROUTING, FORWARD chain order and where ufw and Docker rules apply">
  <!-- packet source -->
  <rect class="box-b" x="30" y="30" width="190" height="86" rx="10"/>
  <text class="t-bad" x="46" y="56" font-size="15">internet client</text>
  <text class="t-sm" x="46" y="78">to 203.0.113.7:8080</text>
  <text class="t-xs" x="46" y="100">the published port</text>

  <!-- chain boxes -->
  <rect class="box-w" x="270" y="26" width="220" height="94" rx="10"/>
  <text class="t-warn" x="288" y="52" font-size="14.5">nat PREROUTING</text>
  <text class="t-sm" x="288" y="74">DNAT 203.0.113.7:8080</text>
  <text class="t-sm" x="288" y="92">→ 172.17.0.2:80</text>
  <text class="t-xs" x="288" y="112">now it is not ours</text>
  <path class="ln-b" d="M220,73 L266,73" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-b" x="270" y="140" width="220" height="124" rx="10"/>
  <text class="t-bad" x="288" y="166" font-size="14.5">FORWARD chain</text>
  <text class="t-sm" x="288" y="188">1. DOCKER-USER   ←</text>
  <text class="t-xs" x="288" y="204">the only place your</text>
  <text class="t-xs" x="288" y="220">own rule can go</text>
  <text class="t-sm" x="288" y="244">2. DOCKER         ACCEPT</text>
  <text class="t-sm" x="288" y="260">3. ufw-before-forward</text>
  <path class="ln-b" d="M380,124 L380,136" marker-end="url(#lm-arrow-bad)"/>

  <!-- INPUT contrast -->
  <rect class="box-ok" x="540" y="26" width="230" height="94" rx="10"/>
  <text class="t-ok" x="558" y="52" font-size="14.5">INPUT chain</text>
  <text class="t-sm" x="558" y="74">ufw default deny</text>
  <text class="t-sm" x="558" y="92">incoming applies here</text>
  <text class="t-xs" x="558" y="112">never traversed by</text>
  <text class="t-xs" x="558" y="128">a forwarded packet</text>

  <rect class="box-a" x="540" y="140" width="230" height="124" rx="10"/>
  <text class="t-accent" x="558" y="166" font-size="14.5">the same host, INPUT</text>
  <text class="t-sm" x="558" y="188">curl to 203.0.113.7:8080</text>
  <text class="t-sm" x="558" y="206">with hairpin NAT is</text>
  <text class="t-sm" x="558" y="224">DNAT'd and forwarded,</text>
  <text class="t-sm" x="558" y="242">but a connection to</text>
  <text class="t-sm" x="558" y="258">127.0.0.1 is not</text>
  <text class="t-xs" x="558" y="186"></text>

  <!-- container -->
  <rect class="box-v" x="820" y="140" width="250" height="124" rx="10"/>
  <text class="t-violet" x="838" y="166" font-size="14.5">container veth pair</text>
  <text class="t-sm" x="838" y="190">docker0 / br-xxxx</text>
  <text class="t-sm" x="838" y="210">to 172.17.0.2:80</text>
  <text class="t-xs" x="838" y="234">Kubernetes CNI plugins</text>
  <text class="t-xs" x="838" y="250">(Calico, Cilium) manage</text>
  <text class="t-xs" x="838" y="264">this same chain</text>
  <path class="ln-b" d="M494,202 L816,202" marker-end="url(#lm-arrow-bad)"/>

  <!-- fixes -->
  <rect class="box" x="30" y="300" width="1040" height="204" rx="10"/>
  <text class="t-title" x="48" y="326" font-size="14.5">what to do instead</text>
  <text class="t-sm" x="48" y="352">1. Put the rule in <tspan class="t-mono">DOCKER-USER</tspan>. It is jumped to first, before Docker's ACCEPTs:</text>
  <text class="t-mono" x="64" y="374">iptables -I DOCKER-USER -p tcp --dport 8080 ! -s 100.64.0.0/10 -j DROP</text>
  <text class="t-sm" x="48" y="402">2. Do not publish on 0.0.0.0. <tspan class="t-mono">-p 127.0.0.1:8080:80</tspan> keeps it on loopback — there is no forward-path bypass because there is no forward.</text>
  <text class="t-sm" x="48" y="428">3. Verify from outside, not from inside. Testing <tspan class="t-mono">curl localhost:8080</tspan> on the host proves nothing; test from a different network.</text>
  <text class="t-sm" x="48" y="454">4. Make it survive a Docker restart: rules in the INPUT chain survive a reload, DOCKER-USER rules do not unless Docker re-applies them or you do.</text>
  <text class="t-sm" x="48" y="480">5. For Kubernetes, the equivalent choke point is the CNI's own policy (CiliumNetworkPolicy, Calico GlobalNetworkPolicy) — netfilter on the node is the wrong layer to express app policy.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Firewall inspection and the rules that are actually worth having",
        code:
`# which backend am I really talking to — check this before every debugging session
iptables -V                      # 1.6.1 on 18.04: "legacy". 1.8+: prints nft.
update-alternatives --query iptables
ls -l /etc/alternatives/iptables

# ufw's view, and what is actually loaded in the kernel
ufw status verbose
ufw status numbered
sudo iptables -S | head -60
sudo iptables -t nat -S | head -40        # the DNAT rules Docker created
sudo iptables -L DOCKER-USER -n -v --line-numbers

# the listeners, which is the real inventory of your surface
sudo ss -tulpn
#   22/tcp on the tailnet address   sshd       — not public
#   53/tcp 53/udp                   named      — authoritative for alexandrugris.ro
#   80/tcp 443/tcp                  nginx      — the intended public surface
#   127.0.0.53:53                   resolved   — the stub resolver

# baseline for a public web box: default-deny in, allow out, open exactly 2 ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp comment 'nginx http'
sudo ufw allow 443/tcp comment 'nginx https'
sudo ufw allow in on tailscale0 comment 'ssh over tailnet only'
sudo ufw enable
sudo ufw status verbose

# egress control without breaking the box: deny only what a web server must never talk to
sudo ufw insert 1 out to 169.254.169.254 comment 'block cloud metadata'
sudo ufw insert 2 out to 10.0.0.0/8 comment 'block RFC1918'
sudo ufw insert 3 out to 172.16.0.0/12
sudo ufw insert 4 out to 192.168.0.0/16
sudo ufw insert 5 out to 127.0.0.0/8 comment 'except the stub resolver'

# conntrack: full means new connections are silently dropped, not refused
conntrack -L 2>/dev/null | wc -l
sysctl net.netfilter.nf_conntrack_max net.netfilter.nf_conntrack_count
sudo conntrack -D -p tcp --dport 8080        # delete entries for one port`

      },
      {
        type: "prose",
        h: "sysctl: the short list, and how to tell hardening from cargo cult",
        p: [
          "Most of the sysctl values in hardening guides are already correct on Ubuntu, because the kernel and the distribution set sane defaults. Copy-pasting a 2015 blog post into <code>/etc/sysctl.conf</code> can therefore achieve nothing except making your diff unreadable and your next upgrade harder to reason about. The discipline that works: <code>sysctl net.ipv4.conf.all.rp_filter</code> to read the current value, <code>grep -r rp_filter /usr/lib/sysctl.d/ /etc/sysctl.d/</code> to find who set it, and only then write a value that differs.",
          "The genuine set is short. <code>net.ipv4.conf.*.accept_redirects=0</code> and <code>send_redirects=0</code> matter on a machine that is a router or a VPN endpoint (an ICMP redirect is a hint that lets an on-path attacker steer your traffic). <code>net.ipv4.conf.*.accept_source_route=0</code> closes a genuine spoofing vector and is already 0 by default. <code>net.ipv4.tcp_syncookies=1</code> is the SYN-cookie fallback for half-open queue exhaustion; Ubuntu ships 1 and you should keep it. <code>kernel.randomize_va_space=2</code> is the strongest ASLR setting and is already 2. <code>kernel.kptr_restrict=1</code> and <code>kernel.dmesg_restrict=1</code> stop an unprivileged user from reading kernel pointers and the ring buffer — cheap, and useful precisely because an exploit chain wants <code>/proc/kallsyms</code> and a leaked address.",
          "The one that bites here is <code>rp_filter</code>. Strict mode (<code>1</code>, the usual default) silently drops packets whose source address does not match the route out of the receiving interface. On a host that is multi-homed — and a Tailscale node is, because WireGuard, the public NIC and the provider's gateway are three different paths — legitimate asymmetric traffic can be dropped, which presents as “intermittently unreachable” rather than as a firewall error. Loose mode (<code>2</code>) keeps the anti-spoofing property and drops the route check; setting it per-interface (<code>net.ipv4.conf.tailscale0.rp_filter=2</code>) is more surgical than setting it globally.",
          "Two things to leave alone. <code>fs.protected_hardlinks</code>, <code>fs.protected_symlinks</code>, <code>fs.protected_fifos</code> and <code>fs.protected_regular</code> are all already at their protective upstream defaults — <code>1</code>, <code>1</code>, <code>2</code>, <code>2</code> — so adding them to your config is documentation, not hardening. And do not blanket-block ICMP: you will break path MTU discovery and then spend an afternoon on “it works for small responses”. Rate-limit it (<code>net.ipv4.icmp_ratelimit=100</code>, <code>icmp_msgs_per_sec=1000</code>) rather than dropping it."
        ]
      },
      {
        type: "kv",
        h: "The sysctls that matter on this host, with real Ubuntu 18.04 defaults",
        items: [
          { k: "net.ipv4.conf.all.accept_redirects", v: "<strong>0</strong> on Ubuntu. Leave it. Set it to 0 on the interface you forward traffic from too — <code>all</code> does not cover interfaces created later." },
          { k: "net.ipv4.conf.all.send_redirects", v: "<strong>1</strong> on Ubuntu — this is the one that differs from the hardening articles. Set to 0 unless this machine actually routes a network. Persist in <code>/etc/sysctl.d/99-hardening.conf</code>." },
          { k: "net.ipv4.conf.all.rp_filter", v: "Ubuntu ships <strong>1</strong> (strict). On a multi-homed host with Tailscale, set the tailnet interface to <strong>2</strong> (loose) or you will drop legitimate asymmetric replies. Diagnose with <code>grep rp_filter /usr/lib/sysctl.d/50-default.conf</code> before changing it." },
          { k: "net.ipv4.ip_forward", v: "<strong>0</strong> on a plain Ubuntu install. Do not enable it “just in case”: with it on you have turned the box into a router, and every forwarding decision now depends on your firewall being correct. Docker sets it to 1 at daemon start." },
          { k: "net.ipv4.tcp_syncookies", v: "<strong>1</strong>, keep it. Costs nothing when the synqueue is not full, prevents half-open-connection exhaustion when it is." },
          { k: "kernel.randomize_va_space", v: "<strong>2</strong> (full ASLR). Correct already; do not lower it to make an old binary work." },
          { k: "kernel.kptr_restrict", v: "<strong>1</strong> on Ubuntu — <code>/proc/kallsyms</code> shows zeros to non-root. Set 2 to hide symbol addresses entirely." },
          { k: "kernel.dmesg_restrict", v: "<strong>1</strong> on Ubuntu. This is why <code>dmesg</code> as a normal user prints <code>Operation not permitted</code>, and it is also why kernel panics and OOM kills are invisible in the syslog without privileges. Keep 1; use <code>journalctl -k</code> as root." },
          { k: "kernel.perf_event_paranoid", v: "Default 2 or 4 depending on version. Raising it blocks unprivileged <code>perf</code>, which is a real information-leak surface (timing side channels, kernel address disclosure via cache timing)." },
          { k: "fs.protected_hardlinks / symlinks / fifos / regular", v: "<strong>Already 1 / 1 / 2 / 2</strong> from the kernel. Writing them into your hardening file documents upstream behaviour; it changes nothing. This is the single most common cargo-cult entry." },
          { k: "fs.suid_dumpable", v: "<strong>0</strong>: a core dump does not contain the setuid binary's memory image, which matters for setuid/setgid escalation. Ubuntu ships 0; leaving it 1 for “debuggable core dumps” is a small, real risk." },
          { k: "net.ipv4.conf.all.accept_source_route", v: "<strong>0</strong> already. Only interesting if you actually need source-routed traffic, which you do not." },
          { k: "net.ipv4.icmp_ratelimit", v: "Not a firewall: it limits how much ICMP a host <em>generates</em> (default 1000 msg/s, burst 50). Add <code>icmp_msgs_per_sec</code> to 1000 to slow a ping flood's reflection. Do not DROP ICMP wholesale — you will break PMTUD." },
          { k: "net.netfilter.nf_conntrack_max", v: "Not security, but it presents as one. A full conntrack table drops <em>new</em> connections silently (they hang, they are not refused). Default 65536; check <code>nf_conntrack_count</code> before raising it." }
        ]
      },
      {
        type: "prose",
        h: "AppArmor and SELinux: mandatory access control, and why permissive mode is not a strategy",
        p: [
          "Both are Linux Security Modules: hooks inside the kernel's permission path where a policy is consulted before a decision is finalised, which means a policy can deny a root process too. Ubuntu ships <strong>AppArmor</strong>, RHEL and Fedora ship <strong>SELinux</strong>; they are not interchangeable, and installing one does not remove the other.",
          "The honest limitation of AppArmor on Ubuntu is worth stating plainly, because the marketing implies otherwise. Ubuntu ships roughly 30 packaged profiles — nginx, named, mysqld, postgres, docker, sshd, snap, and a handful of others — and puts everything else in <code>unconfined</code>, which is equivalent to having no MAC at all. On this box that means the nginx worker is confined and your shell, your rsync job and any cron unit are not. The additional restriction mechanism in later releases (<code>unconfined</code> restrictions on user namespaces, added in 24.04) does not apply to 18.04.",
          "The mechanism is simpler than SELinux's and much easier to adopt: a profile is a file of path and capability rules attached to a <em>binary path</em>. <code>aa-status</code> shows what is loaded and in which mode; <code>/etc/apparmor.d/</code> holds the profiles and <code>abstractions/</code> holds reusable fragments that other profiles include. The enforcement loop is: on every <code>open</code>, <code>link</code>, <code>exec</code>, <code>mount</code>, capability use and signal, the profile for the current executable is consulted, and a denial is both enforced and logged as <code>apparmor=&quot;DENIED&quot;</code> in the audit log.",
          "Permissive mode deserves a precise defence. <code>aa-complain</code> (or <code>setenforce 0</code>) converts denials into log entries and allows the action. As a <em>migration technique</em> it is the correct and recommended path: enforce nothing, run under real load, read the denials, add the specific rules the program genuinely needs, then re-enforce. As a <em>permanent state</em> it is pure theatre — you have converted a control into a log line, kept the performance cost, and gained nothing an attacker can notice. The discipline is that permissive is a phase with an exit, and if you cannot describe the exit, you have not hardened anything; you have only annotated."
        ]
      },
      {
        type: "diagram",
        h: "Where a denial is decided, and where it shows up",
        caption: "The decision point is inside the kernel's permission path, after DAC (ownership and mode bits) and before the operation runs. Two consequences that matter in practice: a policy can deny a process running as <b>root</b> (unlike file modes), and the denial is a structured audit record, not a string in an application's log — so you can correlate it across services.",
        svg: `
<svg viewBox="0 0 1100 460" role="img" aria-label="Access decision path showing DAC check, LSM AppArmor or SELinux hook, allow or deny, and audit record">
  <rect class="box-a" x="30" y="30" width="180" height="110" rx="10"/>
  <text class="t-accent" x="46" y="56" font-size="15">a process acts</text>
  <text class="t-sm" x="46" y="80">open(\"/etc/shadow\")</text>
  <text class="t-sm" x="46" y="98">execve(\"/tmp/x\")</text>
  <text class="t-sm" x="46" y="116">socket(AF_INET)</text>
  <text class="t-xs" x="46" y="134">uid, capabilities</text>

  <path class="ln-a" d="M214,85 L262,85" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-w" x="266" y="30" width="220" height="110" rx="10"/>
  <text class="t-warn" x="284" y="56" font-size="15">DAC check</text>
  <text class="t-sm" x="284" y="80">mode bits, ownership,</text>
  <text class="t-sm" x="284" y="98">ACLs, mount flags</text>
  <text class="t-xs" x="284" y="120">this is where EACCES</text>
  <text class="t-xs" x="284" y="136">normally comes from</text>

  <path class="ln-a" d="M490,85 L538,85" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-p" x="542" y="30" width="230" height="110" rx="10"/>
  <text class="t-bad" x="560" y="56" font-size="15">LSM hook</text>
  <text class="t-sm" x="560" y="80">AppArmor: profile of</text>
  <text class="t-sm" x="560" y="98">the running binary</text>
  <text class="t-sm" x="560" y="116">SELinux: label + policy</text>
  <text class="t-xs" x="560" y="136">applies to root too</text>

  <path class="ln-ok" d="M776,62 L856,62" marker-end="url(#lm-arrow-ok)"/>
  <path class="ln-b" d="M776,112 L856,112" marker-end="url(#lm-arrow-bad)"/>

  <rect class="box-ok" x="860" y="26" width="210" height="72" rx="10"/>
  <text class="t-ok" x="878" y="50" font-size="14.5">allow</text>
  <text class="t-xs" x="878" y="70">in enforce mode the</text>
  <text class="t-xs" x="878" y="86">check is cached per rule</text>

  <rect class="box-b" x="860" y="112" width="210" height="90" rx="10"/>
  <text class="t-bad" x="878" y="136" font-size="14.5">deny</text>
  <text class="t-xs" x="878" y="156">enforce: EACCES, nothing</text>
  <text class="t-xs" x="878" y="172">happens</text>
  <text class="t-xs" x="878" y="192">complain: allowed, logged</text>

  <rect class="box" x="30" y="224" width="1040" height="220" rx="10"/>
  <text class="t-title" x="48" y="250" font-size="14.5">the two dialects, and the honest comparison</text>

  <text class="t-accent" x="48" y="282" font-size="14.5">AppArmor (Ubuntu, this box)</text>
  <text class="t-sm" x="48" y="306">path and capability rules, one file per binary, in /etc/apparmor.d/, plus abstractions/</text>
  <text class="t-sm" x="48" y="328">/etc/nginx/nginx-init: complain  →  aa-enforce /usr/sbin/nginx</text>
  <text class="t-sm" x="48" y="350">aa-status   |   journalctl -k -g apparmor   |   dmesg | grep DENIED</text>
  <text class="t-xs" x="48" y="374">everything without a profile runs unconfined — which on Ubuntu 18.04 is most of your own tooling</text>

  <line class="ln" x1="548" y1="262" x2="548" y2="424"/>

  <text class="t-violet" x="576" y="282" font-size="14.5">SELinux (RHEL, Fedora)</text>
  <text class="t-sm" x="576" y="306">label-based: every object has a type, every process a domain, and the policy is a type-transition matrix</text>
  <text class="t-sm" x="576" y="328">ls -Z /var/www/html/index.html    getenforce    semanage fcontext -a -t httpd_sys_content_t '/www(/.*)?'</text>
  <text class="t-sm" x="576" y="350">restorecon -Rv /var/www/html      ausearch -m AVC -ts recent   |   audit2why</text>
  <text class="t-xs" x="576" y="374">far stronger coverage and finer granularity; a steeper first-week cost, and labelling is stateful (relabelling by a tool wipes it)</text>

  <text class="t-warn" x="48" y="410" font-size="14">The failure mode worth naming: SELinux denials produce no error in the application's own log. A file that is 644, owned by you, in a directory you own, is still unreadable — and the only evidence is an AVC record you have to go and look for.</text>
  <text class="t-xs" x="48" y="432">That single fact explains most of the “just turn it off” advice you will read, and most of the incidents that advice causes.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "AppArmor on this box, and a minimal profile written from scratch",
        code:
`sudo apt install apparmor-utils       # aa-status, aa-complain, aa-enforce, aa-genprof
aa-status | head -30
# count the loaded profiles — the number that matters is how many of YOUR
# binaries have one, not how many are loaded

# is a given service confined, and in which mode?
aa-status | grep -E 'nginx|named|sshd'
sudo cat /sys/kernel/security/apparmor/profiles | tr ',' '\n' | grep nginx
sudo grep -E '^flags=' /sys/module/apparmor/parameters/enabled   # Y = present

# read the shipped nginx profile before you touch it
sudo less /etc/apparmor.d/usr.sbin.nginx
sudo grep -n 'include' /etc/apparmor.d/usr.sbin.nginx | head -20
# it is mostly: /usr/share/apparmor-features/... plus abstractions/{base,resolv,etc,names-service}

# --- a minimal profile you can write by hand, enforced from the first boot ---
# /etc/apparmor.d/local.publisher
#
#   #include <tunables/global>
#
#   profile publisher /usr/local/bin/publish.sh {
#     #include <abstractions/base>
#
#     /usr/local/bin/publish.sh            r,
#     /etc/gitconfig                       r,
#     /var/lib/publisher/            rw,
#     /var/lib/publisher/**          rw,
#     /tmp/publisher-scratch/**     rw,
#     /var/www/html/**               r,
#
#     capability setgid,
#     capability setuid,
#     deny /root/**                 rwklx,
#     deny /home/*/.ssh/**          rwklx,
#     deny /etc/shadow              r,
#     deny /proc/sys/kernel/**      w,
#
#     /usr/bin/git                  rix,
#     /usr/bin/rsync                rix,
#   }

sudo apparmor_parser -r /etc/apparmor.d/local.publisher   # syntax check + load
sudo aa-status | grep publisher

# the migration loop, done properly
sudo aa-complain /usr/local/bin/publish.sh     # 1. run under real load
sudo journalctl -k --since "-1h" | grep 'apparmor="DENIED"'   # 2. read what it wanted
sudo aa-logprof                                      # 3. interactive: add rules, write out
sudo aa-enforce /usr/local/bin/publish.sh       # 4. and only now leave complain mode`
      },
      {
        type: "prose",
        h: "Updates: end-of-life is the security problem that beats all the others",
        p: [
          "The single most important fact about patch management is that <strong>a patched system on a supported release and an unpatched system on a dead release are not comparable</strong>. There is no configuration that compensates. Ubuntu 18.04's standard maintenance ended in May 2023; without Ubuntu Pro it has received no security updates since, and every package on it is a known-vulnerable version that the internet has had years to study. With Ubuntu Pro/ESM attached — as on this machine — the security maintenance window runs to <strong>May 2028</strong>, which changes the calculus completely. ESM packages are real patched packages from Canonical's archive, not a deferral notice.",
          "Check that assumption rather than trusting it, because the failure mode is silent: <code>pro status</code> shows attachment and entitlements, and <code>apt-cache policy</code> shows whether the ESM pocket is actually pinned. An unattended-upgrades configuration pointing at ESM origins on a machine without the entitlement resolves to nothing, updates “succeed”, and the machine quietly ages out of support.",
          "<code>unattended-upgrades</code> does three things well: it installs security updates from configured origins, it does so without prompting, and it can send mail. It has four limitations that matter more than the feature list. It does not <em>reboot</em> to run a new kernel — it writes the package and sets <code>/var/run/reboot-required</code>, and the old kernel keeps executing until a human reboots, unless you enable <code>Unattended-Upgrade::Automatic-Reboot</code> and accept its maintenance-window semantics. It does not upgrade to a new point release series (4.15.0-213 → a 5.x kernel is a different track entirely). It ignores packages that are <code>hold</code>-marked, so a pinned package is a permanently unpatched package. And, critically, it <strong>does not restart running services</strong> — the patched library is on disk, the old code is still in the process's address space, and a service that is never restarted stays vulnerable indefinitely. That is what <code>needrestart</code> is for.",
          "Kernel livepatching changes the reboot ritual but not the rules. Canonical's Livepatch (included with Ubuntu Pro) applies a patch to the running kernel's memory without rebooting, which removes the outage from the maintenance path. Its constraints are structural: kernel only — never userland packages, never a new kernel version, never a new module; no changes that require a different boot parameter, a filesystem-format change, or a driver swap; and a reboot is still required to pick up the normal kernel package. It is a genuine availability win for a host where SSH is Tailscale-only and an unplanned reboot is genuinely risky. It is not a substitute for the normal update cycle."
        ]
      },
      {
        type: "diagram",
        h: "What unattended-upgrades does, and the three points where it stops",
        caption: "The gap between “package installed” and “vulnerable code running” is the part people get wrong. A patched binary sitting on disk while the old one keeps serving traffic is the state that lasts for months on a box nobody reboots — and here, 4.15.0-260 is installed but not booted, which is exactly that state, with the reboot already flagged.",
        svg: `
<svg viewBox="0 0 1100 480" role="img" aria-label="Update lifecycle from package availability through unattended-upgrades to install, service restart gap and reboot requirement">
  <rect class="box" x="30" y="30" width="1010" height="86" rx="10"/>
  <text class="t-title" x="48" y="56" font-size="14.5">upstream / Canonical security pocket</text>
  <text class="t-sm" x="48" y="80">focal-security for the standard archive, plus focal-infra-security and focal-applications-security from Ubuntu Pro / ESM</text>
  <text class="t-xs" x="48" y="102">if the ESM entitlement is missing, those two origins resolve to nothing and the machine silently stops receiving patches — check pro status, not just apt update</text>

  <path class="ln-a" d="M535,118 L535,142" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-a" x="30" y="146" width="1010" height="70" rx="10"/>
  <text class="t-accent" x="48" y="172" font-size="14.5">apt pulls it into /var/cache/apt/archives, unattended-upgrades unpacks it</text>
  <text class="t-sm" x="48" y="196">configured in /etc/apt/apt.conf.d/50unattended-upgrades — origin patterns decide what is eligible, and APT::Periodic::Unattended-Upgrade must be 1 in 20auto-upgrades</text>

  <path class="ln-a" d="M535,218 L535,242" marker-end="url(#lm-arrow-accent)"/>

  <!-- the gap -->
  <rect class="box-w" x="30" y="246" width="330" height="140" rx="10"/>
  <text class="t-warn" x="48" y="272" font-size="14.5">the file on disk is now patched</text>
  <text class="t-sm" x="48" y="298">the running process still has</text>
  <text class="t-sm" x="48" y="316">the old code mapped, and</text>
  <text class="t-sm" x="48" y="334">nothing restarts it</text>
  <text class="t-xs" x="48" y="360">unattended-upgrades does not</text>
  <text class="t-xs" x="48" y="376">restart services by default;</text>
  <text class="t-xs" x="48" y="392">needrestart or a restart hook does</text>

  <path class="ln-w" d="M364,316 L406,316" marker-end="url(#lm-arrow-warn)"/>

  <!-- kernel gap -->
  <rect class="box-b" x="410" y="246" width="300" height="140" rx="10"/>
  <text class="t-bad" x="428" y="272" font-size="14.5">for a kernel, “restart” is a reboot</text>
  <text class="t-sm" x="428" y="298">/var/run/reboot-required</text>
  <text class="t-sm" x="428" y="316">/var/run/reboot-required.pkgs</text>
  <text class="t-xs" x="428" y="342">this box: 4.15.0-260 is</text>
  <text class="t-xs" x="428" y="358">installed, 4.15.0-213 is</text>
  <text class="t-xs" x="428" y="374">running. Unpatched kernel</text>
  <text class="t-xs" x="428" y="390">code is executing right now.</text>

  <path class="ln-v" d="M714,290 L760,290" marker-end="url(#lm-arrow-accent)"/>

  <rect class="box-v" x="714" y="246" width="150" height="140" rx="10"/>
  <text class="t-violet" x="730" y="272" font-size="14">or: livepatch</text>
  <text class="t-xs" x="730" y="296">kernel code only,</text>
  <text class="t-xs" x="730" y="312">in memory, no reboot</text>
  <text class="t-xs" x="730" y="336">never: userland,</text>
  <text class="t-xs" x="730" y="352">new kernel version,</text>
  <text class="t-xs" x="730" y="368">new modules, boot</text>
  <text class="t-xs" x="730" y="384">parameter changes</text>

  <path class="ln-ok" d="M866,316 L906,316" marker-end="url(#lm-arrow-ok)"/>

  <rect class="box-ok" x="866" y="246" width="204" height="140" rx="10"/>
  <text class="t-ok" x="884" y="272" font-size="14.5">running the fix</text>
  <text class="t-sm" x="884" y="298">uname -r shows the</text>
  <text class="t-sm" x="884" y="316">new kernel</text>
  <text class="t-xs" x="884" y="342">reboot-required file is</text>
  <text class="t-xs" x="884" y="358">gone, everything came</text>
  <text class="t-xs" x="884" y="374">back, verify the public</text>
  <text class="t-xs" x="884" y="390">surface with ss -tulpn</text>

  <rect class="box" x="30" y="404" width="1040" height="62" rx="10"/>
  <text class="t-warn" x="48" y="428" font-size="14">the reboot is the risk, not the update</text>
  <text class="t-xs" x="48" y="452">SSH here is reachable over Tailscale only, which means “I will not be locked out by the update” is false — if Tailscale does not come back after the reboot, there is no public sshd to fall back on. Always confirm the console path and the tailscaled unit before rebooting.</text>
</svg>`
      },
      {
        type: "code",
        lang: "bash",
        what: "Patch management, done so you can answer “is this machine current?” in one command",
        code:
`# what is the patch state of the release itself
pro status                                   # entitlement + which services are attached
cat /etc/apt/sources.list | grep -i esm     # the esm-infra / esm-apps origins
apt-cache policy | grep -A2 -i esm          # pin-priority 510 on the ESM pockets

# what is pending, security only
apt-get -s upgrade | grep '^Inst' | wc -l
apt list --upgradable 2>/dev/null | wc -l
apt-get -s dist-upgrade | grep -E '^Inst.*security' | wc -l

# is a reboot already owed
[ -f /var/run/reboot-required ] && cat /var/run/reboot-required.pkgs
uname -r; ls /lib/modules/          # installed kernels vs the running one
# -> 4.15.0-213 running, 4.15.0-260 installed: the fix is on disk, not in memory

# unattended-upgrades: is it enabled, what does it cover, did it work
systemctl status unattended-upgrades
grep -E '^(APT::Periodic::Unattended-Upgrade|Unattended-Upgrade::Automatic-Reboot)' \
     /etc/apt/apt.conf.d/20auto-upgrades
grep -E '^\s*".*origin=|^\s*"\$\{distro_id\}' /etc/apt/apt.conf.d/50unattended-upgrades
tail -40 /var/log/unattended-upgrades/unattended-upgrades.log
ls -l /var/lib/unattended-upgrades/

# the things that silently stop updates
apt-mark showhold                    # a held package never gets security updates
apt-mark showmanual                  # manually-installed: not auto-removed, not auto-upgraded
dpkg --audit                         # half-configured packages block all future upgrades
# a failed dpkg run is why "apt says 0 to upgrade" while the tree is broken

# what unattended-upgrades will NOT do for you
#   x reboot onto the new kernel                     -> you do it
#   x restart the service whose library was patched  -> needrestart, or a restart hook
#   x move to a new point release                     -> release-upgrade
#   x update packages you installed manually         -> they are candidates, but held/manual ones may sit`
      },
      {
        type: "prose",
        h: "Secrets, logging, backups: the three controls that are not about packets",
        p: [
          "Everything above is about what can reach the machine. The remaining controls are about what the machine already holds — and on a personal server these are where the actual mistakes happen, because they involve <em>your</em> habits rather than an attacker's.",
          "<strong>Secrets.</strong> The concrete risk on this box is the publish path: static sites served from <code>/var/www/html</code>, updated by <code>rsync -avz --delete</code> from git repositories on a MacBook. If those repositories contain a <code>.env</code>, an API token, an SSH key, or a <code>.git</code> directory — and a working tree almost always contains <code>.git</code> — then <code>rsync</code> faithfully publishes all of it, because <code>--delete</code> means the server mirrors whatever the client sends. A <code>.git</code> directory in the docroot is the complete source history of the site, including anything ever committed and later removed. Defence in depth at the nginx layer (<code>location ~ /\\. { deny all; }</code> plus <code>autoindex off</code>) is worth having, but the fix is an exclude list on the publish command: <code>--exclude='.git' --exclude='.env*'</code>, and a rule in the client that they are never sent.",
          "<strong>Logging.</strong> This machine has journald capped at <code>SystemMaxUse=300M</code> with <code>SystemKeepFree=1G</code>, which is a deliberate and sensible pairing on a 19&nbsp;GB disk: the size cap bounds usage, and the keepfree cap makes the vacuuming aggressive under pressure, so the journal never becomes the reason a disk fills. The corresponding audit trail — <code>/var/log/auth.log</code> via rsyslog — duplicates the same authentication events, so there are two copies to rotate and two to keep off the box. What matters for detection is not volume but <em>shape</em>: you cannot investigate “is this normal?” without knowing what normal looks like, and on this host normal is exactly two nginx master/worker pairs per configuration, one named running as bind, sshd with no session except yours, and four listeners.",
          "<strong>Backups.</strong> Three copies, two media, one off-host — and the part everyone omits is that <strong>a backup is not a backup until it has been restored</strong>. An untested archive is a belief. Off-host matters more than off-media: if the backup shares a fate with the box, it protects you against nothing except the file you deleted. For this machine the useful inventory is specific and short: the BIND zone data in <code>/etc/bind</code> and <code>/var/lib/bind</code>, the site definitions and TLS keys in <code>/etc/nginx</code>, <code>/etc/ssh/sshd_config</code> and <code>/etc/ssh/sshd_config.d/</code>, every <code>authorized_keys</code>, the ufw ruleset in <code>/etc/ufw</code>, and any systemd drop-ins you wrote. The docroot itself is derived from git and needs no backup — which is fortunate, because it currently contains 16 unpruned copies totalling about 374&nbsp;MB on a 19&nbsp;GB disk."
        ],
        noteTitle: "The two findings on this box worth acting on today",
        note: "(1) <code>/var/www/html</code> holding 16 unpruned backups is not a backup strategy, it is a disk-fill mechanism — with journald capped at 300M and ESM packages arriving, space is the resource that runs out first. (2) If those backups were created by <code>rsync --delete</code> from a working tree, then whichever directory happens to be current may well contain <code>.git</code>. Check with <code>ls -la /var/www/html/ | head</code> and <code>curl -sI https://your-site/.git/config</code> — that last one is a two-second test that answers it definitively.",
        noteKind: "warn"
      },
      {
        type: "code",
        lang: "bash",
        what: "Secrets hygiene, log triage, and a backup you have actually restored",
        code:
`# --- secrets: find what is published that should not be ---
sudo find /var/www/html -maxdepth 3 \\( -name '.env*' -o -name '*.pem' -o -name 'id_*' -o -name '.git' \\) -print
curl -sI https://example.ro/.git/config | head -1        # 200 means your history is public
curl -s  https://example.ro/.git/config | head -3
# the durable fix is on the publish side, not the server side:
#   rsync -avz --delete --exclude='.git' --exclude='.env*' --exclude='*.pem' ./ site:/var/www/html/
# and on the server, as a second layer:
#   location ~ /\\. { deny all; }

# --- secrets on the server: who can read them, and are they inside the docroot
sudo find /etc/nginx /etc/bind /etc/ssh /etc/ufw -type f -perm /004 -printf '%m %u %p\\n' | head
sudo stat -c '%a %U:%G %n' /etc/nginx/sites-enabled/* /etc/bind/*.key 2>/dev/null

# --- logging: shape, not volume ---
journalctl --disk-usage
grep -E '^(SystemMaxUse|SystemKeepFree|MaxRetentionSec|ForwardToSyslog)' /etc/systemd/journald.conf
ls -l /var/log/auth.log /var/log/syslog 2>/dev/null
# this box: 300M cap + 1G keepfree — sane on 19G; confirm the vacuum is keeping up

# --- detection: what an anomaly actually looks like on this host ---
sudo ss -ltnp                       # baseline: 22 (tailnet), 53, 80, 443, 127.0.0.53
sudo ss -tnp state established      # every live session, with the process name
sudo journalctl -u ssh -b --no-pager | grep -E 'Accepted|Failed|Invalid'
sudo grep -E 'Accepted|Failed password|Invalid user' /var/log/auth.log | tail -20
sudo last -x | head -20             # logins, reboots, runlevel changes
sudo lastb | head                   # failed logins (needs root)
sudo journalctl -k -b -p err --no-pager | tail -30
# a fail2ban jail for SSH on a Tailscale-only host bans your own laptop.
# the same jail against a public nginx + mod_security is worth having.

# audit rules worth having: watch the files whose change means persistence
sudo systemctl enable --now auditd
sudo tee /etc/audit/rules.d/50-critical.conf >/dev/null <<'EOF'
-w /etc/passwd      -p wa -k identity
-w /etc/group       -p wa -k identity
-w /etc/shadow      -p wa -k identity
-w /etc/sudoers     -p wa -k privilege
-w /etc/ssh/sshd_config     -p wa -k sshd
-w /etc/ssh/sshd_config.d/  -p wa -k sshd
-w /etc/ufw/        -p wa -k firewall
-w /etc/nginx/      -p wa -k nginx
-w /home            -p wa -k sshkeys
-e 1                # immutable: rules cannot be deleted at runtime (0 would allow it)
EOF
sudo augenrules --load && sudo auditctl -l
# -e 1 needs a reboot to change; -e 2 reboots the machine if rules fail to load.
# Do not audit every execve on a 2 GB box — the audit backlog will bury you.

# --- backups: inventory, then prove a restore ---
sudo systemctl list-timers | grep -iE 'backup|restic|borg'
sudo du -x --max-depth=1 / | sort -h | tail -12      # where the 19 GB went
sudo du -sh /var/www/html/* | sort -h | tail -16      # the 16 unpruned backups

# a restore test that is a test: take one file back from the off-host copy
borg list                                        # or: restic snapshots
borg extract ::archive /etc/bind/db.alexandrugris.ro --destination=/tmp/restore-test
diff /etc/bind/db.alexandrugris.ro /tmp/restore-test/etc/bind/db.alexandrugris.ro && echo RESTORE_OK`
      },
      {
        type: "steps",
        h: "The 20-minute hardening pass, in the order that is safe",
        items: [
          { t: "0. Inventory before you change anything (2 min)", d: "<code>ss -tulpn</code>, <code>systemctl list-units --state=running</code>, <code>pro status</code>, <code>df -h</code>, <code>ls -l /var/run/reboot-required</code>. Write the listener list down. It is the only thing you will be able to verify at the end, and every change below is measured against it." },
          { t: "1. Is the release supported? (30 s)", d: "<code>pro status</code>. If it says nothing is attached on an EOL release, every other item on this list is marginal — the release is the control. On this box ESM is attached through May 2028, which makes the rest of this checklist worth doing." },
          { t: "2. Close the public surface (3 min)", d: "<code>ufw default deny incoming</code>, allow only 80 and 443, allow 22 <em>on tailscale0</em> only. Confirm SSH really is not listening on a public address: <code>ss -ltnp 'sport = :22'</code> must show the tailnet address, not 0.0.0.0." },
          { t: "3. Fix the pending reboot (2 min)", d: "4.15.0-260 is installed and 4.15.0-213 is running. Before rebooting: confirm the provider's serial console works, confirm <code>systemctl is-enabled tailscaled</code>, confirm nothing in <code>/etc/fstab</code> is experimental. Then reboot and verify <code>uname -r</code> and <code>ss -tulpn</code>." },
          { t: "4. Read the effective sshd config (3 min)", d: "<code>sshd -T | grep -E 'passwordauthentication|permitrootlogin|allowtcpforwarding|maxauthtries|allowusers|gatewayports'</code>. Add <code>AllowUsers</code> and <code>MaxAuthTries 3</code>. <code>sshd -t</code>, <code>systemctl reload ssh</code>, then <em>test the new key from a second terminal</em> before you trust it." },
          { t: "5. Audit the keys (3 min)", d: "Print every <code>authorized_keys</code> with its mode and owner. Remove the ED25519 key that is present in two accounts from whichever one does not need it, or accept the rotation cost explicitly. Add <code>restrict</code> and <code>from=</code> to any key that only pushes files." },
          { t: "6. Confirm automated updates work (2 min)", d: "<code>systemctl status unattended-upgrades</code>, read <code>50unattended-upgrades</code> origins for focal-security and the ESM pockets, check <code>apt-mark showhold</code> for pinned packages, and look at last night's log. An automation you have never seen succeed is not automation." },
          { t: "7. Decide on a service restart policy (1 min)", d: "unattended-upgrades will not restart services. Either install and configure <code>needrestart</code>, or accept that a library patch only takes effect at your next restart — and write that restart into your calendar rather than into a hope." },
          { t: "8. Check AppArmor (2 min)", d: "<code>aa-status</code>: nginx and named should be enforcing. One <code>aa-logprof</code> pass on the nginx profile while a real request is served teaches you the whole workflow in five minutes." },
          { t: "9. Check what is running as root (1 min)", d: "<code>ps -eo user,pid,comm | awk '$1==\"root\"'</code>. Anything unexplained that is a long-running daemon is a finding; anything with a web or network path to it is a finding with a deadline." },
          { t: "10. Run the setuid and capability audit (1 min)", d: "<code>find / -xdev -perm -4000</code> and <code>getcap -r / 2>/dev/null</code>. Be able to explain every line." },
          { t: "11. Audit your own units (3 min)", d: "<code>systemd-analyze security</code> on each custom unit, then add the free directives: <code>NoNewPrivileges</code>, <code>ProtectSystem=strict</code>, <code>ProtectHome</code>, <code>PrivateTmp</code>, <code>StateDirectory=</code>. Test each one by restarting the service and exercising it." },
          { t: "12. Check what the web server publishes (1 min)", d: "<code>find /var/www/html -name '.git' -o -name '.env*'</code> and a <code>curl</code> against <code>/.git/config</code>. Then fix it at the source: exclude in the rsync command, not just in nginx." },
          { t: "13. Reclaim disk and set a tripwire (2 min)", d: "Prune the 16 docroot backups; keep the newest N plus one known-good. <code>journalctl --vacuum-size=200M</code>. Then set a threshold alert at 80% — on 19 GB this is not premature." },
          { t: "14. Prove one restore (2 min)", d: "Restore one file from the off-host backup and diff it. An untested backup is an opinion, and this is the only item on the list that cannot be shortcut." }
        ]
      },
      {
        type: "callout",
        kind: "danger",
        title: "do not do these",
        text: "<strong>Do not disable the firewall because it caused an outage.</strong> Find the rule with <code>ufw status numbered</code>; the outage is always one rule and always specific. — <strong>Do not chmod 777 “temporarily”.</strong> It survives the incident, lands in git, and appears in the write-up. — <strong>Do not run sshd on 0.0.0.0 “because the firewall covers it”,</strong> especially if Docker manages forwarding on that host. — <strong>Do not install fail2ban on a Tailscale-only box</strong> and call it detection; the only thing it will ban is your own laptop. Point it at the public web service instead, or at nothing. — <strong>Do not set the OUTPUT policy to DROP</strong> without an egress plan, a console, and a maintenance window; it is the correct control and the most reliable way to lose a remote-only machine. — <strong>Do not paste a hardening sysctl list from a blog.</strong> Run <code>sysctl -a</code> first: most of it is already the Ubuntu default and you are only adding noise. — <strong>Do not disable MAC globally</strong> (<code>aa-teardown</code>, <code>setenforce 0</code> in <code>/etc/selinux/config</code>) as a fix for a denial; that removes your only control against a uid 0 process. Use complain mode, find the one rule, enforce again. — <strong>Do not add <code>CAP_SYS_ADMIN</code> to fix a permission problem.</strong> That is root with worse visibility; use a uid, a group, or one narrow capability. — <strong>Do not leave a service running as root</strong> because its config file is root-owned — the config is read once at startup. — <strong>Do not <code>rm</code> the log you need to read</strong> to make the disk full warning go away; rotate and cap instead. — <strong>Do not set <code>MaxAuthTries 2</code> with a laptop that prompts</strong> for a passphrase and several agent keys loaded: you will lock yourself out of your own machine, over Tailscale, with no other way in."
      },
      {
        type: "callout",
        kind: "boss",
        title: "the model to keep",
        text: "Security is not a pile of settings, it is a <em>cost function for the attacker</em>. Everything above works by making one of three things expensive: <strong>reaching the machine at all</strong> (Tailscale-only SSH, few listeners), <strong>getting past the front door</strong> (key-only auth, unprivileged daemons, MAC, unpatched bugs removed), and <strong>staying unnoticed and unrecovable</strong> (audit rules, off-host backups you have restored). Rank your own estate against those three, and spend your effort on the cheapest one that is currently weak. On a box like this one, the answer is almost never a cipher suite or an obscure sysctl: it is the reboot that loads the kernel you already patched, and the rsync exclude list that keeps <code>.git</code> out of the docroot."
      }
    ],
    takeaways: [
      "Rank by attacker, not by setting: mass scanning, credential replay and known-CVE exploitation kill nearly everything, and they all die at the first two layers. Targeted intrusion is rare and arrives through a credential, not a firewall.",
      "Layers apply <em>in order</em> — overlay, netfilter, admission, authentication, authorisation, MAC, patches. On this box SSH is on the tailnet, so ufw is not what protects sshd, and <code>ufw status</code> is therefore not a complete picture of who can reach it.",
      "<code>sshd -T</code> is the only authority on sshd's configuration; <code>sshd -t</code> checks syntax and file modes. <code>sshd_config.d/*.conf</code> is included <em>first</em>, which is how edits get silently overridden.",
      "<code>PermitRootLogin prohibit-password</code> still means an SSH key is root with every capability. <code>AllowTcpForwarding yes</code> plus <code>GatewayPorts yes</code> publishes a public service that no firewall rule mentions — that is how SSH-only boxes end up serving the internet.",
      "Least privilege is about blast radius: an unprivileged uid beats a file capability beats a setuid binary beats uid 0, and <code>CAP_SYS_ADMIN</code> is not a reduction — it is root with worse visibility.",
      "ufw is a rule generator, not a firewall, and it does not police forwarded traffic. A container's published port is DNAT'd and never touches <code>INPUT</code>, so <code>ufw default deny incoming</code> is irrelevant to it; <code>DOCKER-USER</code> is the only early chain.",
      "AppArmor on Ubuntu confines roughly thirty packaged daemons and leaves everything else unconfined. Complain mode is a migration phase with an exit; left permanently it is an expensive log file, not a control.",
      "A patched package on disk with an un-restarted service, or an installed kernel that has not been booted, is the normal state of an unattended host. Rebooting, restarting and verifying <code>uname -r</code> are part of patching, not an interruption to it."
    ],
    glossary: {
      "sshd -T": "Prints sshd's fully resolved configuration — every keyword and default after includes and Match blocks. The only trustworthy answer to “what is this daemon actually doing?”.",
      "authorized_keys options": "The prefix fields on a key line — restrict, from=, command=, permitopen=, no-port-forwarding — that turn a key into a small access-control policy.",
      "StrictModes": "sshd's check that ~/.ssh and authorized_keys are not group- or world-writable. Silent, logged only, and the reason a key can fail to work for no visible reason.",
      "GatewayPorts": "Whether an ssh -R remote forward binds the server's public interface or only loopback. The difference between a private tunnel and an accidental public service.",
      "capability": "A slice of root's authority the kernel can grant individually — CAP_NET_BIND_SERVICE (10) to bind a low port, CAP_SYS_ADMIN (21) to do most of what root does.",
      "setuid bit": "The file mode that makes an executable transition to its owner's uid when run. All-or-nothing, and the reason kernel local-root escalations matter.",
      "systemd sandboxing": "Per-unit confinement applied at exec by the service manager: NoNewPrivileges, ProtectSystem, ProtectHome, PrivateTmp, CapabilityBoundingSet, SystemCallFilter and friends.",
      "AppArmor": "The LSM Ubuntu ships. Path-and-capability rules attached to a binary; enforced and logged on every protected operation, including for uid 0.",
      "SELinux": "The LSM RHEL and Fedora ship. Label-based type enforcement, finer-grained, and the source of denials that appear nowhere in an application's own log.",
      "nftables": "The modern netfilter front end. One binary for IPv4 and IPv6, sets and maps, and transactional whole-ruleset replacement; the successor to iptables.",
      "conntrack": "The kernel's connection tracking table. When it fills, new connections are dropped silently — they hang rather than being refused — which is a confusing symptom of a simple cause.",
      "unattended-upgrades": "The Debian/Ubuntu daemon that installs security updates from configured origins. It does not reboot, does not restart services, does not cross a point release, and skips held packages.",
      "ESM": "Expanded Security Maintenance — Canonical's paid security updates for releases past end of life. Real patched packages, delivered through ordinary apt origins with a pin priority.",
      "livepatch": "Applying a kernel code change to running memory, so no reboot is needed. Kernel only: never userland, a new kernel version, new modules, or boot parameter changes.",
      "3-2-1 backup": "Three copies, two media, one off-host. The part that matters and is always skipped: a backup is not a backup until it has been restored from the off-host copy.",
      "principle of least privilege": "Give every process only the authority its task requires, because the blast radius of a bug is bounded by what the process holds — not by how careful the code is."
    }
  });
})();